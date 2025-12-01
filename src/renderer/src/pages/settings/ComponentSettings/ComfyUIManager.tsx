/**
 * ComfyUI组件管理界面
 * 实现工作流上传界面、组件配置编辑器、参数映射配置
 */

import React, { useState, useEffect } from 'react'
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Textarea,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Tooltip,
  Divider
} from '@heroui/react'
import { Plus, Upload, Edit, Trash2, Play, Settings, FileText } from 'lucide-react'

import { componentService } from '@renderer/services/ComponentService'
import { ComfyUIService } from '@renderer/services/ComfyUIService'

import ComfyUIDeleteConfirmModal from '@renderer/components/ComfyUIDeleteConfirmModal'
import type { ComfyUIComponentConfig } from '@renderer/types/component'
import type { WorkflowAnalysisResult, CreateComfyUIComponentRequest } from '@renderer/types/comfyui'

interface ComfyUIManagerProps {
  onClose?: () => void
}

const ComfyUIManager: React.FC<ComfyUIManagerProps> = ({ onClose }) => {
  const { isOpen, onOpen, onClose: onModalClose } = useDisclosure()
  const { isOpen: isDeleteModalOpen, onOpen: onDeleteModalOpen, onClose: onDeleteModalClose } = useDisclosure()

  // 状态管理
  const [components, setComponents] = useState<ComfyUIComponentConfig[]>([])
  const [loading, setLoading] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<WorkflowAnalysisResult | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [componentToDelete, setComponentToDelete] = useState<ComfyUIComponentConfig | null>(null)

  // 表单状态
  const [formData, setFormData] = useState({
    componentName: '',
    displayName: '',
    description: '',
    serverUrl: 'http://localhost:8188',
    apiKey: '',
    workflowJson: ''
  })

  // 加载组件列表
  const loadComponents = async () => {
    try {
      setLoading(true)
      await componentService.syncComfyUIComponents()
      const comfyUIComponents = componentService.getComfyUIComponents()
      setComponents(comfyUIComponents)
    } catch (error) {
      window.toast.error('加载组件列表失败: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadComponents()
  }, [])

  // 处理工作流文件上传
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      setFormData((prev) => ({ ...prev, workflowJson: text }))

      // 自动分析工作流
      if (formData.componentName) {
        await analyzeWorkflow()
      }
    } catch (error) {
      window.toast.error('文件读取失败: ' + (error as Error).message)
    }
  }

  // 分析工作流
  const analyzeWorkflow = async () => {
    if (!formData.workflowJson || !formData.componentName) {
      window.toast.error('请先填写组件名称和上传工作流文件')
      return
    }

    try {
      setIsAnalyzing(true)
      const comfyUIService = ComfyUIService.getInstance()
      const result = await comfyUIService.analyzeWorkflow(
        formData.componentName,
        formData.workflowJson,
        formData.description,
        formData.serverUrl,
        formData.apiKey
      )
      setAnalysisResult(result)
      window.toast.success('工作流分析完成')
    } catch (error) {
      window.toast.error('工作流分析失败: ' + (error as Error).message)
    } finally {
      setIsAnalyzing(false)
    }
  }

  // 创建组件
  const handleCreateComponent = async () => {
    if (!analysisResult) {
      window.toast.error('请先分析工作流')
      return
    }

    try {
      setLoading(true)

      // 检查组件名是否可用
      if (!componentService.isComponentNameAvailable(formData.componentName)) {
        window.toast.error('组件名已存在，请使用其他名称')
        return
      }

      // 构建创建请求
      const request: CreateComfyUIComponentRequest = {
        componentName: formData.componentName,
        displayName: formData.displayName || formData.componentName,
        description: formData.description,
        serverConfig: {
          url: formData.serverUrl,
          apiKey: formData.apiKey
        },
        workflowJson: formData.workflowJson,
        parameters: analysisResult.suggestedParameters ?? []
      }

      // 创建组件
      const comfyUIService = ComfyUIService.getInstance()
      const result = await comfyUIService.createComponent(request)

      window.toast.success(`组件 "${result.componentName}" 创建成功`)

      // 重新加载组件列表
      await loadComponents()

      // 重置表单
      setFormData({
        componentName: '',
        displayName: '',
        description: '',
        serverUrl: 'http://localhost:8188',
        apiKey: '',
        workflowJson: ''
      })
      setAnalysisResult(null)
      onModalClose()

      // 如果有外部关闭回调，也调用它来刷新父组件
      if (onClose) {
        onClose()
      }
    } catch (error) {
      window.toast.error('创建组件失败: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  // 打开删除确认对话框
  const handleDeleteComponent = (componentId: string) => {
    const component = components.find((c) => c.id === componentId)
    if (!component) {
      window.toast.error('组件不存在')
      return
    }

    setComponentToDelete(component)
    onDeleteModalOpen()
  }

  // 确认删除组件
  const handleConfirmDelete = async () => {
    if (!componentToDelete) return

    try {
      setLoading(true)

      // 删除组件
      const success = await componentService.deleteComfyUIComponent(componentToDelete.id)

      if (success) {
        window.toast.success(`组件 "${componentToDelete.name}" 删除成功`)
        await loadComponents()
        onDeleteModalClose()
        setComponentToDelete(null)
      } else {
        window.toast.error('删除组件失败')
      }
    } catch (error) {
      window.toast.error('删除组件失败: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  // 取消删除
  const handleCancelDelete = () => {
    setComponentToDelete(null)
    onDeleteModalClose()
  }

  // 测试组件
  const handleTestComponent = async () => {
    try {
      // 这里可以实现组件测试逻辑
      window.toast.info('测试功能开发中...')
    } catch (error) {
      window.toast.error('测试失败: ' + (error as Error).message)
    }
  }

  return (
    <div className="space-y-6">
      {/* 标题和操作按钮 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-2xl">ComfyUI 组件管理</h2>
          <p className="mt-1 text-default-500">管理和配置 ComfyUI 动态组件</p>
        </div>
        <div className="flex gap-2">
          <Button color="primary" startContent={<Plus size={16} />} onPress={onOpen}>
            新建组件
          </Button>
          <Button variant="bordered" startContent={<Settings size={16} />} onPress={loadComponents} isLoading={loading}>
            刷新列表
          </Button>
        </div>
      </div>

      {/* 组件列表 */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-lg">已创建的组件</h3>
        </CardHeader>
        <CardBody>
          {components.length === 0 ? (
            <div className="py-8 text-center">
              <FileText size={48} className="mx-auto mb-4 text-default-300" />
              <p className="text-default-500">暂无 ComfyUI 组件</p>
              <p className="mt-1 text-default-400 text-sm">点击"新建组件"开始创建</p>
            </div>
          ) : (
            <Table aria-label="ComfyUI组件列表">
              <TableHeader>
                <TableColumn>组件名称</TableColumn>
                <TableColumn>显示名称</TableColumn>
                <TableColumn>服务器</TableColumn>
                <TableColumn>参数数量</TableColumn>
                <TableColumn>状态</TableColumn>
                <TableColumn>操作</TableColumn>
              </TableHeader>
              <TableBody>
                {components.map((component) => (
                  <TableRow key={component.id}>
                    <TableCell>
                      <code className="rounded bg-default-100 px-2 py-1 text-sm">{component.componentName}</code>
                    </TableCell>
                    <TableCell>{component.name}</TableCell>
                    <TableCell>
                      <Tooltip content={component.serverUrl}>
                        <span className="text-default-500 text-sm">{new URL(component.serverUrl).host}</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell>{component.parameters.length}</TableCell>
                    <TableCell>
                      <Chip color={component.enabled ? 'success' : 'default'} variant="flat" size="sm">
                        {component.enabled ? '启用' : '禁用'}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Tooltip content="测试组件">
                          <Button isIconOnly size="sm" variant="light" onPress={handleTestComponent}>
                            <Play size={14} />
                          </Button>
                        </Tooltip>
                        <Tooltip content="编辑组件">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            onPress={() => {
                              /* TODO: 实现编辑功能 */
                            }}>
                            <Edit size={14} />
                          </Button>
                        </Tooltip>
                        <Tooltip content="删除组件">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color="danger"
                            onPress={() => handleDeleteComponent(component.id)}>
                            <Trash2 size={14} />
                          </Button>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* 创建组件模态框 */}
      <Modal isOpen={isOpen} onClose={onModalClose} size="4xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>创建 ComfyUI 组件</ModalHeader>
          <ModalBody className="space-y-4">
            {/* 基本信息 */}
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="组件名称"
                placeholder="image2image"
                description="英文名称，用于生成标签"
                value={formData.componentName}
                onChange={(e) => setFormData((prev) => ({ ...prev, componentName: e.target.value }))}
                isRequired
              />
              <Input
                label="显示名称"
                placeholder="图生图"
                value={formData.displayName}
                onChange={(e) => setFormData((prev) => ({ ...prev, displayName: e.target.value }))}
              />
            </div>

            <Textarea
              label="组件描述"
              placeholder="描述这个组件的功能..."
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              minRows={2}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="ComfyUI 服务器地址"
                placeholder="http://localhost:8188"
                value={formData.serverUrl}
                onChange={(e) => setFormData((prev) => ({ ...prev, serverUrl: e.target.value }))}
                isRequired
              />
              <Input
                label="API 密钥"
                placeholder="可选"
                type="password"
                value={formData.apiKey}
                onChange={(e) => setFormData((prev) => ({ ...prev, apiKey: e.target.value }))}
              />
            </div>

            <Divider />

            {/* 工作流上传 */}
            <div className="space-y-4">
              <h4 className="font-semibold">工作流配置</h4>

              <div className="flex gap-2">
                <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" id="workflow-upload" />
                <Button as="label" htmlFor="workflow-upload" variant="bordered" startContent={<Upload size={16} />}>
                  上传工作流 JSON
                </Button>
                <Button
                  color="primary"
                  onPress={analyzeWorkflow}
                  isLoading={isAnalyzing}
                  isDisabled={!formData.workflowJson || !formData.componentName}>
                  分析工作流
                </Button>
              </div>

              {formData.workflowJson && (
                <Textarea
                  label="工作流 JSON"
                  value={formData.workflowJson}
                  onChange={(e) => setFormData((prev) => ({ ...prev, workflowJson: e.target.value }))}
                  minRows={8}
                  maxRows={12}
                  className="font-mono text-sm"
                />
              )}
            </div>

            {/* 分析结果 */}
            {analysisResult && (
              <div className="space-y-4">
                <Divider />
                <h4 className="font-semibold">分析结果</h4>

                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardBody className="text-center">
                      <p className="font-bold text-2xl text-primary">{analysisResult.summary.totalNodes}</p>
                      <p className="text-default-500 text-sm">总节点数</p>
                    </CardBody>
                  </Card>
                  <Card>
                    <CardBody className="text-center">
                      <p className="font-bold text-2xl text-success">{analysisResult.summary.configurableNodes}</p>
                      <p className="text-default-500 text-sm">可配置节点</p>
                    </CardBody>
                  </Card>
                  <Card>
                    <CardBody className="text-center">
                      <p className="font-bold text-2xl text-warning">{analysisResult.summary.estimatedParameters}</p>
                      <p className="text-default-500 text-sm">预估参数</p>
                    </CardBody>
                  </Card>
                </div>

                {(analysisResult.suggestedParameters?.length ?? 0) > 0 && (
                  <div>
                    <h5 className="mb-2 font-medium">建议的参数配置</h5>
                    <div className="max-h-40 overflow-y-auto">
                      <Table aria-label="建议参数" removeWrapper>
                        <TableHeader>
                          <TableColumn>参数名</TableColumn>
                          <TableColumn>类型</TableColumn>
                          <TableColumn>描述</TableColumn>
                        </TableHeader>
                        <TableBody>
                          {(analysisResult.suggestedParameters ?? []).map((param, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <code className="text-xs">{param.name}</code>
                              </TableCell>
                              <TableCell>
                                <Chip size="sm" variant="flat">
                                  {param.type}
                                </Chip>
                              </TableCell>
                              <TableCell className="text-sm">{param.description}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onModalClose}>
              取消
            </Button>
            <Button color="primary" onPress={handleCreateComponent} isLoading={loading} isDisabled={!analysisResult}>
              创建组件
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 删除确认对话框 */}
      <ComfyUIDeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        component={componentToDelete}
        isLoading={loading}
      />
    </div>
  )
}

export default ComfyUIManager
