import { OAuth2Client } from 'google-auth-library'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'
import type { Readable } from 'node:stream'

import { loggerService } from '../../services/LoggerService'

const logger = loggerService.withContext('GeminiApiService')

// Constants adapted from AIClient-2-API, but without embedding client ID/secret
const CREDENTIALS_DIR = '.gemini'
const CREDENTIALS_FILE = 'oauth_creds.json'
const CODE_ASSIST_ENDPOINT = 'https://cloudcode-pa.googleapis.com'
const CODE_ASSIST_API_VERSION = 'v1internal'

// Keep in sync with the hardcoded list we expose for CLI models
const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
  'gemini-2.5-pro-preview-06-05',
  'gemini-2.5-flash-preview-09-2025',
  'gemini-3-pro-preview'
]

export interface GeminiGenerateRequest {
  system_instruction?: {
    role?: string
    parts: { text: string }[]
  }
  contents: Array<{
    role?: string
    parts: { text: string }[]
  }>
  // Other Gemini request fields can be added here if needed
}

export interface GeminiCandidateContentPart {
  text?: string
}

export interface GeminiCandidateContent {
  parts?: GeminiCandidateContentPart[]
}

export interface GeminiCandidate {
  content?: GeminiCandidateContent
  finishReason?: string
}

export interface GeminiApiResponse {
  candidates?: GeminiCandidate[]
  usageMetadata?: any
  promptFeedback?: any
  automaticFunctionCallingHistory?: any
}

function ensureRolesInContents(requestBody: GeminiGenerateRequest): GeminiGenerateRequest {
  const normalized: GeminiGenerateRequest = {
    ...requestBody,
    contents: requestBody.contents || []
  }

  if (normalized.system_instruction) {
    // Normalize snake_case to camelCase if needed
    if (!normalized.system_instruction.role) {
      normalized.system_instruction.role = 'user'
    }
  }

  if (normalized.contents && Array.isArray(normalized.contents)) {
    normalized.contents.forEach((content) => {
      if (!content.role) {
        content.role = 'user'
      }
    })
  }

  return normalized
}

function toGeminiApiResponse(codeAssistResponse: any): GeminiApiResponse | null {
  if (!codeAssistResponse) return null
  const compliant: GeminiApiResponse = {
    candidates: codeAssistResponse.candidates
  }
  if (codeAssistResponse.usageMetadata) compliant.usageMetadata = codeAssistResponse.usageMetadata
  if (codeAssistResponse.promptFeedback) compliant.promptFeedback = codeAssistResponse.promptFeedback
  if (codeAssistResponse.automaticFunctionCallingHistory) {
    compliant.automaticFunctionCallingHistory = codeAssistResponse.automaticFunctionCallingHistory
  }
  return compliant
}

export class GeminiApiService {
  private authClient: OAuth2Client
  private initialized = false
  private projectId: string

  constructor() {
    // We do not embed client id/secret here; they are expected to be present
    // in the OAuth credentials file created by the official Gemini CLI.
    this.authClient = new OAuth2Client()
    // Allow overriding project id via env, otherwise fall back to 'default'
    this.projectId = process.env.GEMINI_PROJECT_ID || 'default'
  }

  private getCredentialsPath(): string {
    return path.join(os.homedir(), CREDENTIALS_DIR, CREDENTIALS_FILE)
  }

