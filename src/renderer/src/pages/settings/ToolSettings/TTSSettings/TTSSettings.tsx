import { FC } from 'react'
import { Input, Button } from '@heroui/react'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { setTTSServiceUrl } from '@renderer/store/settings'
import { SettingContainer, SettingDivider, SettingGroup, SettingRow, SettingRowTitle, SettingTitle } from '../..'
import { HStack } from '@renderer/components/Layout'
import { TestTube } from 'lucide-react'
import { useTheme } from '@renderer/context/ThemeProvider'

const TTSSettings: FC = () => {
    const dispatch = useAppDispatch()
  const { theme } = useTheme()
  const ttsServiceUrl = useAppSelector((state) => state.settings.ttsServiceUrl)

  const handleUrlChange = (value: string) => {
    dispatch(setTTSServiceUrl(value))
  }

  const testTTSService = async () => {
    try {
      const response = await window.api.tts.generateAudio({
        text: '这是一个TTS服务测试',
        speaker: 'default',
        emotion: 'neutral',
        url: ttsServiceUrl || 'http://localhost:9880/'
      })

      if (response.success) {
        window.toast.success('TTS服务连接成功！')
      } else {
        window.toast.error(`TTS服务测试失败: ${response.error}`)
      }
    } catch (error) {
      window.toast.error('TTS服务连接失败，请检查服务地址和网络连接')
    }
  }

  return (
    <SettingContainer theme={theme}>
      <SettingGroup theme={theme}>
        <SettingTitle>TTS语音服务设置</SettingTitle>
        <SettingDivider />
        <SettingRow>
          <SettingRowTitle>TTS服务地址</SettingRowTitle>
          <HStack gap="8px">
            <Input
              value={ttsServiceUrl}
              onValueChange={handleUrlChange}
              placeholder="http://localhost:9880/"
              variant="bordered"
              style={{ width: 300 }}
              classNames={{
                inputWrapper: [
                  'border-1',
                  'border-default-200',
                  'hover:border-default-300',
                  'group-data-[focus=true]:border-primary-500',
                  '!group-data-[focus=true]:border-1'
                ]
              }}
            />
            <Button
              size="sm"
              variant="flat"
              color="primary"
              startContent={<TestTube size={16} />}
              onPress={testTTSService}>
              测试连接
            </Button>
          </HStack>
        </SettingRow>
        <div style={{ fontSize: '12px', color: 'var(--color-text-2)', marginTop: '8px' }}>
          配置TTS服务的URL地址，所有audio-message组件将使用此地址进行语音合成
        </div>
      </SettingGroup>

      <SettingGroup theme={theme}>
        <SettingTitle>使用说明</SettingTitle>
        <SettingDivider />
        <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
          <p style={{ marginBottom: '12px' }}>配置完成后，在Markdown中使用audio-message组件时无需再指定url参数：</p>
          <pre
            style={{
              background: 'var(--color-background-soft)',
              padding: '12px',
              borderRadius: '6px',
              fontSize: '12px',
              overflow: 'auto'
            }}>
            {`<audio-message
  role="speech"
  text="你好，我是AI助手！"
  speaker="小雅"
  emo="friendly"
/>`}
          </pre>
          <p style={{ marginTop: '12px', fontSize: '12px', color: 'var(--color-text-2)' }}>
            不再需要url参数，系统会自动使用上面配置的TTS服务地址
          </p>
        </div>
      </SettingGroup>

      <SettingGroup theme={theme}>
        <SettingTitle>API接口规范</SettingTitle>
        <SettingDivider />
        <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
          <p style={{ marginBottom: '12px' }}>TTS服务需要支持以下API格式：</p>
          <pre
            style={{
              background: 'var(--color-background-soft)',
              padding: '12px',
              borderRadius: '6px',
              fontSize: '12px',
              overflow: 'auto'
            }}>
            GET {ttsServiceUrl || '{url}'}?text={'{text}'}&speaker={'{speaker}'}&emo={'{emotion}'}
          </pre>
          <p style={{ marginTop: '12px', fontSize: '12px', color: 'var(--color-text-2)' }}>
            服务应返回音频文件的二进制数据（audio/wav, audio/mp3等格式）
          </p>
        </div>
      </SettingGroup>
    </SettingContainer>
  )
}

export default TTSSettings
