/**
 * 参数构建模块
 * 封装 AI SDK 的参数格式与业务逻辑
 */

import { vertexAnthropic } from '@ai-sdk/google-vertex/anthropic/edge'
import { vertex } from '@ai-sdk/google-vertex/edge'
import { WebSearchPluginConfig } from '@cherrystudio/ai-core/built-in/plugins'
import { isBaseProvider } from '@cherrystudio/ai-core/core/providers/schemas'
import { loggerService } from '@logger'
import {
  isGenerateImageModel,
  isOpenRouterBuiltInWebSearchModel,
  isReasoningModel,
  isSupportedReasoningEffortModel,
  isSupportedThinkingTokenClaudeModel,
  isSupportedThinkingTokenModel,
  isWebSearchModel
} from '@renderer/config/models'
import { getAssistantSettings, getDefaultModel } from '@renderer/services/AssistantService'
import { componentService } from '@renderer/services/ComponentService'
import store from '@renderer/store'
import { CherryWebSearchConfig } from '@renderer/store/websearch'
import { type Assistant, type MCPTool, type Provider } from '@renderer/types'
import type { StreamTextParams } from '@renderer/types/aiCoreTypes'
import { mapRegexToPatterns } from '@renderer/utils/blacklistMatchPattern'
import type { ModelMessage, Tool } from 'ai'
import { stepCountIs } from 'ai'

import { getAiSdkProviderId } from '../provider/factory'
import { setupToolsConfig } from '../utils/mcp'
import { buildProviderOptions } from '../utils/options'
import { getAnthropicThinkingBudget } from '../utils/reasoning'
import { buildProviderBuiltinWebSearchConfig } from '../utils/websearch'
import { getTemperature, getTopP } from './modelParameters'

const logger = loggerService.withContext('parameterBuilder')

type ProviderDefinedTool = Extract<Tool<any, any>, { type: 'provider-defined' }>

/**
 * 生成 AI SDK streamText 所需参数
 */