  private async initializeAuth(forceRefresh = false): Promise<void> {
    if (this.authClient.credentials.access_token && !forceRefresh) {
      return
    }

    const credPath = this.getCredentialsPath()
    try {
      const raw = await fs.readFile(credPath, 'utf8')
      const credentials: any = JSON.parse(raw)
      this.authClient.setCredentials(credentials)
      logger.info('Loaded Gemini OAuth credentials from file')

      if (forceRefresh) {
        logger.info('Refreshing Gemini OAuth access token')
        // google-auth-library will use refresh_token + client info from credentials
        const { credentials: newCredentials } = await this.authClient.refreshAccessToken()
        this.authClient.setCredentials(newCredentials)
        await fs.writeFile(credPath, JSON.stringify(newCredentials, null, 2), 'utf8')
        logger.info('Refreshed Gemini OAuth credentials saved to file')
      }
    } catch (error: any) {
      logger.error('Failed to initialize Gemini OAuth credentials:', error)
      throw new Error(
        `Failed to load Gemini OAuth credentials from ${credPath}. Please run 'gemini login' on this machine first.`
      )
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return
    await this.initializeAuth(false)
    if (process.env.GEMINI_PROJECT_ID) {
      this.projectId = process.env.GEMINI_PROJECT_ID
      logger.info(`Using Gemini project from GEMINI_PROJECT_ID: ${this.projectId}`)
    } else {
      // Always try Code Assist onboarding discovery, like AIClient-2-API
      try {
        this.projectId = await this.discoverProjectId()
        logger.info(`Discovered Gemini project id from Code Assist: ${this.projectId}`)
      } catch (error: any) {
        logger.error('Failed to discover Gemini project id; falling back to "default":', error?.message)
        this.projectId = 'default'
      }
    }

    this.initialized = true
    logger.info(`GeminiApiService initialized with projectId=${this.projectId}`)
  }

  private async discoverProjectId(): Promise<string> {
    logger.info('[GeminiApiService] Discovering project id via Code Assist...')
    // Match AIClient-2-API behaviour: start with empty project and let backend decide
    const initialProjectId = ''
    const clientMetadata = {
      ideType: 'IDE_UNSPECIFIED',
      platform: 'PLATFORM_UNSPECIFIED',
      pluginType: 'GEMINI',
      duetProject: initialProjectId
    }

    const loadRequest = {
      cloudaicompanionProject: initialProjectId,
      metadata: clientMetadata
    }

    const loadResponse = await this.callApi('loadCodeAssist', loadRequest)

    if (loadResponse?.cloudaicompanionProject) {
      return loadResponse.cloudaicompanionProject
    }

    const defaultTier = loadResponse?.allowedTiers?.find((tier: any) => tier.isDefault)
    const tierId = defaultTier?.id || 'free-tier'

    const onboardRequest = {
      tierId,
      cloudaicompanionProject: initialProjectId,
      metadata: clientMetadata
    }

    let lroResponse = await this.callApi('onboardUser', onboardRequest)

    const MAX_RETRIES = 30
    let retries = 0

    while (!lroResponse.done && retries < MAX_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      lroResponse = await this.callApi('onboardUser', onboardRequest)
      retries++
    }

    if (!lroResponse.done) {
      throw new Error('Onboarding timeout: operation did not complete in time')
    }

    const discovered =
      lroResponse.response?.cloudaicompanionProject?.id ||
      lroResponse.response?.cloudaicompanionProject ||
      initialProjectId

    if (!discovered) {
      throw new Error('Could not discover a valid project id from onboarding response')
    }

    return discovered
  }

  private async callApi(method: string, body: any): Promise<any> {
    await this.initializeAuth(false)

    const requestOptions: any = {
      url: `${CODE_ASSIST_ENDPOINT}/${CODE_ASSIST_API_VERSION}:${method}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      responseType: 'json',
      body: JSON.stringify(body)
    }

    const res = await this.authClient.request<any>(requestOptions)
    if (res.status !== 200) {
      throw new Error(`Upstream Gemini API error (status ${res.status}): ${JSON.stringify(res.data)}`)
    }
    return res.data
  }

  private async *streamApi(
    method: string,
    body: any,
    isRetry = false,
    retryCount = 0
  ): AsyncGenerator<any, void, unknown> {
    const maxRetries = 3
    const baseDelay = 1000

    try {
      await this.initializeAuth(false)
      const requestOptions: any = {
        url: `${CODE_ASSIST_ENDPOINT}/${CODE_ASSIST_API_VERSION}:${method}`,
        method: 'POST',
        params: { alt: 'sse' },
        headers: { 'Content-Type': 'application/json' },
        responseType: 'stream',
        body: JSON.stringify(body)
      }
      const res = await this.authClient.request<Readable>(requestOptions)

      if (res.status !== 200) {
        let errorBody = ''
        for await (const chunk of res.data!) {
          errorBody += chunk.toString()
        }
        throw new Error(`Upstream Gemini streaming error (status ${res.status}): ${errorBody}`)
      }

      yield* this.parseSSEStream(res.data!)
    } catch (error: any) {
      const status = error?.response?.status
      logger.error(`[GeminiApiService] Error during stream ${method}:`, status, error?.message)

      // 400/401 – refresh auth and retry once
      if ((status === 400 || status === 401) && !isRetry) {
        logger.info('[GeminiApiService] 400/401 during stream, refreshing auth and retrying once...')
        await this.initializeAuth(true)
        yield* this.streamApi(method, body, true, retryCount)
        return
      }

      // 429 – exponential backoff retries
      if (status === 429 && retryCount < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryCount)
        logger.warn(
          `[GeminiApiService] 429 during stream; retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`
        )
        await new Promise((resolve) => setTimeout(resolve, delay))
        yield* this.streamApi(method, body, isRetry, retryCount + 1)
        return
      }

      // 5xx – retry with backoff
      if (status >= 500 && status < 600 && retryCount < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryCount)
        logger.warn(
          `[GeminiApiService] ${status} server error during stream; retrying in ${delay}ms (attempt ${
            retryCount + 1
          }/${maxRetries})`
        )
        await new Promise((resolve) => setTimeout(resolve, delay))
        yield* this.streamApi(method, body, isRetry, retryCount + 1)
        return
      }

      throw error
    }
  }

  private async *parseSSEStream(stream: Readable): AsyncGenerator<any, void, unknown> {
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })
    let buffer: string[] = []

    for await (const line of rl) {
      if (line.startsWith('data: ')) {
        buffer.push(line.slice(6))
      } else if (line === '' && buffer.length > 0) {
        const raw = buffer.join('\n')
        buffer = []
        try {
          yield JSON.parse(raw)
        } catch (e) {
          logger.error('[GeminiApiService] Failed to parse JSON chunk from stream:', raw)
        }
      }
    }

    if (buffer.length > 0) {
      const raw = buffer.join('\n')
      try {
        yield JSON.parse(raw)
      } catch (e) {
        logger.error('[GeminiApiService] Failed to parse final JSON chunk from stream:', raw)
      }
    }
  }

  async generateContent(model: string, request: GeminiGenerateRequest): Promise<GeminiApiResponse | null> {
    await this.initialize()

    let selectedModel = model
    if (!GEMINI_MODELS.includes(selectedModel)) {
      logger.warn(
        `[GeminiApiService] Model '${model}' not in known list, falling back to '${GEMINI_MODELS[0]}' for API call`
      )
      selectedModel = GEMINI_MODELS[0]
    }

    const processed = ensureRolesInContents(request)
    const apiRequest = {
      model: selectedModel,
      project: this.projectId,
      request: processed
    }

    const response = await this.callApi('generateContent', apiRequest)
    return toGeminiApiResponse(response)
  }

  private async *generateContentStreamWithAntiTruncation(
    model: string,
    requestBody: GeminiGenerateRequest
  ): AsyncGenerator<GeminiApiResponse | null, void, unknown> {
    let currentRequest: GeminiGenerateRequest = { ...requestBody }

    // Loop until we either are not truncated or cannot sensibly continue.
    while (true) {
      const apiRequest = {
        model,
        project: this.projectId,
        request: currentRequest
      }

      const stream = this.streamApi('streamGenerateContent', apiRequest)
      let lastChunk: GeminiApiResponse | null = null

      for await (const chunk of stream) {
        const response = toGeminiApiResponse((chunk as any).response ?? chunk)
        if (response && response.candidates && response.candidates[0]) {
          yield response
          lastChunk = response
        }
      }

      const finishReason = lastChunk?.candidates?.[0]?.finishReason
      if (finishReason === 'MAX_TOKENS') {
        const parts = lastChunk?.candidates?.[0]?.content?.parts || []
        const generatedText = parts
          .filter((p) => typeof p.text === 'string' && p.text.length > 0)
          .map((p) => p.text!)
          .join('')

        if (generatedText) {
          const newContents = [...(requestBody.contents || [])]

          // Append previously generated text as a model reply
          newContents.push({
            role: 'model',
            parts: [{ text: generatedText }]
          })

          // Ask the model to continue from where it left off
          newContents.push({
            role: 'user',
            parts: [{ text: 'Please continue from where you left off.' }]
          })

          currentRequest = {
            ...requestBody,
            contents: newContents
          }

          // Continue outer while(true) with the new request
          continue
        }
      }

      // Not truncated, or unable to continue – exit.
      break
    }
  }

  async *generateContentStream(
    model: string,
    request: GeminiGenerateRequest
  ): AsyncGenerator<GeminiApiResponse | null, void, unknown> {
    await this.initialize()

    let selectedModel = model
    if (!GEMINI_MODELS.includes(selectedModel)) {
      logger.warn(
        `[GeminiApiService] Model '${model}' not in known list, falling back to '${GEMINI_MODELS[0]}' for streaming`
      )
      selectedModel = GEMINI_MODELS[0]
    }

    const processed = ensureRolesInContents(request)

    // Always use anti-truncation streaming logic for CLI-style usage,
    // matching AIClient-2-API behaviour: if the model stops at MAX_TOKENS,
    // we automatically send follow-up requests to continue.
    yield* this.generateContentStreamWithAntiTruncation(selectedModel, processed)
  }
}

export const geminiApiService = new GeminiApiService()
