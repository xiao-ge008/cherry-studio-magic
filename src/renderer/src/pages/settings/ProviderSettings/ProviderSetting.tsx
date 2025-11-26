import OpenAIAlert from '@renderer/components/Alert/OpenAIAlert'
import { LoadingIcon } from '@renderer/components/Icons'
import { HStack } from '@renderer/components/Layout'
import { ApiKeyListPopup } from '@renderer/components/Popups/ApiKeyListPopup'
import { isEmbeddingModel, isRerankModel } from '@renderer/config/models'
import { PROVIDER_URLS } from '@renderer/config/providers'
import { useTheme } from '@renderer/context/ThemeProvider'
import { useAllProviders, useProvider, useProviders } from '@renderer/hooks/useProvider'
import { useTimer } from '@renderer/hooks/useTimer'
import i18n from '@renderer/i18n'
import AnthropicSettings from '@renderer/pages/settings/ProviderSettings/AnthropicSettings'
import { ModelList } from '@renderer/pages/settings/ProviderSettings/ModelList'
import { checkApi } from '@renderer/services/ApiService'
import { isProviderSupportAuth } from '@renderer/services/ProviderService'
import { useAppDispatch } from '@renderer/store'
import { updateWebSearchProvider } from '@renderer/store/websearch'
import { isSystemProvider } from '@renderer/types'
import { ApiKeyConnectivity, HealthStatus } from '@renderer/types/healthCheck'
import {
  formatApiHost,
  formatApiKeys,
  getFancyProviderName,
  isAnthropicProvider,
  isOpenAIProvider
} from '@renderer/utils'
import { formatErrorMessage } from '@renderer/utils/error'
import { Button, Divider, Flex, Input, Select, Space, Switch, Tooltip } from 'antd'
import Link from 'antd/es/typography/Link'
import { debounce, isEmpty } from 'lodash'
import { Bolt, Check, Settings2, SquareArrowOutUpRight, TriangleAlert } from 'lucide-react'
import { FC, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  SettingContainer,
  SettingHelpLink,
  SettingHelpText,
  SettingHelpTextRow,
  SettingSubtitle,
  SettingTitle
} from '..'
import ApiOptionsSettingsPopup from './ApiOptionsSettings/ApiOptionsSettingsPopup'
import AwsBedrockSettings from './AwsBedrockSettings'
import CliSystemPromptPopup from './CliSystemPromptPopup'
import CustomHeaderPopup from './CustomHeaderPopup'
import DMXAPISettings from './DMXAPISettings'
import GithubCopilotSettings from './GithubCopilotSettings'
import GPUStackSettings from './GPUStackSettings'
import LMStudioSettings from './LMStudioSettings'
import ProviderOAuth from './ProviderOAuth'
import SelectProviderModelPopup from './SelectProviderModelPopup'
import VertexAISettings from './VertexAISettings'

interface Props {
  providerId: string
}

