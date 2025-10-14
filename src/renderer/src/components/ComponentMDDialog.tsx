/**
 * 组件MD生成对话框
 */

import React, { useState, useEffect } from 'react'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Textarea,
  Card,
  CardBody,
  Chip
} from '@heroui/react'
import { FileText, Copy, CheckCircle, X } from 'lucide-react'
import { VStack } from '@renderer/components/Layout'
import { componentService } from '@renderer/services/ComponentService'
import type { ComponentConfig } from '@renderer/types/component'

interface ComponentMDDialogProps {
  /** 是否显示对话框 */
  isOpen: boolean
  /** 关闭对话框回调 */
  onClose: () => void
  /** 组件配置 */
  component: ComponentConfig | null
}

const ComponentMDDialog: React.FC<ComponentMDDialogProps> = ({ isOpen, onClose, component }) => {
  const [mdContent, setMdContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  // 生成MD内容
  useEffect(() => {
    if (isOpen && component) {
      setLoading(true)
      try {
        const prompt = componentService.generateComponentPrompt(component.id, {
          includeExamples: true,
          includeParameterDetails: true,
          language: 'zh-CN',
          format: 'markdown'
        })
        setMdContent(prompt || '')
      } catch (error) {
        console.error('Failed to generate MD:', error)
        setMdContent('生成MD内容失败')
      } finally {
        setLoading(false)
      }
    }
  }, [isOpen, component])

  // 复制到剪贴板
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(mdContent)
      setCopied(true)
      window.toast.success('内容已复制到剪贴板')

      // 2秒后重置复制状态
      setTimeout(() => {
        setCopied(false)
      }, 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
      window.toast.error('复制失败')
    }
  }

  // 关闭对话框时重置状态
  const handleClose = () => {
    onClose()
    setCopied(false)
    setMdContent('')
  }

  if (!component) return null

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="4xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="flex items-center gap-3">
          <FileText size={20} />
          <div>
            <span>组件使用说明</span>
            <div className="mt-1 flex items-center gap-2">
              <Chip size="sm" color="primary" variant="flat">
                {component.name}
              </Chip>
              <Chip size="sm" color="secondary" variant="flat">
                {component.category === 'javascript'
                  ? 'JavaScript'
                  : component.category === 'comfyui'
                    ? 'ComfyUI'
                    : '内置组件'}
              </Chip>
            </div>
          </div>
        </ModalHeader>

        <ModalBody>
          <VStack gap="16px">
            {/* 说明卡片 */}
            <Card className="border border-primary-200 bg-primary-50">
              <CardBody className="p-4">
                <VStack gap="8px">
                  <h4 className="font-medium text-primary">使用说明</h4>
                  <ul className="space-y-1 text-primary-700 text-sm">
                    <li>• 以下是该组件的详细使用说明和示例</li>
                    <li>• 您可以编辑内容以适应您的需求</li>
                    <li>• 点击复制按钮将内容复制到剪贴板</li>
                    <li>• 可以直接粘贴到聊天界面或文档中使用</li>
                  </ul>
                </VStack>
              </CardBody>
            </Card>

            {/* MD内容编辑区 */}
            <div className="w-full">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium text-sm">Markdown 内容</span>
                <Button
                  size="sm"
                  color={copied ? 'success' : 'primary'}
                  variant="flat"
                  startContent={copied ? <CheckCircle size={14} /> : <Copy size={14} />}
                  onPress={handleCopy}
                  isDisabled={loading || !mdContent}>
                  {copied ? '已复制' : '复制内容'}
                </Button>
              </div>

              <Textarea
                value={mdContent}
                onChange={(e) => setMdContent(e.target.value)}
                placeholder={loading ? '正在生成内容...' : 'MD内容将显示在这里'}
                minRows={15}
                maxRows={25}
                className="font-mono"
                variant="bordered"
                isDisabled={loading}
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
            </div>

            {/* 字符统计 */}
            <div className="flex items-center justify-between text-default-500 text-xs">
              <span>字符数: {mdContent.length}</span>
              <span>行数: {mdContent.split('\n').length}</span>
            </div>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button variant="light" onPress={handleClose} startContent={<X size={16} />}>
            关闭
          </Button>
          <Button
            color="primary"
            onPress={handleCopy}
            isDisabled={loading || !mdContent}
            startContent={copied ? <CheckCircle size={16} /> : <Copy size={16} />}>
            {copied ? '已复制' : '复制内容'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default ComponentMDDialog
