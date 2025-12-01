import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import axios, { type AxiosInstance } from 'axios'

import { loggerService } from '../../services/LoggerService'

const logger = loggerService.withContext('QwenApiService')

// Constants from tmp-AIClient-2-API
const QWEN_DIR = '.qwen'
const QWEN_CREDENTIAL_FILENAME = 'oauth_creds.json'
const DEFAULT_QWEN_BASE_URL = 'https://portal.qwen.ai/v1'
const QWEN_MODEL_LIST = ['qwen3-coder-plus', 'qwen3-coder-flash']
const TOKEN_REFRESH_BUFFER_MS = 30 * 1000 // 30 seconds buffer before expiry

// Qwen OAuth2 endpoints and client credentials
const QWEN_OAUTH_BASE_URL = 'https://chat.qwen.ai'
const QWEN_OAUTH_TOKEN_ENDPOINT = `${QWEN_OAUTH_BASE_URL}/api/v1/oauth2/token`
const QWEN_OAUTH_CLIENT_ID = 'f0304373b74a44d2b584a3fb70ca9e56'

interface QwenOAuthCredentials {
  access_token?: string
  refresh_token?: string
  token_type?: string
  resource_url?: string
  expiry_date?: number
}

export interface QwenChatRequestBody {
  model?: string
  messages: Array<{
    role: string
    content: string
  }>
  stream?: boolean
  temperature?: number
  max_tokens?: number
  top_p?: number
  stop?: string | string[]
}

/**
 * Helper function to convert object to URL-encoded form data
 */
function objectToUrlEncoded(data: Record<string, any>): string {
  return Object.keys(data)
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
    .join('&')
}

/**
 * QwenApiService with automatic token refresh based on tmp-AIClient-2-API
 */
export class QwenApiService {
  private credentials: QwenOAuthCredentials | null = null
  private credentialsPath: string
  private refreshPromise: Promise<QwenOAuthCredentials> | null = null

  constructor() {
    this.credentialsPath = this.getCredentialsPath()
  }

  private getCredentialsPath(): string {
    if (process.env.QWEN_OAUTH_CREDS_FILE_PATH) {
      return path.resolve(process.env.QWEN_OAUTH_CREDS_FILE_PATH)
    }
    return path.join(os.homedir(), QWEN_DIR, QWEN_CREDENTIAL_FILENAME)
  }

  private getCurrentEndpoint(resourceUrl?: string): string {
    const baseEndpoint = resourceUrl || DEFAULT_QWEN_BASE_URL
    const suffix = '/v1'
    const normalizedUrl = baseEndpoint.startsWith('http') ? baseEndpoint : `https://${baseEndpoint}`
    return normalizedUrl.endsWith(suffix) ? normalizedUrl : `${normalizedUrl}${suffix}`
  }

