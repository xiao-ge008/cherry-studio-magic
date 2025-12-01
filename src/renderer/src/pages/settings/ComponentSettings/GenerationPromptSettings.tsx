import { Button, Card, CardBody, CardHeader, Textarea } from '@heroui/react'
import { loggerService } from '@logger'
import { componentService } from '@renderer/services/ComponentService'
import { DEFAULT_GENERATION_PROMPT_MARKDOWN_ZH } from '@renderer/types/component'
import { ChevronUp, Edit, RotateCcw, Save, Sparkles } from 'lucide-react'
import React, { useEffect, useState } from 'react'

const logger = loggerService.withContext('GenerationPromptSettings')

const GenerationPromptSettings: React.FC = () => {
  // const { t } = useTranslation()
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  // 加载提示词
  useEffect(() => {
    setLoading(true)
    try {
      const settings = componentService.getComponentSettings()
      const currentPrompt = settings.generationPromptMarkdown || DEFAULT_GENERATION_PROMPT_MARKDOWN_ZH
      setValue(currentPrompt)
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to load generation prompt markdown:', err)
      setValue(DEFAULT_GENERATION_PROMPT_MARKDOWN_ZH)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleReset = () => {
    setValue(DEFAULT_GENERATION_PROMPT_MARKDOWN_ZH)
    window.toast?.success?.('已恢复为默认智能生成提示词')
  }

  const handleSave = () => {
    try {
      setSaving(true)
      const settings = componentService.getComponentSettings()
      const updatedSettings = {
        ...settings,
        generationPromptMarkdown: value.trim(),
        lastUpdated: Date.now()
      }
      componentService.updateComponentSettings(updatedSettings)
      window.toast?.success?.('智能生成提示词已保存')
      setIsExpanded(false) // 保存后自动折叠
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to save generation prompt markdown:', err)
      window.toast?.error?.('保存智能生成提示词失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card
      className={`border border-default-200 shadow-sm transition-all duration-300 ${
        isExpanded ? 'bg-background' : 'bg-default-50/50 hover:bg-default-100/50'
      }`}>
      <CardHeader className="flex flex-col items-start gap-2 px-6 py-4">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`rounded-md p-2 transition-colors ${
                isExpanded ? 'bg-secondary-100 text-secondary' : 'bg-default-200 text-default-500'
              }`}>
              <Sparkles size={20} />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-lg">智能生成提示词</span>
              <span className="text-default-500 text-xs">
                {isExpanded
                  ? '用于"智能生成"功能，指导 AI 如何生成组件说明（用途、触发条件、使用方法）。'
                  : '配置"智能生成"功能的系统提示词 (System Prompt)'}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            {!isExpanded ? (
              <Button
                size="sm"
                color="default"
                variant="flat"
                onPress={() => setIsExpanded(true)}
                startContent={<Edit size={14} />}>
                修改配置
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="light"
                  onPress={() => setIsExpanded(false)}
                  startContent={<ChevronUp size={14} />}>
                  收起
                </Button>
                <Button
                  size="sm"
                  variant="flat"
                  color="default"
                  startContent={<RotateCcw size={14} />}
                  onPress={handleReset}
                  isDisabled={loading || saving}>
                  恢复默认
                </Button>
                <Button
                  size="sm"
                  color="secondary"
                  onPress={handleSave}
                  startContent={<Save size={14} />}
                  isLoading={saving}
                  isDisabled={loading || !value.trim()}>
                  保存配置
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardBody className="fade-in slide-in-from-top-2 animate-in px-6 pt-0 pb-6 duration-200">
          <div className="mb-4 h-px w-full bg-default-100" />
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            minRows={6}
            maxRows={20}
            isDisabled={loading}
            variant="bordered"
            placeholder={loading ? '正在加载...' : '在这里编写或优化你的智能生成提示词，支持 Markdown。'}
            className="font-mono text-sm"
            classNames={{
              inputWrapper: [
                '!border-1',
                '!border-default-200',
                'data-[hover=true]:!border-default-300',
                'focus-within:!border-secondary-500',
                '!shadow-none',
                'bg-default-50'
              ].join(' '),
              input: '!border-0 !outline-none focus-visible:!outline-none'
            }}
          />
          <div className="mt-2 flex justify-end text-default-400 text-xs">
            <span>
              {value.length} 字符 · {value.split('\n').length} 行
            </span>
          </div>
        </CardBody>
      )}
    </Card>
  )
}

export default GenerationPromptSettings
