import { loggerService } from '@logger'
import { Model } from '@renderer/types'
import {
  ChunkType,
  TextDeltaChunk,
  ThinkingCompleteChunk,
  ThinkingDeltaChunk,
  ThinkingStartChunk
} from '@renderer/types/chunk'
import { getLowerBaseModelName } from '@renderer/utils'
import { TagConfig, TagExtractor } from '@renderer/utils/tagExtraction'

import { CompletionsParams, CompletionsResult, GenericChunk } from '../schemas'
import { CompletionsContext, CompletionsMiddleware } from '../types'

const logger = loggerService.withContext('ThinkingTagExtractionMiddleware')

export const MIDDLEWARE_NAME = 'ThinkingTagExtractionMiddleware'

// 不同模型的思考标签配置
const reasoningTags: TagConfig[] = [
  { openingTag: '<think>', closingTag: '</think>', separator: '\n' },
  { openingTag: '<thought>', closingTag: '</thought>', separator: '\n' },
  { openingTag: '###Thinking', closingTag: '###Response', separator: '\n' },
  { openingTag: '?think?', closingTag: '?/think?', separator: '\n' },
  { openingTag: '<thinking>', closingTag: '</thinking>', separator: '\n' },
  { openingTag: '<seed:think>', closingTag: '</seed:think>', separator: '\n' }
]

const getAppropriateTag = (model?: Model): TagConfig => {
  const modelId = model?.id ? getLowerBaseModelName(model.id) : undefined

  // Qwen3 系列：你现在在提示词里用的是 <thinking>...</thinking>
  // 所以这里改成使用对应的标签配置（reasoningTags[4]）。
  if (modelId?.includes('qwen3')) return reasoningTags[4]

  if (modelId?.includes('gemini-2.5')) return reasoningTags[1]
  if (modelId?.includes('kimi-vl-a3b-thinking')) return reasoningTags[3]
  if (modelId?.includes('seed-oss-36b')) return reasoningTags[5]
  // 其他模型可以在这里增加各自的标签配置
  return reasoningTags[0] // 默认使用 <think> 标签
}

/**
 * 对文本中的思考标签进行提取的中间件
 *
 * 该中间件专门处理文本中的思考标签内容，如 <think>...</think>。
 * 主要用于支持带思维链标签的 provider。
 *
 * 职责：
 * 1. 从文本中提取思考标签内容
 * 2. 将标签内的内容转化为 THINKING_DELTA chunk
 * 3. 将标签外的内容视为普通文本
 * 4. 兼容不同模型使用的思考标签格式
 * 5. 在思考数据结束时发送 THINKING_COMPLETE 事件
 */
export const ThinkingTagExtractionMiddleware: CompletionsMiddleware =
  () =>
  (next) =>
  async (context: CompletionsContext, params: CompletionsParams): Promise<CompletionsResult> => {
    // 先执行后续中间件
    const result = await next(context, params)

    // 对响应流做思考标签提取
    if (result.stream) {
      const resultFromUpstream = result.stream as ReadableStream<GenericChunk>

      // 判断是否存在需要处理的流
      if (resultFromUpstream && resultFromUpstream instanceof ReadableStream) {
        // 获取当前模型的思考标签配置
        const model = params.assistant?.model
        const reasoningTag = getAppropriateTag(model)

        // 创建标签提取器
        const tagExtractor = new TagExtractor(reasoningTag)

        // thinking 状态
        let hasThinkingContent = false
        let thinkingStartTime = 0

        let accumulatingText = false
        let accumulatedThinkingContent = ''
        const processedStream = resultFromUpstream.pipeThrough(
          new TransformStream<GenericChunk, GenericChunk>({
            transform(chunk: GenericChunk, controller) {
              logger.silly('chunk', chunk)

              if (chunk.type === ChunkType.TEXT_DELTA) {
                const textChunk = chunk as TextDeltaChunk

                // 使用 TagExtractor 处理文本
                const extractionResults = tagExtractor.processText(textChunk.text)

                for (const extractionResult of extractionResults) {
                  if (extractionResult.complete && extractionResult.tagContentExtracted?.trim()) {
                    // 思考结束
                    // 重置文本累积状态
                    accumulatingText = false

                    // 发送 THINKING_COMPLETE 事件
                    const thinkingCompleteChunk: ThinkingCompleteChunk = {
                      type: ChunkType.THINKING_COMPLETE,
                      text: extractionResult.tagContentExtracted.trim(),
                      thinking_millsec: thinkingStartTime > 0 ? Date.now() - thinkingStartTime : 0
                    }
                    controller.enqueue(thinkingCompleteChunk)

                    // 重置思考状态
                    hasThinkingContent = false
                    thinkingStartTime = 0
                  } else if (extractionResult.content.length > 0) {
                    if (extractionResult.isTagContent) {
                      // 标签内思考内容
                      accumulatingText = false

                      // 第一次收到思考内容时记录开始时间
                      if (!hasThinkingContent) {
                        hasThinkingContent = true
                        thinkingStartTime = Date.now()
                        controller.enqueue({
                          type: ChunkType.THINKING_START
                        } as ThinkingStartChunk)
                      }

                      if (extractionResult.content?.trim()) {
                        accumulatedThinkingContent += extractionResult.content.trim()
                        const thinkingDeltaChunk: ThinkingDeltaChunk = {
                          type: ChunkType.THINKING_DELTA,
                          text: accumulatedThinkingContent,
                          thinking_millsec: thinkingStartTime > 0 ? Date.now() - thinkingStartTime : 0
                        }
                        controller.enqueue(thinkingDeltaChunk)
                      }
                    } else {
                      // 标签外的普通文本
                      // 在非累积状态下首次收到普通文本时，发送 TEXT_START
                      if (!accumulatingText) {
                        controller.enqueue({
                          type: ChunkType.TEXT_START
                        })
                        accumulatingText = true
                      }
                      // 发送清洗后的文本 delta
                      const cleanTextChunk: TextDeltaChunk = {
                        ...textChunk,
                        text: extractionResult.content
                      }
                      controller.enqueue(cleanTextChunk)
                    }
                  } else {
                    // 空内容，忽略
                  }
                }
              } else if (chunk.type !== ChunkType.TEXT_START) {
                // 非文本增量的 chunk 原样透传（包括 THINKING_* 等）
                accumulatingText = false
                controller.enqueue(chunk)
              } else {
                // TEXT_START chunk 直接跳过，由我们在需要时发送
              }
            },
            flush(controller) {
              // 处理剩余的思考内容
              const finalResult = tagExtractor.finalize()
              if (finalResult?.tagContentExtracted) {
                const thinkingCompleteChunk: ThinkingCompleteChunk = {
                  type: ChunkType.THINKING_COMPLETE,
                  text: finalResult.tagContentExtracted,
                  thinking_millsec: thinkingStartTime > 0 ? Date.now() - thinkingStartTime : 0
                }
                controller.enqueue(thinkingCompleteChunk)
              }
            }
          })
        )

        // 返回新的响应
        return {
          ...result,
          stream: processedStream
        }
      } else {
        logger.warn(`[${MIDDLEWARE_NAME}] No generic chunk stream to process or not a ReadableStream.`)
      }
    }
    return result
  }

