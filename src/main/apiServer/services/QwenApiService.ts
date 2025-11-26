import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import axios, { type AxiosInstance } from 'axios'

import { loggerService } from '../../services/LoggerService'

const logger = loggerService.withContext('QwenApiService')

const QWEN_DIR = '.qwen'
const QWEN_CREDENTIAL_FILENAME = 'oauth_creds.json'
const DEFAULT_QWEN_BASE_URL = 'https://portal.qwen.ai/v1'
const QWEN_MODEL_LIST = ['qwen3-coder-plus', 'qwen3-coder-flash']

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
  [key: string]: any
}

export class QwenApiService {
  private initialized = false
  private accessToken: string | null = null
  private baseUrl: string = DEFAULT_QWEN_BASE_URL
  private axiosInstance: AxiosInstance | null = null

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

  private async initializeAuth(): Promise<void> {
    const credPath = this.getCredentialsPath()

    try {
      const raw = await fs.readFile(credPath, 'utf8')
      const credentials: QwenOAuthCredentials = JSON.parse(raw)

      if (!credentials.access_token) {
        throw new Error('Missing access_token in Qwen OAuth credentials')
      }

      this.accessToken = credentials.access_token
      this.baseUrl = this.getCurrentEndpoint(credentials.resource_url)

      logger.info(`Loaded Qwen OAuth credentials from ${credPath}`)
    } catch (error: any) {
      logger.error('Failed to load Qwen OAuth credentials:', error)
      throw new Error(
        `Failed to load Qwen OAuth credentials from ${credPath}. ` +
          `Please ensure you have completed Qwen OAuth login (e.g. via AIClient-2-API) and that the credentials file exists.`
      )
    }
  }

  private async getAxios(): Promise<AxiosInstance> {
    if (!this.initialized) {
      await this.initializeAuth()

      const userAgent = `QwenCode/0.2.1 (${process.platform}; ${process.arch})`

      this.axiosInstance = axios.create({
        baseURL: this.baseUrl,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.accessToken}`,
          'X-DashScope-CacheControl': 'enable',
          'X-DashScope-UserAgent': userAgent,
          'X-DashScope-AuthType': 'qwen-oauth'
        }
      })

      this.initialized = true
      logger.info(`[QwenApiService] Initialized with base URL: ${this.baseUrl}`)
    }

    return this.axiosInstance as AxiosInstance
  }

  async generateContent(requestBody: QwenChatRequestBody): Promise<any> {
    const client = await this.getAxios()

    const body: QwenChatRequestBody = {
      ...requestBody
    }

    // If client sends a placeholder model id or unknown model, map to default,
    // matching AIClient-2-API behaviour.
    if (!body.model || body.model === 'qwen-cli' || !QWEN_MODEL_LIST.includes(body.model)) {
      if (body.model && !QWEN_MODEL_LIST.includes(body.model)) {
        logger.warn(`[QwenApiService] Model '${body.model}' not in known list, falling back to '${QWEN_MODEL_LIST[0]}'`)
      }
      body.model = QWEN_MODEL_LIST[0]
    }

    logger.info('[QwenApiService] Sending request to Qwen API:', {
      model: body.model,
      messagesCount: body.messages?.length,
      stream: body.stream
    })

    const response = await client.post('/chat/completions', body)

    logger.info('[QwenApiService] Received response from Qwen API:', {
      status: response.status,
      hasData: !!response.data,
      hasChoices: !!response.data?.choices,
      choicesCount: response.data?.choices?.length,
      firstChoiceHasMessage: !!response.data?.choices?.[0]?.message,
      firstMessageContent: response.data?.choices?.[0]?.message?.content?.substring(0, 100)
    })

    return response.data
  }

  async *generateContentStream(requestBody: QwenChatRequestBody): AsyncGenerator<any, void, unknown> {
    const client = await this.getAxios()

    const body: QwenChatRequestBody = {
      ...requestBody,
      stream: true
    }

    if (!body.model || body.model === 'qwen-cli' || !QWEN_MODEL_LIST.includes(body.model)) {
      if (body.model && !QWEN_MODEL_LIST.includes(body.model)) {
        logger.warn(`[QwenApiService] Model '${body.model}' not in known list, falling back to '${QWEN_MODEL_LIST[0]}'`)
      }
      body.model = QWEN_MODEL_LIST[0]
    }

    const response = await client.post('/chat/completions', body, {
      responseType: 'stream'
    })

    logger.info('[QwenApiService] Stream response received, starting to read...')

    const stream = response.data as NodeJS.ReadableStream
    let buffer = ''
    let rawChunkCount = 0
    let yieldCount = 0

    for await (const chunk of stream) {
      rawChunkCount++

      // 正确处理 chunk：确保是 Buffer，然后转换为字符串
      const buffer_chunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      const chunkStr = buffer_chunk.toString('utf8')

      buffer += chunkStr
      let newlineIndex: number

      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.substring(0, newlineIndex).trim()
        buffer = buffer.substring(newlineIndex + 1)

        if (!line) {
          continue
        }

        if (!line.startsWith('data:')) {
          continue
        }

        const payload = line.slice(5).trim()

        if (!payload) {
          continue
        }
        if (payload === '[DONE]') {
          logger.info('[QwenApiService] Received [DONE], stream ending')
          return
        }

        try {
          const json = JSON.parse(payload)
          yieldCount++
          yield json
        } catch (error) {
          logger.warn('[QwenApiService] Failed to parse stream chunk:', {
            payloadPreview: payload.substring(0, 100),
            error
          })
        }
      }
    }

    logger.info('[QwenApiService] Stream ended:', { rawChunkCount, yieldCount })
  }
}

export const qwenApiService = new QwenApiService()
