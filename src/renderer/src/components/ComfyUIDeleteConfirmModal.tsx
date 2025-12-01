/**
 * ComfyUI 组件删除确认对话框
 * 提供更详细的删除确认界面，显示将要删除的内容
 */

import React from 'react'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Card,
  CardBody,
  Chip,
  Divider
} from '@heroui/react'
import { AlertTriangle, Trash2, Database, Settings, Image } from 'lucide-react'
import type { ComfyUIComponentConfig } from '@renderer/types/component'

interface ComfyUIDeleteConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  component: ComfyUIComponentConfig | null
  isLoading?: boolean
}

const ComfyUIDeleteConfirmModal: React.FC<ComfyUIDeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  component,
  isLoading = false
}) => {
  if (!component) return null

  const deletionItems = [
    {
      icon: <Settings size={16} />,
      title: '组件配置',
      description: '组件的基本信息、名称、描述等配置'
    },
    {
      icon: <Database size={16} />,
      title: '工作流模板',
      description: 'ComfyUI 工作流 JSON 配置和节点连接'
    },
    {
      icon: <Settings size={16} />,
      title: '参数绑定',
      description: '组件参数与工作流节点的映射关系'
    },
    {
      icon: <Image size={16} />,
      title: '缓存图片',
      description: '该组件生成的所有缓存图片文件'
    }
  ]

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" isDismissable={!isLoading} hideCloseButton={isLoading}>
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <AlertTriangle className="text-danger" size={20} />
          <span>确认删除组件</span>
        </ModalHeader>

        <ModalBody className="space-y-4">
          {/* 组件信息卡片 */}
          <Card className="border-danger-200 bg-danger-50">
            <CardBody className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-lg">{component.name}</h4>
                  <p className="text-default-600 text-sm">
                    组件名: <code className="rounded bg-default-200 px-1 text-xs">{component.componentName}</code>
                  </p>
                </div>
                <Chip color="danger" variant="flat" size="sm">
                  即将删除
                </Chip>
              </div>

              <div className="flex gap-2 text-sm">
                <span className="text-default-500">服务器:</span>
                <span className="text-default-700">{new URL(component.serverUrl).host}</span>
              </div>

              <div className="flex gap-2 text-sm">
                <span className="text-default-500">参数数量:</span>
                <span className="text-default-700">{component.parameters.length} 个</span>
              </div>
            </CardBody>
          </Card>

          <Divider />

          {/* 删除内容说明 */}
          <div>
            <h5 className="mb-3 font-medium text-danger">此操作将删除以下内容：</h5>
            <div className="space-y-3">
              {deletionItems.map((item, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="flex-shrink-0 text-danger">{item.icon}</div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">{item.title}</p>
                    <p className="text-default-600 text-xs">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Divider />

          {/* 警告信息 */}
          <div className="rounded-lg bg-warning-50 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="flex-shrink-0 text-warning" size={16} />
              <div className="text-sm">
                <p className="font-medium text-warning-700">⚠️ 重要提醒</p>
                <p className="mt-1 text-warning-600">
                  此操作不可撤销！删除后，您需要重新上传工作流文件才能恢复该组件。
                </p>
              </div>
            </div>
          </div>
        </ModalBody>

        <ModalFooter>
          <Button variant="light" onPress={onClose} isDisabled={isLoading}>
            取消
          </Button>
          <Button color="danger" startContent={<Trash2 size={16} />} onPress={onConfirm} isLoading={isLoading}>
            确认删除
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default ComfyUIDeleteConfirmModal