  /**
   * Load credentials from file
   */
  private async loadCredentialsFromFile(): Promise<QwenOAuthCredentials> {
    try {
      const raw = await fs.readFile(this.credentialsPath, 'utf8')
      const credentials: QwenOAuthCredentials = JSON.parse(raw)

      if (!credentials.access_token) {
        throw new Error('Missing access_token in credential file')
      }

      return credentials
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(
          `Qwen credentials file not found at ${this.credentialsPath}. ` +
            `Please authenticate using: cd tmp-AIClient-2-API && npm run qwen login`
        )
      }
      throw new Error(`Failed to load Qwen credentials: ${error.message}`)
    }
  }

  /**
   * Save credentials to file
   */
  private async saveCredentialsToFile(credentials: QwenOAuthCredentials): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.credentialsPath), { recursive: true })
      await fs.writeFile(this.credentialsPath, JSON.stringify(credentials, null, 2))
      logger.info('[QwenApiService] Credentials saved to file')
    } catch (error: any) {
      logger.error('[QwenApiService] Failed to save credentials:', { error: error.message })
    }
  }

  /**
   * Check if token is valid (not expired)
   */
  private isTokenValid(credentials: QwenOAuthCredentials | null): boolean {
    if (!credentials || !credentials.access_token) {
      return false
    }

    // If no expiry date, assume it's still valid (conservative)
    if (!credentials.expiry_date) {
      return true
    }

    // Check if token will expire within the buffer time
    const now = Date.now()
    return now < credentials.expiry_date - TOKEN_REFRESH_BUFFER_MS
  }

  /**
   * Refresh access token using refresh_token
   * Based on tmp-AIClient-2-API implementation
   */
  private async refreshAccessToken(refreshToken: string): Promise<QwenOAuthCredentials> {
    const bodyData = {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: QWEN_OAUTH_CLIENT_ID
    }

    try {
      logger.info('[QwenApiService] Refreshing access token...')

      const response = await fetch(QWEN_OAUTH_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json'
        },
        body: objectToUrlEncoded(bodyData)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))

        // Handle 400 error - refresh token expired/invalid
        if (response.status === 400) {
          // Delete invalid credentials file
          try {
            await fs.unlink(this.credentialsPath)
            logger.warn('[QwenApiService] Deleted invalid credentials file')
          } catch (_) {
            /* ignore */
          }

          throw new Error(
            'Refresh token expired or invalid. Please re-authenticate: cd tmp-AIClient-2-API && npm run qwen login'
          )
        }

        throw new Error(
          `Token refresh failed (${response.status}): ${errorData.error_description || errorData.error || 'Unknown error'}`
        )
      }

      const tokenResponse = await response.json()

      if (!tokenResponse.access_token) {
        throw new Error('No access_token in refresh response')
      }

      // Build new credentials
      const newCredentials: QwenOAuthCredentials = {
        access_token: tokenResponse.access_token,
        token_type: tokenResponse.token_type,
        refresh_token: tokenResponse.refresh_token || refreshToken, // Keep old refresh_token if not provided
        resource_url: tokenResponse.resource_url,
        expiry_date: tokenResponse.expires_in ? Date.now() + tokenResponse.expires_in * 1000 : undefined
      }

      logger.info('[QwenApiService] Access token refreshed successfully')
      return newCredentials
    } catch (error: any) {
      logger.error('[QwenApiService] Token refresh failed:', { error: error.message })
      throw error
    }
  }

  /**
   * Get valid credentials with automatic refresh
   * This is called before each API request
   */
  private async getValidCredentials(forceReload = false): Promise<{
    token: string
    endpoint: string
  }> {
    // Force reload from file
    if (forceReload || !this.credentials) {
      this.credentials = await this.loadCredentialsFromFile()
      logger.debug('[QwenApiService] Loaded credentials from file')
    }

    // Check if token needs refresh
    if (!this.isTokenValid(this.credentials)) {
      logger.warn('[QwenApiService] Token expired or expiring soon, attempting refresh...')

      // Check if we have a refresh token
      if (!this.credentials.refresh_token) {
        logger.error('[QwenApiService] No refresh token available')
        throw new Error(
          'No refresh token available. Please re-authenticate: cd tmp-AIClient-2-API && npm run qwen login'
        )
      }

      // Use refreshPromise to prevent concurrent refreshes
      if (!this.refreshPromise) {
        this.refreshPromise = (async () => {
          try {
            const newCredentials = await this.refreshAccessToken(this.credentials!.refresh_token!)
            this.credentials = newCredentials
            await this.saveCredentialsToFile(newCredentials)
            return newCredentials
          } finally {
            this.refreshPromise = null
          }
        })()
      }

      this.credentials = await this.refreshPromise
    }

    if (!this.credentials.access_token) {
      throw new Error('No valid access token available')
    }

    return {
      token: this.credentials.access_token,
      endpoint: this.getCurrentEndpoint(this.credentials.resource_url)
    }
  }

  /**
   * Create axios instance with current valid token
   */
  private async createAxiosInstance(): Promise<AxiosInstance> {
    const { token, endpoint } = await this.getValidCredentials()

    const userAgent = `QwenCode/0.2.1 (${process.platform}; ${process.arch})`

    return axios.create({
      baseURL: endpoint,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-DashScope-CacheControl': 'enable',
        'X-DashScope-UserAgent': userAgent,
        'X-DashScope-AuthType': 'qwen-oauth'
      },
      proxy: false // Disable system proxy
    })
  }

  /**
   * Make API call with automatic retry on auth errors
   */
  private async callApiWithRetry(endpoint: string, body: any, isStream = false, retryCount = 0): Promise<any> {
    const maxRetries = 3
    const baseDelay = 1000

    try {
      const client = await this.createAxiosInstance()
      const options = isStream ? { responseType: 'stream' as const } : {}

      const response = await client.post(endpoint, body, options)
      return response.data
    } catch (error: any) {
      const status = error.response?.status

      // Handle auth errors: force reload and retry once
      if ((status === 401 || status === 403) && retryCount === 0) {
        logger.warn(`[QwenApiService] Auth error (${status}). Forcing credential reload and refresh, then retrying...`)
        try {
          // Force reload from file and auto-refresh if needed
          await this.getValidCredentials(true)
          return this.callApiWithRetry(endpoint, body, isStream, retryCount + 1)
        } catch (refreshError: any) {
          logger.error('[QwenApiService] Failed to refresh credentials:', { error: refreshError.message })
          throw new Error(`Qwen authentication failed: ${refreshError.message}. Please re-authenticate if needed.`)
        }
      }

      // Handle rate limiting and server errors with exponential backoff
      if ((status === 429 || (status >= 500 && status < 600)) && retryCount < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryCount)
        logger.warn(`[QwenApiService] Status ${status}. Retrying in ${delay}ms... (${retryCount + 1}/${maxRetries})`)
        await new Promise((resolve) => setTimeout(resolve, delay))
        return this.callApiWithRetry(endpoint, body, isStream, retryCount + 1)
      }

      logger.error(`[QwenApiService] API call failed:`, {
        status,
        message: error.message,
        data: error.response?.data
      })
      throw error
    }
  }

  async generateContent(requestBody: QwenChatRequestBody): Promise<any> {
    const body: QwenChatRequestBody = {
      ...requestBody
    }

    // Validate and set model
    if (!body.model || body.model === 'qwen-cli' || !QWEN_MODEL_LIST.includes(body.model)) {
      if (body.model && !QWEN_MODEL_LIST.includes(body.model)) {
        logger.warn(`[QwenApiService] Model '${body.model}' not in known list, falling back to '${QWEN_MODEL_LIST[0]}'`)
      }
      body.model = QWEN_MODEL_LIST[0]
    }

    logger.debug('[QwenApiService] Sending request:', {
      model: body.model,
      messagesCount: body.messages?.length
    })

    const data = await this.callApiWithRetry('/chat/completions', body, false)

    logger.debug('[QwenApiService] Response received:', {
      hasChoices: !!data?.choices,
      choicesCount: data?.choices?.length
    })

    return data
  }

  async *generateContentStream(requestBody: QwenChatRequestBody): AsyncGenerator<any, void, unknown> {
    const body: QwenChatRequestBody = {
      ...requestBody,
      stream: true
    }

    // Validate and set model
    if (!body.model || body.model === 'qwen-cli' || !QWEN_MODEL_LIST.includes(body.model)) {
      if (body.model && !QWEN_MODEL_LIST.includes(body.model)) {
        logger.warn(`[QwenApiService] Model '${body.model}' not in known list, falling back to '${QWEN_MODEL_LIST[0]}'`)
      }
      body.model = QWEN_MODEL_LIST[0]
    }

    logger.debug('[QwenApiService] Starting stream:', {
      model: body.model,
      messagesCount: body.messages?.length
    })

    const stream = await this.callApiWithRetry('/chat/completions', body, true)

    // Parse SSE stream
    let buffer = ''
    let chunkCount = 0

    for await (const chunk of stream) {
      // Properly convert Buffer to string with UTF-8 encoding
      let chunkStr: string
      if (Buffer.isBuffer(chunk)) {
        chunkStr = chunk.toString('utf8')
      } else if (typeof chunk === 'string') {
        chunkStr = chunk
      } else {
        // Handle Uint8Array or other array-like objects
        chunkStr = Buffer.from(chunk).toString('utf8')
      }

      logger.debug('[QwenApiService] Raw chunk received:', {
        length: chunkStr.length,
        preview: chunkStr.substring(0, 100)
      })

      buffer += chunkStr
      let newlineIndex

      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.substring(0, newlineIndex).trim()
        buffer = buffer.substring(newlineIndex + 1)

        if (line) {
          logger.debug('[QwenApiService] Processing line:', { line: line.substring(0, 200) })
        }

        if (line.startsWith('data: ')) {
          const jsonData = line.substring(6).trim()

          logger.debug('[QwenApiService] Found SSE data:', { jsonData: jsonData.substring(0, 200) })

          if (jsonData === '[DONE]') {
            logger.info('[QwenApiService] Stream completed with [DONE]')
            return
          }

          try {
            const parsed = JSON.parse(jsonData)
            chunkCount++
            logger.debug('[QwenApiService] Yielding chunk:', { chunkCount, hasChoices: !!parsed.choices })
            yield parsed
          } catch (e) {
            logger.warn('[QwenApiService] Failed to parse stream chunk:', { jsonData, error: String(e) })
          }
        }
      }
    }

    logger.info('[QwenApiService] Stream ended naturally', { totalChunks: chunkCount })
  }

  async listModels(): Promise<{ data: Array<{ id: string; name: string }> }> {
    return {
      data: QWEN_MODEL_LIST.map((id) => ({
        id,
        name: id === 'qwen3-coder-plus' ? 'Qwen3 Coder Plus' : 'Qwen3 Coder Flash'
      }))
    }
  }
}

export const qwenApiService = new QwenApiService()
