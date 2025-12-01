/**
 * 全局「组件提示词」编辑弹窗
 *
 * 用于编辑组件能力说明头部的大纲（Markdown 文本），
 * 最终会作为系统提示词的一部分注入到组件能力描述前面。
 */

import React, { useEffect, useState } from 'react'
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Textarea } from '@heroui/react'
import { FileText, RotateCcw, Save, X } from 'lucide-react'

import { componentService } from '@renderer/services/ComponentService'
import { DEFAULT_COMPONENTS_PROMPT_MARKDOWN_ZH } from '@renderer/types/component'

interface ComponentsPromptDialogProps {
  isOpen: boolean
  onClose: () => void
}

const ComponentsPromptDialog: React.FC<ComponentsPromptDialogProps> = ({ isOpen, onClose }) => {
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // 打开时从当前设置中读取提示词
  useEffect(() => {
    if (!isOpen) return

    setLoading(true)
    try {
      const settings = componentService.getComponentSettings()
      const currentPrompt = settings.componentsPromptMarkdown || DEFAULT_COMPONENTS_PROMPT_MARKDOWN_ZH
      setValue(currentPrompt)
    } catch (error) {
      console.error('Failed to load components prompt markdown:', error)
      setValue(DEFAULT_COMPONENTS_PROMPT_MARKDOWN_ZH)
    } finally {
      setLoading(false)
    }
  }, [isOpen])

  const handleClose = () => {
    if (saving) return
    onClose()
  }

  const handleReset = () => {
    setValue(DEFAULT_COMPONENTS_PROMPT_MARKDOWN_ZH)
    window.toast?.success?.('已恢复为默认组件提示词')
  }

  const handleSave = () => {
    try {
      setSaving(true)

      const settings = componentService.getComponentSettings()
      const updatedSettings = {
        ...settings,
        componentsPromptMarkdown: value.trim(),
        lastUpdated: Date.now()
      }

      componentService.updateComponentSettings(updatedSettings)

      window.toast?.success?.('组件提示词已保存')
      onClose()
    } catch (error) {
      console.error('Failed to save components prompt markdown:', error)
      window.toast?.error?.('保存组件提示词失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="3xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="flex items-center gap-3">
          <FileText size={20} />
          <div className="flex flex-col">
            <span className="font-semibold">组件提示词（系统大纲）</span>
            <span className="mt-1 text-default-500 text-xs">
              这里的内容会作为 System Prompt 的一部分，用于向大模型说明组件能力和使用方式。
            </span>
          </div>
        </ModalHeader>

        <ModalBody>
          <div className="mb-3 flex items-center justify-between">
            <span className="font-medium text-sm text-default-600">Markdown 文本</span>
            <Button
              size="sm"
              variant="flat"
              color="default"
              startContent={<RotateCcw size={14} />}
              onPress={handleReset}
              isDisabled={loading || saving}>
              恢复默认
            </Button>
          </div>

          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            minRows={12}
            maxRows={24}
            isDisabled={loading}
            variant="bordered"
            placeholder={loading ? '正在生成默认组件提示词...' : '在这里编写或优化你的组件提示词大纲，支持 Markdown。'}
            className="font-mono text-sm"
            classNames={{
              inputWrapper: [
                '!border-1',
                '!border-default-200',
                'data-[hover=true]:!border-default-300',
                'focus-within:!border-primary-500',
                '!shadow-none',
                'bg-default-50'
              ].join(' '),
              input: '!border-0 !outline-none focus-visible:!outline-none'
            }}
          />

          <div className="flex justify-between text-default-400 text-xs">
            <span>字符数: {value.length}</span>
            <span>行数: {value.split('\n').length}</span>
          </div>
        </ModalBody>

        <ModalFooter>
          <Button variant="light" onPress={handleClose} startContent={<X size={16} />} isDisabled={saving}>
            取消
          </Button>
          <Button
            color="primary"
            onPress={handleSave}
            startContent={<Save size={16} />}
            isDisabled={loading || saving || !value.trim()}>
            保存
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default ComponentsPromptDialog