const ProviderSetting: FC<Props> = ({ providerId }) => {
  const { provider, updateProvider, models } = useProvider(providerId)
  const allProviders = useAllProviders()
  const { updateProviders } = useProviders()
  const [apiHost, setApiHost] = useState(provider.apiHost)
  const [apiVersion, setApiVersion] = useState(provider.apiVersion)
  const { t, i18n: i18nextInstance } = useTranslation()
  const { theme } = useTheme()
  const { setTimeoutTimer } = useTimer()
  const dispatch = useAppDispatch()

  const isAzureOpenAI = provider.id === 'azure-openai' || provider.type === 'azure-openai'
  const isDmxapi = provider.id === 'dmxapi'
  const isCliProvider = provider.id === 'gemini-cli' || provider.id === 'qwen-cli'
  const hideApiInput = ['vertexai', 'aws-bedrock'].includes(provider.id)

  const providerConfig = PROVIDER_URLS[provider.id]
  const officialWebsite = providerConfig?.websites?.official
  const apiKeyWebsite = providerConfig?.websites?.apiKey
  const configedApiHost = providerConfig?.api?.url

  const fancyProviderName = getFancyProviderName(provider)

  const [localApiKey, setLocalApiKey] = useState(provider.apiKey)
  const [apiKeyConnectivity, setApiKeyConnectivity] = useState<ApiKeyConnectivity>({
    status: HealthStatus.NOT_CHECKED,
    checking: false
  })

  const updateWebSearchProviderKey = ({ apiKey }: { apiKey: string }) => {
    provider.id === 'zhipu' && dispatch(updateWebSearchProvider({ id: 'zhipu', apiKey: apiKey.split(',')[0] }))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedUpdateApiKey = useCallback(
    debounce((value) => {
      updateProvider({ apiKey: formatApiKeys(value) })
      updateWebSearchProviderKey({ apiKey: formatApiKeys(value) })
    }, 150),
    []
  )

  // 同步 provider.apiKey 到 localApiKey
  // 重置连通性检查状态
  useEffect(() => {
    setLocalApiKey(provider.apiKey)
    setApiKeyConnectivity({ status: HealthStatus.NOT_CHECKED })
  }, [provider.apiKey])

  // 同步 localApiKey 到 provider.apiKey（防抖）
  useEffect(() => {
    if (localApiKey !== provider.apiKey) {
      debouncedUpdateApiKey(localApiKey)
    }

    // 卸载时取消任何待执行的更新
    return () => debouncedUpdateApiKey.cancel()
  }, [localApiKey, provider.apiKey, debouncedUpdateApiKey])

  const isApiKeyConnectable = useMemo(() => {
    return apiKeyConnectivity.status === 'success'
  }, [apiKeyConnectivity])

  const moveProviderToTop = useCallback(
    (providerId: string) => {
      const reorderedProviders = [...allProviders]
      const index = reorderedProviders.findIndex((p) => p.id === providerId)

      if (index !== -1) {
        const updatedProvider = { ...reorderedProviders[index], enabled: true }
        reorderedProviders.splice(index, 1)
        reorderedProviders.unshift(updatedProvider)
        updateProviders(reorderedProviders)
      }
    },
    [allProviders, updateProviders]
  )

  const onUpdateApiHost = () => {
    if (apiHost.trim()) {
      updateProvider({ apiHost })
    } else {
      setApiHost(provider.apiHost)
    }
  }

  const onUpdateApiVersion = () => updateProvider({ apiVersion })

  const openApiKeyList = async () => {
    await ApiKeyListPopup.show({
      providerId: provider.id,
      title: `${fancyProviderName} ${t('settings.provider.api.key.list.title')}`
    })
  }

  const onCheckApi = async () => {
    // 如果存在多个密钥，直接打开管理窗口
    if (provider.apiKey.includes(',')) {
      await openApiKeyList()
      return
    }

    const modelsToCheck = models.filter((model) => !isEmbeddingModel(model) && !isRerankModel(model))

    if (isEmpty(modelsToCheck)) {
      window.toast.error({
        timeout: 5000,
        title: t('settings.provider.no_models_for_check')
      })
      return
    }

    const model = await SelectProviderModelPopup.show({ provider })

    if (!model) {
      window.toast.error(i18n.t('message.error.enter.model'))
      return
    }

    try {
      setApiKeyConnectivity((prev) => ({ ...prev, checking: true, status: HealthStatus.NOT_CHECKED }))
      await checkApi({ ...provider, apiHost }, model)

      window.toast.success({
        timeout: 2000,
        title: i18n.t('message.api.connection.success')
      })

      setApiKeyConnectivity((prev) => ({ ...prev, status: HealthStatus.SUCCESS }))
      setTimeoutTimer(
        'onCheckApi',
        () => {
          setApiKeyConnectivity((prev) => ({ ...prev, status: HealthStatus.NOT_CHECKED }))
        },
        3000
      )
    } catch (error: any) {
      window.toast.error({
        timeout: 8000,
        title: i18n.t('message.api.connection.failed')
      })

      setApiKeyConnectivity((prev) => ({ ...prev, status: HealthStatus.FAILED, error: formatErrorMessage(error) }))
    } finally {
      setApiKeyConnectivity((prev) => ({ ...prev, checking: false }))
    }
  }

  const onReset = () => {
    setApiHost(configedApiHost)
    updateProvider({ apiHost: configedApiHost })
  }

  const hostPreview = () => {
    if (apiHost.endsWith('#')) {
      return apiHost.replace('#', '')
    }
    if (provider.type === 'openai') {
      return formatApiHost(apiHost) + 'chat/completions'
    }

    if (provider.type === 'azure-openai') {
      return formatApiHost(apiHost) + 'openai/v1'
    }

    if (provider.type === 'anthropic') {
      return formatApiHost(apiHost) + 'messages'
    }
    return formatApiHost(apiHost) + 'responses'
  }

  // API key 连通性检查状态指示器，目前仅在失败时显示
  const renderStatusIndicator = () => {
    if (apiKeyConnectivity.checking || apiKeyConnectivity.status !== HealthStatus.FAILED) {
      return null
    }

    return (
      <Tooltip title={<ErrorOverlay>{apiKeyConnectivity.error}</ErrorOverlay>}>
        <TriangleAlert size={16} color="var(--color-status-warning)" />
      </Tooltip>
    )
  }

  useEffect(() => {
    if (provider.id === 'copilot') {
      return
    }
    setApiHost(provider.apiHost)
  }, [provider.apiHost, provider.id])

  const isAnthropicOAuth = () => provider.id === 'anthropic' && provider.authType === 'oauth'

  return (
    <SettingContainer theme={theme} style={{ background: 'var(--color-background)' }}>
      <SettingTitle>
        <Flex align="center" gap={8}>
          <ProviderName>{fancyProviderName}</ProviderName>
          {officialWebsite && (
            <Link target="_blank" href={providerConfig.websites.official} style={{ display: 'flex' }}>
              <Button type="text" size="small" icon={<SquareArrowOutUpRight size={14} />} />
            </Link>
          )}
          {!isSystemProvider(provider) && (
            <Tooltip title={t('settings.provider.api.options.label')}>
              <Button
                type="text"
                icon={<Bolt size={14} />}
                size="small"
                onClick={() => ApiOptionsSettingsPopup.show({ providerId: provider.id })}
              />
            </Tooltip>
          )}
        </Flex>
        <Switch
          value={provider.enabled}
          key={provider.id}
          onChange={(enabled) => {
            updateProvider({ apiHost, enabled })
            if (enabled) {
              moveProviderToTop(provider.id)
            }
          }}
        />
      </SettingTitle>
      <Divider style={{ width: '100%', margin: '10px 0' }} />
      {isProviderSupportAuth(provider) && <ProviderOAuth providerId={provider.id} />}
      {provider.id === 'openai' && <OpenAIAlert />}
      {isDmxapi && <DMXAPISettings providerId={provider.id} />}
      {provider.id === 'anthropic' && (
        <>
          <SettingSubtitle style={{ marginTop: 5 }}>{t('settings.provider.anthropic.auth_method')}</SettingSubtitle>
          <Select
            style={{ width: '40%', marginTop: 5, marginBottom: 10 }}
            value={provider.authType || 'apiKey'}
            onChange={(value) => updateProvider({ authType: value })}
            options={[
              { value: 'apiKey', label: t('settings.provider.anthropic.apikey') },
              { value: 'oauth', label: t('settings.provider.anthropic.oauth') }
            ]}
          />
          {provider.authType === 'oauth' && <AnthropicSettings />}
        </>
      )}
      {!hideApiInput && !isAnthropicOAuth() && (
        <>
          <SettingSubtitle
            style={{
              marginTop: 5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
            {t('settings.provider.api_key.label')}
            {provider.id !== 'copilot' && (
              <Tooltip title={t('settings.provider.api.key.list.open')} mouseEnterDelay={0.5}>
                <Button type="text" onClick={openApiKeyList} icon={<Settings2 size={16} />} />
              </Tooltip>
            )}
          </SettingSubtitle>
          <Space.Compact style={{ width: '100%', marginTop: 5 }}>
            <Input.Password
              value={localApiKey}
              placeholder={t('settings.provider.api_key.label')}
              onChange={(e) => setLocalApiKey(e.target.value)}
              spellCheck={false}
              autoFocus={provider.enabled && provider.apiKey === '' && !isProviderSupportAuth(provider)}
              disabled={provider.id === 'copilot'}
              suffix={renderStatusIndicator()}
            />
            <Button
              type={isApiKeyConnectable ? 'primary' : 'default'}
              ghost={isApiKeyConnectable}
              onClick={onCheckApi}
              disabled={!apiHost || apiKeyConnectivity.checking}>
              {apiKeyConnectivity.checking ? (
                <LoadingIcon />
              ) : apiKeyConnectivity.status === 'success' ? (
                <Check size={16} className="lucide-custom" />
              ) : (
                t('settings.provider.check')
              )}
            </Button>
          </Space.Compact>
          <SettingHelpTextRow style={{ justifyContent: 'space-between' }}>
            <HStack>
              {apiKeyWebsite && !isDmxapi && (
                <SettingHelpLink target="_blank" href={apiKeyWebsite}>
                  {t('settings.provider.get_api_key')}
                </SettingHelpLink>
              )}
            </HStack>
            <SettingHelpText>{t('settings.provider.api_key.tip')}</SettingHelpText>
          </SettingHelpTextRow>
          {!isDmxapi && !isAnthropicOAuth() && (
            <>
              <SettingSubtitle style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {isCliProvider
                  ? i18nextInstance.language?.toLowerCase().startsWith('zh')
                    ? 'API 服务器地址'
                    : 'API Server URL'
                  : t('settings.provider.api_host')}
                {!isCliProvider && (
                  <Button
                    type="text"
                    onClick={() => CustomHeaderPopup.show({ provider })}
                    icon={<Settings2 size={16} />}
                  />
                )}
              </SettingSubtitle>
              <Space.Compact style={{ width: '100%', marginTop: 5 }}>
                <Input
                  value={apiHost}
                  placeholder={isCliProvider ? configedApiHost : t('settings.provider.api_host')}
                  onChange={(e) => setApiHost(e.target.value)}
                  onBlur={onUpdateApiHost}
                />
                {!isEmpty(configedApiHost) && apiHost !== configedApiHost && (
                  <Button danger onClick={onReset}>
                    {i18nextInstance.language?.toLowerCase().startsWith('zh') ? '重置' : 'Reset'}
                  </Button>
                )}
              </Space.Compact>
              {isCliProvider && (
                <SettingHelpTextRow style={{ justifyContent: 'space-between', marginTop: 4 }}>
                  <SettingHelpText style={{ flex: 1 }}>
                    {i18nextInstance.language?.toLowerCase().startsWith('zh')
                      ? `默认地址：${configedApiHost}`
                      : `Default URL: ${configedApiHost}`}
                  </SettingHelpText>
                  <SettingHelpText style={{ minWidth: 'fit-content', marginLeft: 16 }}>
                    {i18nextInstance.language?.toLowerCase().startsWith('zh')
                      ? 'Cherry Studio API 服务器'
                      : 'Cherry Studio API Server'}
                  </SettingHelpText>
                </SettingHelpTextRow>
              )}
              {!isCliProvider && (isOpenAIProvider(provider) || isAnthropicProvider(provider)) && (
                <SettingHelpTextRow style={{ justifyContent: 'space-between' }}>
                  <SettingHelpText
                    style={{ marginLeft: 6, marginRight: '1em', whiteSpace: 'break-spaces', wordBreak: 'break-all' }}>
                    {hostPreview()}
                  </SettingHelpText>
                  <SettingHelpText style={{ minWidth: 'fit-content' }}>
                    {t('settings.provider.api.url.tip')}
                  </SettingHelpText>
                </SettingHelpTextRow>
              )}
            </>
          )}
        </>
      )}
      {isAzureOpenAI && (
        <>
          <SettingSubtitle>{t('settings.provider.api_version')}</SettingSubtitle>
          <Space.Compact style={{ width: '100%', marginTop: 5 }}>
            <Input
              value={apiVersion}
              placeholder="2024-xx-xx-preview"
              onChange={(e) => setApiVersion(e.target.value)}
              onBlur={onUpdateApiVersion}
            />
          </Space.Compact>
          <SettingHelpTextRow style={{ justifyContent: 'space-between' }}>
            <SettingHelpText style={{ minWidth: 'fit-content' }}>
              {t('settings.provider.azure.apiversion.tip')}
            </SettingHelpText>
          </SettingHelpTextRow>
        </>
      )}
      {isCliProvider && (
        <>
          <SettingSubtitle
            style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>
              {i18nextInstance.language?.toLowerCase().startsWith('zh')
                ? 'CLI 全局系统提示词'
                : 'CLI Global System Prompt'}
            </span>
            <Tooltip
              title={
                i18nextInstance.language?.toLowerCase().startsWith('zh')
                  ? '在全局编辑器中编辑'
                  : 'Edit in Global Editor'
              }
              mouseEnterDelay={0.5}>
              <Button
                type="text"
                size="small"
                icon={<Settings2 size={16} />}
                onClick={() => CliSystemPromptPopup.show({ providerId: provider.id })}
              />
            </Tooltip>
          </SettingSubtitle>
          <SettingHelpText style={{ marginBottom: 8 }}>
            {i18nextInstance.language?.toLowerCase().startsWith('zh')
              ? '这里的提示词会作为 system 消息，在每次调用这个 CLI 提供商之前自动附加到对话最前面。'
              : 'This prompt will be automatically added as a system message at the beginning of every conversation when using this CLI provider.'}
          </SettingHelpText>
          <Input.TextArea
            autoSize={{ minRows: 4, maxRows: 8 }}
            value={provider.cliSystemPrompt || ''}
            placeholder={
              i18nextInstance.language?.toLowerCase().startsWith('zh')
                ? '为此 CLI 提供商设置一个默认的系统提示词（可选）...\n\n示例：\n- 你是一个专业的编程助手\n- 请始终用中文回答\n- 代码注释请使用中文'
                : 'Set a default system prompt for this CLI provider (optional)...\n\nExample:\n- You are a professional programming assistant\n- Always respond in English\n- Use English for code comments'
            }
            onChange={(e) => updateProvider({ cliSystemPrompt: e.target.value })}
            style={{ fontFamily: 'Consolas, Monaco, Courier New, monospace' }}
          />
        </>
      )}
      {provider.id === 'lmstudio' && <LMStudioSettings />}
      {provider.id === 'gpustack' && <GPUStackSettings />}
      {provider.id === 'copilot' && <GithubCopilotSettings providerId={provider.id} />}
      {provider.id === 'aws-bedrock' && <AwsBedrockSettings />}
      {provider.id === 'vertexai' && <VertexAISettings providerId={provider.id} />}
      <ModelList providerId={provider.id} />
    </SettingContainer>
  )
}

const ProviderName = styled.span`
  font-size: 14px;
  font-weight: 500;
  margin-right: -2px;
`

const ErrorOverlay = styled.div`
  max-height: 200px;
  overflow-y: auto;
  max-width: 300px;
  word-wrap: break-word;
  user-select: text;
`

export default ProviderSetting
