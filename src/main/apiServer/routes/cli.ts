import type { Provider } from '@types'
import express from 'express'
import { v4 as uuidv4 } from 'uuid'

import { loggerService } from '../../services/LoggerService'
import { reduxService } from '../../services/ReduxService'
import { cliService } from '../services/CliService'
import { geminiApiService, type GeminiGenerateRequest } from '../services/GeminiApiService'
import { qwenApiService, type QwenChatRequestBody } from '../services/QwenApiService'

const logger = loggerService.withContext('ApiServerCliRoutes')
const router = express.Router()

interface ChatCompletionRequest {
  model: string
  messages: { role: string; content: string }[]
  stream?: boolean
  temperature?: number
}

function buildGeminiRequestFromMessages(messages: { role: string; content: string }[]): GeminiGenerateRequest {
  const contents: GeminiGenerateRequest['contents'] = []
  const systemParts: { text: string }[] = []
  for (const msg of messages) {
    if (!msg.content) continue
    if (msg.role === 'system') {
      systemParts.push({ text: msg.content })
      continue
    }
    const role = msg.role === 'assistant' ? 'model' : 'user'
    contents.push({
      role,
      parts: [{ text: msg.content }]
    })
  }
  const request: GeminiGenerateRequest = {
    contents
  }
  if (systemParts.length > 0) {
    request.system_instruction = {
      role: 'user',
      parts: systemParts
    }
  }
  return request
}

router.post('/gemini/chat/completions', async (req, res) => {
  try {
    const request: ChatCompletionRequest = req.body
    let { messages } = request
    const { stream } = request

    if (!messages || messages.length === 0) {
      return res.status(400).json({
        error: {
          message: 'Messages are required',
          type: 'invalid_request_error',
          code: 'missing_messages'
        }
      })
    }

    const modelId = request.model || 'gemini-2.5-flash'

    // Inject Gemini CLI system prompt (from provider configuration) as a system message,
    // so that all conversations consistently include the base prompt configured in UI.
    try {
      const providers = await reduxService.select<Provider[]>('state.llm.providers')
      if (providers && Array.isArray(providers)) {
        const geminiProvider = providers.find((p) => p.id === 'gemini-cli')
        const cliSystemPrompt = geminiProvider?.cliSystemPrompt?.trim()

        if (cliSystemPrompt) {
          messages = [{ role: 'system', content: cliSystemPrompt }, ...messages]
        }
      }
    } catch (error: any) {
      logger.debug('Failed to apply Gemini CLI system prompt from Redux store (non-fatal):', { error })
    }

    const geminiRequest = buildGeminiRequestFromMessages(messages)

    if (stream) {
      try {
        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection', 'keep-alive')

        const streamId = uuidv4()

        for await (const chunk of geminiApiService.generateContentStream(modelId, geminiRequest)) {
          if (!chunk?.candidates || !chunk.candidates[0]?.content?.parts) {
            continue
          }
          const parts = chunk.candidates[0].content.parts
          const deltaText = parts
            .filter((p) => typeof p.text === 'string' && p.text.length > 0)
            .map((p) => p.text)
            .join('')

          if (!deltaText) {
            continue
          }

          const sseChunk = {
            id: streamId,
            object: 'chat.completion.chunk',
            created: Date.now(),
            model: modelId,
            choices: [
              {
                index: 0,
                delta: { content: deltaText },
                finish_reason: null
              }
            ]
          }
          res.write(`data: ${JSON.stringify(sseChunk)}\n\n`)
        }

        const endChunk = {
          id: streamId,
          object: 'chat.completion.chunk',
          created: Date.now(),
          model: modelId,
          choices: [
            {
              index: 0,
              delta: {},
              finish_reason: 'stop'
            }
          ]
        }
        res.write(`data: ${JSON.stringify(endChunk)}\n\n`)
        res.write('data: [DONE]\n\n')
      } catch (error: any) {
        logger.error('Gemini API streaming error:', { error })
        if (!res.headersSent) {
          return res.status(500).json({
            error: {
              message: error?.message || 'Gemini streaming error',
              type: 'server_error',
              code: 'gemini_stream_error'
            }
          })
        }
      } finally {
        if (!res.writableEnded) {
          res.end()
        }
      }
      return
    } else {
      try {
        const result = await geminiApiService.generateContent(modelId, geminiRequest)
        const contentParts = result?.candidates?.[0]?.content?.parts || []
        const text = contentParts
          .filter((p: any) => typeof p.text === 'string' && p.text.length > 0)
          .map((p: any) => p.text)
          .join('')

        const response = {
          id: uuidv4(),
          object: 'chat.completion',
          created: Date.now(),
          model: modelId,
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: text
              },
              finish_reason: 'stop'
            }
          ],
          usage: {
            prompt_tokens: result?.usageMetadata?.promptTokenCount || 0,
            completion_tokens: result?.usageMetadata?.candidatesTokenCount || 0,
            total_tokens: result?.usageMetadata?.totalTokenCount || 0
          }
        }

        return res.json(response)
      } catch (error: any) {
        logger.error('Gemini API error:', { error })
        return res.status(500).json({
          error: {
            message: error?.message || 'Gemini API error',
            type: 'server_error',
            code: 'gemini_api_error'
          }
        })
      }
    }
  } catch (error: any) {
    logger.error('Gemini API chat error:', { error })
    return res.status(500).json({
      error: {
        message: error?.message || 'Internal server error',
        type: 'server_error',
        code: 'internal_error'
      }
    })
  }
})