export async function buildStreamTextParams(
  sdkMessages: StreamTextParams['messages'] = [],
  assistant: Assistant,
  provider: Provider,
  options: {
    mcpTools?: MCPTool[]
    webSearchProviderId?: string
    webSearchConfig?: CherryWebSearchConfig
    requestOptions?: {
      signal?: AbortSignal
      timeout?: number
      headers?: Record<string, string>
    }
  } = {}
): Promise<{
  params: StreamTextParams
  modelId: string
  capabilities: {
    enableReasoning: boolean
    enableWebSearch: boolean
    enableGenerateImage: boolean
    enableUrlContext: boolean
  }
  webSearchPluginConfig?: WebSearchPluginConfig
}> {
  const { mcpTools } = options

  const model = assistant.model || getDefaultModel()
  const aiSdkProviderId = getAiSdkProviderId(provider)

  let { maxTokens } = getAssistantSettings(assistant)

  // 是否启用思维链 / reasoning
  const enableReasoning =
    ((isSupportedThinkingTokenModel(model) || isSupportedReasoningEffortModel(model)) &&
      assistant.settings?.reasoning_effort !== undefined) ||
    (isReasoningModel(model) && (!isSupportedThinkingTokenModel(model) || !isSupportedReasoningEffortModel(model)))

  // 是否启用 Web 搜索
  const hasExternalSearch = !!options.webSearchProviderId
  const enableWebSearch =
    !hasExternalSearch &&
    ((assistant.enableWebSearch && isWebSearchModel(model)) ||
      isOpenRouterBuiltInWebSearchModel(model) ||
      model.id.includes('sonar'))

  const enableUrlContext = assistant.enableUrlContext || false

  const enableGenerateImage = !!(isGenerateImageModel(model) && assistant.enableGenerateImage)

  let tools = setupToolsConfig(mcpTools)

  // 构造 web search 配置
  const webSearchConfig: CherryWebSearchConfig = {
    maxResults: store.getState().websearch.maxResults,
    excludeDomains: store.getState().websearch.excludeDomains,
    searchWithTime: store.getState().websearch.searchWithTime
  }

  const providerOptions = buildProviderOptions(assistant, model, provider, {
    enableReasoning,
    enableWebSearch,
    enableGenerateImage
  })

  // NOTE: ai-sdk 对 maxToken / budgetToken 有关系，需要为 reasoning 预留 token
  if (
    enableReasoning &&
    maxTokens !== undefined &&
    isSupportedThinkingTokenClaudeModel(model) &&
    (provider.type === 'anthropic' || provider.type === 'aws-bedrock')
  ) {
    maxTokens -= getAnthropicThinkingBudget(assistant, model)
  }

  let webSearchPluginConfig: WebSearchPluginConfig | undefined = undefined
  if (enableWebSearch) {
    if (isBaseProvider(aiSdkProviderId)) {
      webSearchPluginConfig = buildProviderBuiltinWebSearchConfig(aiSdkProviderId, webSearchConfig)
    }
    if (!tools) {
      tools = {}
    }
    if (aiSdkProviderId === 'google-vertex') {
      tools.google_search = vertex.tools.googleSearch({}) as ProviderDefinedTool
    } else if (aiSdkProviderId === 'google-vertex-anthropic') {
      tools.web_search = vertexAnthropic.tools.webSearch_20250305({
        maxUses: webSearchConfig.maxResults,
        blockedDomains: mapRegexToPatterns(webSearchConfig.excludeDomains)
      }) as ProviderDefinedTool
    }
  }

  // google-vertex url_context
  if (enableUrlContext && aiSdkProviderId === 'google-vertex') {
    if (!tools) {
      tools = {}
    }
    tools.url_context = vertex.tools.urlContext({}) as ProviderDefinedTool
  }

  // 组装基础参数
  const params: StreamTextParams = {
    messages: sdkMessages,
    maxOutputTokens: maxTokens,
    temperature: getTemperature(assistant, model),
    topP: getTopP(assistant, model),
    abortSignal: options.requestOptions?.signal,
    headers: options.requestOptions?.headers,
    providerOptions,
    stopWhen: stepCountIs(10),
    maxRetries: 0
  }
  if (tools) {
    params.tools = tools
  }

  // 组装系统提示词：基础 System Prompt + 选中的组件技能提示词
  let systemPrompt = assistant.prompt?.trim() || ''

  if (assistant.component_ids && assistant.component_ids.length > 0) {
    logger.info('component_ids for system prompt', { component_ids: assistant.component_ids })

    const componentsPrompt = componentService.generateComponentsPromptByIds(assistant.component_ids, {
      includeExamples: true,
      includeParameterDetails: true,
      language: 'zh-CN',
      format: 'markdown'
    })

    if (componentsPrompt) {
      logger.info('generated components skill prompt', { componentsPrompt })

      systemPrompt = systemPrompt
        ? `${systemPrompt}\n\n---\n\n${componentsPrompt}`
        : componentsPrompt
    } else {
      logger.info('no componentsPrompt generated for selected component_ids')
    }
  } else {
    logger.info('no component_ids set on assistant, skip components prompt')
  }

  if (systemPrompt) {
    params.system = systemPrompt
    logger.info('final system prompt', { system: systemPrompt })
  } else {
    logger.info('no system prompt set for this request')
  }

  logger.debug('params', params)

  return {
    params,
    modelId: model.id,
    capabilities: { enableReasoning, enableWebSearch, enableGenerateImage, enableUrlContext },
    webSearchPluginConfig
  }
}

/**
 * 兼容 generateText 的参数构建
 */
export async function buildGenerateTextParams(
  messages: ModelMessage[],
  assistant: Assistant,
  provider: Provider,
  options: {
    mcpTools?: MCPTool[]
    enableTools?: boolean
  } = {}
): Promise<any> {
  return await buildStreamTextParams(messages, assistant, provider, options)
}
