import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { OAuth2Client } from 'google-auth-library'

import { loggerService } from '../../services/LoggerService'

const logger = loggerService.withContext('GeminiApiService')

// Constants adapted from tmp-AIClient-2-API
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
  private _authClient: OAuth2Client | null = null
  private initialized = false
  private projectId: string
  private clientId: string | undefined
  private clientSecret: string | undefined

  constructor() {
    // Allow overriding project id via env, otherwise fall back to 'default'
    this.projectId = process.env.GEMINI_PROJECT_ID || 'default'
  }

  /**
   * Lazy initialization of OAuth2Client.
   * Now supports loading client_id/secret from the credentials file if available.
   */
  private get authClient(): OAuth2Client {
    if (!this._authClient) {
      // Priority:
      // 1. Loaded from client_secret.json (this.clientId/Secret)
      // 2. Environment variables
      // 3. Fallback defaults (empty strings to avoid hardcoding secrets in repo)
      const clientId =
        this.clientId ||
        process.env.GEMINI_OAUTH_CLIENT_ID ||
        '681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com'
      const clientSecret = this.clientSecret || process.env.GEMINI_OAUTH_CLIENT_SECRET || ''

      this._authClient = new OAuth2Client({
        clientId,
        clientSecret,
        eagerRefreshThresholdMillis: 5 * 60 * 1000
      })

      // logger.debug('OAuth2Client created', {
      //   source: this.clientId ? 'file' : 'env/default',
      //   hasClientId: !!clientId,
      //   hasClientSecret: !!clientSecret
      // })
    }
    return this._authClient
  }

  private async loadClientSecrets(): Promise<void> {
    const secretPath = path.join(os.homedir(), CREDENTIALS_DIR, 'client_secret.json')
    try {
      const raw = await fs.readFile(secretPath, 'utf8')
      const data = JSON.parse(raw)
      // Support both standard Google download format ({ installed: ... } or { web: ... }) and flat format
      const creds = data.installed || data.web || data
      if (creds.client_id && creds.client_secret) {
        this.clientId = creds.client_id
        this.clientSecret = creds.client_secret
        logger.info('Loaded Client ID and Secret from client_secret.json')
      }
    } catch (error) {
      // It's okay if the file doesn't exist, we'll fall back to env/defaults
      // logger.debug('Could not load client_secret.json, using defaults/env', {
      //   path: secretPath,
      //   error: (error as Error).message
      // })
    }
  }

  private getCredentialsPath(): string {
    return path.join(os.homedir(), CREDENTIALS_DIR, CREDENTIALS_FILE)
  }

  private async initializeAuth(forceReload = false): Promise<void> {
    // If we already have an access token, assume it's still valid
    // (The Gemini CLI manages token refresh separately)
    if (!forceReload && this.authClient.credentials.access_token) {
      return
    }

    const credPath = this.getCredentialsPath()
    try {
      const raw = await fs.readFile(credPath, 'utf8')
      const credentials: any = JSON.parse(raw)

      // Validate that we have an access token
      if (!credentials.access_token) {
        throw new Error('OAuth credentials file does not contain an access_token')
      }

      // const stats = await fs.stat(credPath)
      // const mtime = stats.mtime
      // const now = new Date()
      // const ageMinutes = (now.getTime() - mtime.getTime()) / 1000 / 60

      this.authClient.setCredentials(credentials)
      logger.info('Loaded Gemini OAuth credentials from file') // Log if refresh_token is missing (informational only)
      if (!credentials.refresh_token) {
        logger.warn('OAuth credentials file does not contain refresh_token. Tokens will not auto-refresh.')
        logger.warn('If you encounter authentication errors, please run "gemini login" again.')
      }
    } catch (error: any) {
      logger.error('Failed to initialize Gemini OAuth credentials:', error)
      throw new Error(
        `Failed to load Gemini OAuth credentials from ${credPath}. ` +
          `Please run 'gemini login' on this machine first. ` +
          `Error: ${error.message}`
      )
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return
    await this.loadClientSecrets()
    await this.initializeAuth()
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
    logger.info('Discovering project id via Code Assist...')
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

  private async callApi(method: string, body: any, isRetry = false, retryCount = 0): Promise<any> {
    await this.initializeAuth()

    // If project ID is not set, try to discover it.
    // Crucial: Skip discovery for the methods used *during* discovery to avoid infinite recursion.
    if (this.projectId === 'default' && method !== 'loadCodeAssist' && method !== 'onboardUser') {
      try {
        this.projectId = await this.discoverProjectId()
      } catch (error) {
        logger.warn('Failed to auto-discover project ID:', { error: String(error) })
        // Proceed with 'default' and let the API fail if it must, or maybe it works for some endpoints
      }
    }

    const maxRetries = 3
    const baseDelay = 1000

    try {
      const url = `${CODE_ASSIST_ENDPOINT}/${CODE_ASSIST_API_VERSION}:${method}`
      const res = await this.authClient.request({
        url,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        responseType: 'json',
        body: JSON.stringify(body)
      })
      return res.data
    } catch (error: any) {
      const status = error.response?.status
      logger.error(`Error calling ${method}:`, {
        status,
        message: String(error.message || 'Unknown error')
      })

      // Handle 401 (Unauthorized) or 400 (Bad Request - sometimes used for auth errors)
      // Refresh auth and retry once
      if ((status === 401 || status === 400) && !isRetry) {
        logger.info('Received 401/400. Refreshing auth and retrying...')
        try {
          await this.initializeAuth(true)
          return this.callApi(method, body, true, retryCount)
        } catch (refreshError) {
          logger.error('Failed to refresh auth during retry:', { error: String(refreshError) })
          throw error // Throw original error if refresh fails
        }
      }

      // Handle 429 (Too Many Requests) with exponential backoff
      if (status === 429 && retryCount < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryCount)
        logger.warn(`Received 429. Retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`)
        await new Promise((resolve) => setTimeout(resolve, delay))
        return this.callApi(method, body, isRetry, retryCount + 1)
      }

      // Handle 5xx server errors with exponential backoff
      if (status >= 500 && status < 600 && retryCount < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryCount)
        logger.warn(`Received ${status}. Retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`)
        await new Promise((resolve) => setTimeout(resolve, delay))
        return this.callApi(method, body, isRetry, retryCount + 1)
      }

      throw error
    }
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
      await this.initializeAuth()

      // If project ID is not set, try to discover it.
      if (this.projectId === 'default') {
        try {
          this.projectId = await this.discoverProjectId()
        } catch (error) {
          logger.warn('Failed to auto-discover project ID during stream:', { error: String(error) })
        }
      }

      const url = `${CODE_ASSIST_ENDPOINT}/${CODE_ASSIST_API_VERSION}:${method}`

      const res = await this.authClient.request({
        url,
        method: 'POST',
        params: { alt: 'sse' },
        headers: { 'Content-Type': 'application/json' },
        responseType: 'stream',
        body: JSON.stringify(body)
      })

      if (res.status !== 200) {
        throw new Error(`Upstream API Error (Status ${res.status})`)
      }

      yield* this.parseSSEStream(res.data)
    } catch (error: any) {
      const status = error?.response?.status
      logger.error(`Error during stream ${method}:`, status, error?.message)

      // 401 – reload credentials and retry once
      if (status === 401 && !isRetry) {
        logger.warn('401 during stream, reloading credentials and retrying...')
        await this.initializeAuth(true)
        yield* this.streamApi(method, body, true, retryCount)
        return
      }

      if (status === 401) {
        throw new Error(
          'Gemini API authentication failed (401). The access token has expired. Please run "gemini login" in your terminal to refresh your credentials.'
        )
      }

      // 400 - Bad Request (often invalid argument or project issue)
      if (status === 400) {
        // Sometimes 400 can be transient or auth related in weird ways, but usually it's fatal.
        // We won't retry 400 blindly unless we suspect it's auth related, but we handled 401 above.
        // Just throw to avoid infinite loops.
        throw new Error(`Upstream Gemini API error (400): ${JSON.stringify(error.response?.data || error.message)}`)
      }

      // 429 – exponential backoff retries
      if (status === 429 && retryCount < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryCount)
        logger.warn(`429 during stream; retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`)
        await new Promise((resolve) => setTimeout(resolve, delay))
        yield* this.streamApi(method, body, isRetry, retryCount + 1)
        return
      }

      // 5xx – retry with backoff
      if (status >= 500 && status < 600 && retryCount < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryCount)
        logger.warn(
          `${status} server error during stream; retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`
        )
        await new Promise((resolve) => setTimeout(resolve, delay))
        yield* this.streamApi(method, body, isRetry, retryCount + 1)
        return
      }

      throw error
    }
  }

  private async *parseSSEStream(stream: any): AsyncGenerator<any, void, unknown> {
    let buffer = ''
    for await (const chunk of stream) {
      let chunkStr: string
      if (typeof chunk === 'string') {
        chunkStr = chunk
      } else {
        chunkStr = Buffer.from(chunk).toString('utf8')
      }
      // logger.debug('Raw chunk received:', {
      //   length: chunkStr.length,
      //   preview: chunkStr.substring(0, 50)
      // })
      buffer += chunkStr
      const lines = buffer.split('\n')
      // Keep the last line in the buffer as it might be incomplete
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('data:')) {
          // Handle 'data: ' and 'data:' and 'data:  ' etc.
          const data = trimmed.replace(/^data:\s*/, '')
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            yield parsed
          } catch (e) {
            logger.error('Failed to parse JSON:', { error: String(e), data: data.substring(0, 100) })
          }
        } else if (trimmed) {
          // logger.debug('Skipping line:', { line: trimmed.substring(0, 50) })
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim().startsWith('data: ')) {
      const data = buffer.trim().slice(6)
      if (data !== '[DONE]') {
        try {
          yield JSON.parse(data)
        } catch (e) {
          logger.error('Failed to parse final JSON chunk from stream:', { raw: data })
        }
      }
    }
  }

  async generateContent(model: string, request: GeminiGenerateRequest): Promise<GeminiApiResponse | null> {
    await this.initialize()

    let selectedModel = model
    if (!GEMINI_MODELS.includes(selectedModel)) {
      logger.warn(`Model '${model}' not in known list, falling back to '${GEMINI_MODELS[0]}' for API call`)
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

    // logger.debug('Stream started', { model })

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
        } else {
          logger.warn('Chunk yielded no candidates')
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
      logger.warn(`Model '${model}' not in known list, falling back to '${GEMINI_MODELS[0]}' for streaming`)
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
