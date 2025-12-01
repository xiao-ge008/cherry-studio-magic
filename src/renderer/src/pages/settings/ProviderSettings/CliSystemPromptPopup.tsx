import GeneralPopup from '@renderer/components/Popups/GeneralPopup'
import { useProvider } from '@renderer/hooks/useProvider'
import { Button, Flex, Input } from 'antd'
import { Maximize2, Minimize2 } from 'lucide-react'
import { FC, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

interface Props {
  providerId: string
  onSave?: (prompt: string) => void
}

const CliSystemPromptPopup: FC<Props> = ({ providerId, onSave }) => {
  const { provider, updateProvider } = useProvider(providerId)
  const { i18n } = useTranslation()
  const [localPrompt, setLocalPrompt] = useState(provider.cliSystemPrompt || '')
  const [isFullscreen, setIsFullscreen] = useState(false)

  const isZh = i18n.language?.toLowerCase().startsWith('zh')

  const handleSave = () => {
    updateProvider({ cliSystemPrompt: localPrompt })
    onSave?.(localPrompt)
    CliSystemPromptPopupClass.hide()
  }

  const handleCancel = () => {
    CliSystemPromptPopupClass.hide()
  }

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  return (
    <PopupContainer $isFullscreen={isFullscreen}>
      <Header>
        <HeaderLeft>
          <Maximize2 size={20} style={{ marginRight: 8 }} />
          <Title>
            {isZh ? `${provider.name} - CLI 全局系统提示词` : `${provider.name} - CLI Global System Prompt`}
          </Title>
        </HeaderLeft>
        <HeaderRight>
          <Button
            type="text"
            size="small"
            icon={isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            onClick={toggleFullscreen}
            title={isZh ? (isFullscreen ? '退出全屏' : '全屏编辑') : isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          />
        </HeaderRight>
      </Header>

      {!isFullscreen && (
        <Description>
          {isZh
            ? '这里的提示词会作为 system 消息,在每次调用这个 CLI 提供商之前自动附加到对话最前面。可以用来设置 AI 的角色、语言偏好、输出格式等全局规则。'
            : 'This prompt will be automatically added to the beginning of every conversation as a system message when using this CLI provider. Use it to set AI role, language preferences, output format, and other global rules.'}
        </Description>
      )}

      <EditorContainer $isFullscreen={isFullscreen}>
        <StyledTextArea
          value={localPrompt}
          onChange={(e) => setLocalPrompt(e.target.value)}
          placeholder={
            isZh
              ? '示例：\n- 你是一个专业的编程助手\n- 请始终用中文回答\n- 代码注释请使用中文\n- 回答要简洁明了'
              : 'Example:\n- You are a professional programming assistant\n- Always respond in English\n- Use English for code comments\n- Keep answers concise and clear'
          }
          autoSize={isFullscreen ? false : { minRows: 12, maxRows: 20 }}
          autoFocus
          $isFullscreen={isFullscreen}
        />
      </EditorContainer>

      {!isFullscreen && (
        <InfoBox>
          <InfoTitle>{isZh ? '💡 使用提示' : '💡 Tips'}</InfoTitle>
          <ul>
            <li>
              {isZh
                ? '留空表示不设置全局系统提示词，CLI 将使用默认行为'
                : 'Leave empty to not set a global system prompt, CLI will use default behavior'}
            </li>
            <li>
              {isZh
                ? '这个提示词对该 CLI 提供商的所有对话都生效'
                : 'This prompt applies to all conversations using this CLI provider'}
            </li>
            <li>{isZh ? '可以使用换行和格式来提高可读性' : 'Use line breaks and formatting to improve readability'}</li>
            <li>
              {isZh
                ? '点击右上角按钮可切换全屏编辑模式'
                : 'Click the button in the top right corner to toggle fullscreen editing mode'}
            </li>
          </ul>
        </InfoBox>
      )}

      <Footer>
        <Flex gap={8}>
          <Button onClick={handleCancel}>{isZh ? '取消' : 'Cancel'}</Button>
          <Button type="primary" onClick={handleSave}>
            {isZh ? '保存' : 'Save'}
          </Button>
        </Flex>
      </Footer>
    </PopupContainer>
  )
}

const PopupContainer = styled.div<{ $isFullscreen: boolean }>`
  padding: ${(props) => (props.$isFullscreen ? '16px' : '24px')};
  min-width: ${(props) => (props.$isFullscreen ? '100%' : '600px')};
  max-width: ${(props) => (props.$isFullscreen ? '100%' : '800px')};
  height: ${(props) => (props.$isFullscreen ? 'calc(100vh - 32px)' : 'auto')};
  background: var(--color-background);
  display: flex;
  flex-direction: column;
  overflow: hidden;
`

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  flex-shrink: 0;
`

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
`

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const Title = styled.h2`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-1);
`

const Description = styled.p`
  margin: 0 0 20px 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-text-2);
  background: var(--color-background-soft);
  padding: 12px 16px;
  border-radius: 6px;
  border-left: 3px solid var(--color-primary);
  flex-shrink: 0;
`

const EditorContainer = styled.div<{ $isFullscreen: boolean }>`
  margin-bottom: ${(props) => (props.$isFullscreen ? '16px' : '20px')};
  flex: ${(props) => (props.$isFullscreen ? '1' : 'none')};
  display: flex;
  flex-direction: column;
  overflow: hidden;
`

const StyledTextArea = styled(Input.TextArea)<{ $isFullscreen: boolean }>`
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  resize: ${(props) => (props.$isFullscreen ? 'none' : 'vertical')};
  flex: ${(props) => (props.$isFullscreen ? '1' : 'none')};
  height: ${(props) => (props.$isFullscreen ? '100%' : 'auto')};

  &::placeholder {
    color: var(--color-text-3);
    font-style: italic;
  }

  textarea {
    height: ${(props) => (props.$isFullscreen ? '100% !important' : 'auto')};
  }
`

const InfoBox = styled.div`
  background: var(--color-background-soft);
  border: 1px dashed var(--color-border);
  border-radius: 6px;
  padding: 12px 16px;
  margin-bottom: 20px;
  flex-shrink: 0;

  ul {
    margin: 8px 0 0 0;
    padding-left: 20px;

    li {
      font-size: 13px;
      line-height: 1.8;
      color: var(--color-text-2);
    }
  }
`

const InfoTitle = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-1);
  margin-bottom: 4px;
`

const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
`

class CliSystemPromptPopupClass {
  static hide = GeneralPopup.hide

  static show(props: { providerId: string }): Promise<void> {
    return new Promise((resolve) => {
      GeneralPopup.show({
        content: <CliSystemPromptPopup {...props} onSave={() => resolve()} />,
        width: '90%',
        style: { maxWidth: '800px', top: 20 },
        footer: null,
        maskClosable: true,
        centered: false
      })
    })
  }
}

export default CliSystemPromptPopupClass