router.post('/qwen/chat/completions', async (req, res) => {
  try {
    const request: ChatCompletionRequest = req.body
    let { messages } = request
    const { stream } = request

    // 添加详细的请求日志
    logger.info('[Qwen] Incoming request:', {
      model: request.model,
      stream: stream,
      messageCount: messages?.length,
      hasMessages: !!messages
    })

    if (!messages || messages.length === 0) {
      return res.status(400).json({
        error: {
          message: 'Messages are required',
          type: 'invalid_request_error',
          code: 'missing_messages'
        }
      })
    }

    // Inject Qwen CLI system prompt (from provider configuration) as a system message.
    try {
      const providers = await reduxService.select<Provider[]>('state.llm.providers')
      if (providers && Array.isArray(providers)) {
        const qwenProvider = providers.find((p) => p.id === 'qwen-cli')
        const cliSystemPrompt = qwenProvider?.cliSystemPrompt?.trim()

        if (cliSystemPrompt) {
          messages = [{ role: 'system', content: cliSystemPrompt }, ...messages]
        }
      }
    } catch (error: any) {
      logger.debug('Failed to apply Qwen CLI system prompt from Redux store (non-fatal):', { error })
    }

    const qwenRequest: QwenChatRequestBody = {
      model: request.model,
      messages,
      temperature: request.temperature,
      stream
    }

    if (stream) {
      try {
        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection', 'keep-alive')

        const streamId = uuidv4()
        logger.info('[Qwen stream] Starting stream, ID:', { streamId })

        let chunkCount = 0
        let totalTextLength = 0

        for await (const chunk of qwenApiService.generateContentStream(qwenRequest)) {
          chunkCount++
          logger.debug('[Qwen stream] Received chunk', { chunkCount, chunk: JSON.stringify(chunk) })

          if (!chunk?.choices || !chunk.choices[0]) {
            logger.debug('[Qwen stream] Chunk', { chunkCount, message: 'has no choices, skipping' })
            continue
          }

          const choice = chunk.choices[0]
          const delta = choice.delta || {}

          let deltaText = ''

          // Qwen OpenAI 兼容接口通常使用 delta.content 为字符串，
          // 但也可能是数组（多段文本）。这里统一抽取为纯文本。
          if (typeof delta.content === 'string') {
            deltaText = delta.content
          } else if (Array.isArray(delta.content)) {
            deltaText = delta.content
              .map((part: any) => {
                if (typeof part === 'string') return part
                if (typeof part?.text === 'string') return part.text
                if (typeof part?.content === 'string') return part.content
                return ''
              })
              .join('')
          } else if (typeof (delta as any).text === 'string') {
            deltaText = (delta as any).text
          }

          if (!deltaText) {
            logger.debug('[Qwen stream] Chunk', { chunkCount, message: 'has no text content, skipping' })
            continue
          }

          totalTextLength += deltaText.length
          logger.debug('[Qwen stream] Chunk', {
            chunkCount,
            text: {
              length: deltaText.length,
              preview: deltaText.substring(0, 50),
              totalSoFar: totalTextLength
            }
          })

          const sseChunk = {
            id: streamId,
            object: 'chat.completion.chunk',
            created: Date.now(),
            model: chunk.model || request.model || 'qwen3-coder-plus',
            choices: [
              {
                index: 0,
                delta: { content: deltaText },
                finish_reason: null
              }
            ]
          }

          res.write(`data: ${JSON.stringify(sseChunk)}\n\n`)
        }

        logger.info('[Qwen stream] Stream completed:', {
          streamId,
          totalChunks: chunkCount,
          totalTextLength
        })

        const endChunk = {
          id: streamId,
          object: 'chat.completion.chunk',
          created: Date.now(),
          model: request.model || 'qwen3-coder-plus',
          choices: [
            {
              index: 0,
              delta: {},
              finish_reason: 'stop'
            }
          ]
        }
        res.write(`data: ${JSON.stringify(endChunk)}\n\n`)
        res.write('data: [DONE]\n\n')
      } catch (error: any) {
        logger.error('Qwen API streaming error:', { error })
        return res.status(500).json({
          error: {
            message: error?.message || 'Qwen streaming error',
            type: 'server_error',
            code: 'qwen_stream_error'
          }
        })
      } finally {
        if (!res.writableEnded) {
          res.end()
        }
      }
      return
    } else {
      try {
        const result = await qwenApiService.generateContent(qwenRequest)

        // 添加详细的调试日志
        logger.debug('[Qwen non-stream] Raw API response:', { result: JSON.stringify(result, null, 2) })

        const choice = result?.choices?.[0]
        const text = choice?.message?.content || ''

        logger.debug('[Qwen non-stream] Extracted content:', { text, hasContent: !!text, textLength: text.length })

        const response = {
          id: uuidv4(),
          object: 'chat.completion',
          created: Date.now(),
          model: result?.model || request.model || 'qwen3-coder-plus',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: text
              },
              finish_reason: choice?.finish_reason || 'stop'
            }
          ],
          usage: result?.usage || undefined
        }

        logger.debug('[Qwen non-stream] Final response:', { response: JSON.stringify(response, null, 2) })

        return res.json(response)
      } catch (error: any) {
        logger.error('Qwen API error:', { error })
        return res.status(500).json({
          error: {
            message: error?.message || 'Qwen API error',
            type: 'server_error',
            code: 'qwen_api_error'
          }
        })
      }
    }
  } catch (error: any) {
    logger.error('Qwen API chat error:', { error })
    return res.status(500).json({
      error: {
        message: error?.message || 'Internal server error',
        type: 'server_error',
        code: 'internal_error'
      }
    })
  }
})

router.get('/:cliName/models', async (req, res) => {
  const { cliName } = req.params
  if (cliName !== 'gemini' && cliName !== 'qwen') {
    return res.status(400).json({ error: 'Invalid CLI name' })
  }

  try {
    const models = await cliService.getModels(cliName as 'gemini' | 'qwen')

    // Transform to OpenAI models format
    const response = {
      object: 'list',
      data: models.map((m: any) => ({
        id: m.id || m.name || m,
        object: 'model',
        created: Date.now(),
        owned_by: cliName
      }))
    }

    return res.json(response)
  } catch (error: any) {
    return res.status(500).json({ error: error.message })
  }
})

export { router as cliRoutes }
