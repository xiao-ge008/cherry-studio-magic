import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Divider,
  Input,
  Textarea,
  Select,
  SelectItem,
  Switch,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter
} from '@heroui/react'
import { HStack, VStack } from '@renderer/components/Layout'
import { useAppSelector, useAppDispatch } from '@renderer/store'
import { updateComponentConfig } from '@renderer/store/settings'
import { ComfyUIComponentConfig, ComponentParameter, NodeParameterBinding } from '@renderer/types/component'
import { ComfyUINodeInfo } from '@renderer/types/comfyui'
import { WorkflowParser } from '@renderer/utils/workflowParser'
import { ArrowLeft, Settings, Plus, Trash2, Eye, EyeOff, Edit } from 'lucide-react'
import { FC, useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { SettingContainer } from '..'

const ComfyUIConfigurePage: FC = () => {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { componentId } = useParams<{ componentId: string }>()

  const componentSettings = useAppSelector((state) => state.settings.componentSettings)
  const [component, setComponent] = useState<ComfyUIComponentConfig | null>(null)
  const [nodes, setNodes] = useState<ComfyUINodeInfo[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [parameters, setParameters] = useState<ComponentParameter[]>([])
  const [nodeBindings, setNodeBindings] = useState<NodeParameterBinding[]>([])
  const [hasChanges, setHasChanges] = useState(false)
  const [showAllNodes, setShowAllNodes] = useState(false)

  // 参数配置表单状态
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)
  const [configingNodeId, setConfigingNodeId] = useState<string | null>(null)
  const [configingInputField, setConfigingInputField] = useState<string | null>(null)
  const [editingParameterName, setEditingParameterName] = useState<string | null>(null)

  interface ParameterFormState {
    name: string
    type: ComponentParameter['type']
    description: string
    required: boolean
    defaultValue: string
    enableDynamicPrefixSuffix: boolean
    dynamicPrefixDefault: string
    dynamicSuffixDefault: string
  }

  const [parameterForm, setParameterForm] = useState<ParameterFormState>({
    name: '',
    type: 'string' as ComponentParameter['type'],
    description: '',
    required: false,
    defaultValue: '',
    enableDynamicPrefixSuffix: false,
    dynamicPrefixDefault: '',
    dynamicSuffixDefault: ''
  })

  // 统一的样式类 - 参考 ComponentEditPage
  const baseInputWrapperClass = [
    '!border-1',
    '!border-default-200',
    'data-[hover=true]:!border-default-300',
    'focus-within:!border-primary-500',
    'group-data-[focus=true]:!border-primary-500',
    'group-data-[focus=true]:!border-1',
    '!shadow-none',
    'transition-colors'
  ].join(' ')
  const parameterInputWrapperClass = `${baseInputWrapperClass} bg-default-50`
  const baseSelectTriggerClass = [
    '!border-1',
    '!border-default-200',
    'data-[hover=true]:!border-default-300',
    'data-[focus=true]:!border-primary-500',
    'data-[open=true]:!border-primary-500',
    'data-[focus=true]:!border-1',
    'data-[open=true]:!border-1',
    '!shadow-none',
    'transition-colors'
  ].join(' ')
  const parameterSelectTriggerClass = `${baseSelectTriggerClass} bg-default-50`
  const baseFieldInputClass = '!border-0 !outline-none focus-visible:!outline-none'

  // 解析工作流
  useEffect(() => {
    if (componentId && componentSettings?.components[componentId]) {
      const comp = componentSettings.components[componentId]
      if (comp.category === 'comfyui') {
        const comfyComponent = comp as ComfyUIComponentConfig
        setComponent(comfyComponent)

        // 解析工作流节点
        if (comfyComponent.workflowTemplate && Object.keys(comfyComponent.workflowTemplate).length > 0) {
          const analysisResult = WorkflowParser.parseWorkflow(comfyComponent.workflowTemplate)
          setNodes(analysisResult.nodes)
        }

        // 加载现有配置
        setParameters([...comfyComponent.parameters])
        setNodeBindings([...comfyComponent.nodeBindings])
      }
    }
  }, [componentId, componentSettings])

  // 过滤显示的节点
  const displayNodes = useMemo(() => {
    return showAllNodes ? nodes : nodes.filter((node) => node.configurable)
  }, [nodes, showAllNodes])

  // 选中的节点信息
  const selectedNode = useMemo(() => {
    return nodes.find((node) => node.id === selectedNodeId) || null
  }, [nodes, selectedNodeId])

  if (!componentId || !component) {
    return (
      <SettingContainer>
        <div className="p-8 text-center">
          <p className="text-red-500">ComfyUI 组件不存在或未找到</p>
          <Button className="mt-4" onPress={() => navigate('/settings/components')}>
            返回组件列表
          </Button>
        </div>
      </SettingContainer>
    )
  }

  const handleBack = () => {
    if (hasChanges) {
      if (window.confirm('有未保存的更改，确定要离开吗？')) {
        navigate(`/settings/components/comfyui/edit/${componentId}`)
      }
    } else {
      navigate(`/settings/components/comfyui/edit/${componentId}`)
    }
  }

  // 打开参数配置表单
  const handleOpenParameterConfig = (nodeId: string, inputField: string) => {
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) return

    const currentValue = node.inputs[inputField]
    const parameterType = WorkflowParser.inferParameterType(inputField, currentValue)
    const defaultValue = WorkflowParser.generateDefaultValue(inputField, currentValue, parameterType)

    const suggestedName = `${node.class_type.toLowerCase()}_${inputField}`.replace(/[^a-zA-Z0-9_]/g, '_')
    const description = `${node.title || node.class_type} - ${inputField}`

    // 处理默认值显示
    let displayDefaultValue = ''
    if (typeof defaultValue === 'string') {
      // 如果字符串太长，截断显示
      displayDefaultValue = defaultValue.length > 50 ? defaultValue.substring(0, 50) + '...' : defaultValue
    } else if (typeof defaultValue === 'number') {
      displayDefaultValue = String(defaultValue)
    } else if (typeof defaultValue === 'boolean') {
      displayDefaultValue = String(defaultValue)
    } else {
      // 对象或数组，简化显示
      const jsonStr = JSON.stringify(defaultValue)
      displayDefaultValue = jsonStr.length > 50 ? jsonStr.substring(0, 50) + '...' : jsonStr
    }

    // 设置表单初始值
    setParameterForm({
      name: suggestedName,
      type: parameterType,
      description,
      required: false,
      defaultValue: displayDefaultValue,
      enableDynamicPrefixSuffix: false,
      dynamicPrefixDefault: '',
      dynamicSuffixDefault: ''
    })

    setConfigingNodeId(nodeId)
    setConfigingInputField(inputField)
    setEditingParameterName(null) // 清除编辑状态
    setIsConfigModalOpen(true)
  }

  // 编辑已存在的参数
  const handleEditParameter = (parameterName: string) => {
    const parameter = parameters.find((p) => p.name === parameterName)
    const binding = nodeBindings.find((b) => b.parameterName === parameterName)

    if (parameter && binding) {
      // 填充表单数据
      setParameterForm({
        name: parameter.name,
        type: parameter.type,
        description: parameter.description || '',
        required: parameter.required || false,
        defaultValue: parameter.defaultValue?.toString() || '',
        enableDynamicPrefixSuffix: binding.enableDynamicPrefixSuffix || false,
        dynamicPrefixDefault: binding.dynamicPrefixDefault || '',
        dynamicSuffixDefault: binding.dynamicSuffixDefault || ''
      })

      // 设置编辑状态
      setEditingParameterName(parameterName)
      setConfigingNodeId(binding.nodeId)
      setConfigingInputField(binding.inputField)
      setIsConfigModalOpen(true)
    }
  }

  // 保存参数配置
  const handleSaveParameterConfig = () => {
    if (!configingNodeId || !configingInputField) return

    // 验证参数名称 - 添加安全检查
    const paramName = (parameterForm.name || '').trim()
    if (!paramName) {
      window.toast.error('参数名称不能为空')
      return
    }

    // 检查参数名称是否已存在（编辑模式下排除当前参数）
    if (parameters.some((p) => p.name === paramName && p.name !== editingParameterName)) {
      window.toast.error('参数名称已存在，请使用不同的名称')
      return
    }

    // 验证参数名称格式（只允许字母、数字、下划线）
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(paramName)) {
      window.toast.error('参数名称只能包含字母、数字和下划线，且不能以数字开头')
      return
    }

    // 处理默认值
    let processedDefaultValue: string | number | boolean | undefined = parameterForm.defaultValue
    if (parameterForm.type === 'number') {
      const numValue = Number(parameterForm.defaultValue)
      if (isNaN(numValue)) {
        window.toast.error('数字类型的默认值必须是有效数字')
        return
      }
      processedDefaultValue = numValue
    } else if (parameterForm.type === 'boolean') {
      processedDefaultValue = parameterForm.defaultValue.toLowerCase() === 'true'
    }

    if (editingParameterName) {
      // 编辑模式：更新现有参数
      const updatedParameter: ComponentParameter = {
        name: paramName,
        type: parameterForm.type,
        description: (parameterForm.description || '').trim(),
        required: parameterForm.required,
        defaultValue: processedDefaultValue
      }

      const updatedBinding: NodeParameterBinding = {
        parameterName: paramName,
        nodeId: configingNodeId,
        inputField: configingInputField,
        description: (parameterForm.description || '').trim(),
        enableDynamicPrefixSuffix: parameterForm.enableDynamicPrefixSuffix,
        dynamicPrefixDefault: (parameterForm.dynamicPrefixDefault || '').trim() || undefined,
        dynamicSuffixDefault: (parameterForm.dynamicSuffixDefault || '').trim() || undefined
      }

      // 更新参数列表
      setParameters((prev) => prev.map((p) => (p.name === editingParameterName ? updatedParameter : p)))

      // 更新绑定列表
      setNodeBindings((prev) => prev.map((b) => (b.parameterName === editingParameterName ? updatedBinding : b)))

      // 处理动态前缀/后缀参数的变化（仅限 string 类型）
      if (parameterForm.type === 'string') {
        // 获取原始绑定信息
        const originalBinding = nodeBindings.find((b) => b.parameterName === editingParameterName)
        const wasEnabled = originalBinding?.enableDynamicPrefixSuffix || false
        const isEnabled = parameterForm.enableDynamicPrefixSuffix

        if (wasEnabled !== isEnabled) {
          // 状态发生变化，需要添加或删除前缀/后缀参数
          manageDynamicPrefixSuffixParams(
            paramName,
            isEnabled,
            (parameterForm.dynamicPrefixDefault || '').trim(),
            (parameterForm.dynamicSuffixDefault || '').trim(),
            (parameterForm.description || '').trim()
          )
        } else if (isEnabled) {
          // 状态未变化但仍启用，更新默认值
          const prefixParamName = `${paramName}_prefix`
          const suffixParamName = `${paramName}_suffix`

          setParameters((prev) =>
            prev.map((p) => {
              if (p.name === prefixParamName) {
                return { ...p, defaultValue: (parameterForm.dynamicPrefixDefault || '').trim() || '' }
              }
              if (p.name === suffixParamName) {
                return { ...p, defaultValue: (parameterForm.dynamicSuffixDefault || '').trim() || '' }
              }
              return p
            })
          )
        }
      }

      window.toast.success('参数已更新')
    } else {
      // 新增模式：添加新参数
      const newParameter: ComponentParameter = {
        name: paramName,
        type: parameterForm.type,
        description: (parameterForm.description || '').trim(),
        required: parameterForm.required,
        defaultValue: processedDefaultValue
      }

      const newBinding: NodeParameterBinding = {
        parameterName: paramName,
        nodeId: configingNodeId,
        inputField: configingInputField,
        description: (parameterForm.description || '').trim(),
        enableDynamicPrefixSuffix: parameterForm.enableDynamicPrefixSuffix,
        dynamicPrefixDefault: (parameterForm.dynamicPrefixDefault || '').trim() || undefined,
        dynamicSuffixDefault: (parameterForm.dynamicSuffixDefault || '').trim() || undefined
      }

      setParameters((prev) => [...prev, newParameter])
      setNodeBindings((prev) => [...prev, newBinding])

      // 如果启用了动态前缀/后缀，自动生成两个额外的参数
      if (parameterForm.enableDynamicPrefixSuffix && parameterForm.type === 'string') {
        manageDynamicPrefixSuffixParams(
          paramName,
          true,
          (parameterForm.dynamicPrefixDefault || '').trim(),
          (parameterForm.dynamicSuffixDefault || '').trim(),
          (parameterForm.description || '').trim()
        )
      }

      window.toast.success('参数已添加')
    }

    setHasChanges(true)

    // 关闭表单
    handleCloseModal()
  }

  // 关闭模态框并重置表单
  const handleCloseModal = () => {
    setIsConfigModalOpen(false)
    setConfigingNodeId(null)
    setConfigingInputField(null)
    setEditingParameterName(null) // 清除编辑状态
    // 重置表单
    setParameterForm({
      name: '',
      type: 'string',
      description: '',
      required: false,
      defaultValue: '',
      enableDynamicPrefixSuffix: false,
      dynamicPrefixDefault: '',
      dynamicSuffixDefault: ''
    })
  }

  // 删除参数
  const handleRemoveParameter = (parameterName: string) => {
    // 同时删除相关的前缀/后缀参数
    const prefixParamName = `${parameterName}_prefix`
    const suffixParamName = `${parameterName}_suffix`

    setParameters((prev) =>
      prev.filter((p) => p.name !== parameterName && p.name !== prefixParamName && p.name !== suffixParamName)
    )
    setNodeBindings((prev) => prev.filter((b) => b.parameterName !== parameterName))
    setHasChanges(true)
  }

  // 管理动态前缀/后缀参数
  const manageDynamicPrefixSuffixParams = (
    baseParamName: string,
    enable: boolean,
    prefixDefault: string,
    suffixDefault: string,
    description: string
  ) => {
    const prefixParamName = `${baseParamName}_prefix`
    const suffixParamName = `${baseParamName}_suffix`

    if (enable) {
      // 添加前缀/后缀参数（如果不存在）
      setParameters((prev) => {
        const hasPrefix = prev.some((p) => p.name === prefixParamName)
        const hasSuffix = prev.some((p) => p.name === suffixParamName)

        const newParams = [...prev]

        if (!hasPrefix) {
          newParams.push({
            name: prefixParamName,
            type: 'string',
            description: `${description} - 前缀`,
            required: false,
            defaultValue: prefixDefault || ''
          })
        }

        if (!hasSuffix) {
          newParams.push({
            name: suffixParamName,
            type: 'string',
            description: `${description} - 后缀`,
            required: false,
            defaultValue: suffixDefault || ''
          })
        }

        return newParams
      })
    } else {
      // 删除前缀/后缀参数
      setParameters((prev) => prev.filter((p) => p.name !== prefixParamName && p.name !== suffixParamName))
    }
  }

  // 保存配置
  const handleSave = () => {
    if (!component) return

    const updatedComponent: ComfyUIComponentConfig = {
      ...component,
      parameters,
      nodeBindings
    }

    dispatch(updateComponentConfig({ id: componentId!, config: updatedComponent }))
    setHasChanges(false)
    window.toast.success('参数配置已保存')
  }

  return (
    <SettingContainer>
      <VStack gap="24px">
        {/* 页面头部 */}
        <Card className="w-full bg-gradient-to-r from-primary-50 to-secondary-50">
          <CardBody className="p-6">
            <HStack justifyContent="space-between" alignItems="center">
              <HStack gap="20px" alignItems="center">
                <Button size="sm" variant="flat" startContent={<ArrowLeft size={16} />} onPress={handleBack}>
                  返回编辑
                </Button>
                <div>
                  <h2 className="flex items-center gap-3 font-semibold text-2xl">
                    <Settings size={24} className="text-primary" />
                    配置参数映射: {component.name}
                    <Chip size="sm" color="secondary" variant="flat">
                      ComfyUI
                    </Chip>
                  </h2>
                  <p className="mt-1 text-default-500 text-sm">将工作流节点映射到组件参数</p>
                </div>
              </HStack>
              <Button
                color="primary"
                startContent={<Settings size={16} />}
                onPress={handleSave}
                isDisabled={!hasChanges}>
                保存配置
              </Button>
            </HStack>
          </CardBody>
        </Card>

        {/* 主要内容区域 */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* 左侧：工作流节点列表 */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-4">
              <HStack justifyContent="space-between" alignItems="center" className="w-full">
                <h3 className="font-semibold text-lg">工作流节点</h3>
                <Button
                  size="sm"
                  variant="flat"
                  startContent={showAllNodes ? <EyeOff size={14} /> : <Eye size={14} />}
                  onPress={() => setShowAllNodes(!showAllNodes)}>
                  {showAllNodes ? '仅可配置' : '显示全部'}
                </Button>
              </HStack>
            </CardHeader>
            <CardBody className="pt-0">
              <VStack gap="8px">
                {displayNodes.length === 0 ? (
                  <div className="p-8 text-center text-default-500">
                    <p>没有找到工作流节点</p>
                    <p className="mt-2 text-xs">总节点数: {nodes.length}</p>
                    <p className="text-xs">显示模式: {showAllNodes ? '全部' : '仅可配置'}</p>
                  </div>
                ) : (
                  displayNodes.map((node) => (
                    <Card
                      key={node.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedNodeId === node.id ? 'border-primary-500 bg-primary-50' : 'border-default-200'
                      }`}
                      isPressable
                      onPress={() => setSelectedNodeId(node.id)}>
                      <CardBody className="p-3">
                        <VStack gap="4px">
                          <HStack justifyContent="space-between" alignItems="center">
                            <p className="font-medium text-sm">{node.title || node.class_type}</p>
                            <Chip size="sm" color={node.configurable ? 'success' : 'default'} variant="flat">
                              {node.configurable ? '可配置' : '只读'}
                            </Chip>
                          </HStack>
                          <p className="text-default-500 text-xs">节点 ID: {node.id}</p>
                          {node.configurable && (
                            <p className="text-default-600 text-xs">可配置字段: {node.configurableInputs.join(', ')}</p>
                          )}
                        </VStack>
                      </CardBody>
                    </Card>
                  ))
                )}
              </VStack>
            </CardBody>
          </Card>

          {/* 右侧：节点详情和参数配置 */}
          <div className="space-y-6 lg:col-span-2">
            {/* 节点详情 */}
            {selectedNode ? (
              <Card>
                <CardHeader className="pb-4">
                  <h3 className="font-semibold text-lg">节点详情: {selectedNode.title || selectedNode.class_type}</h3>
                </CardHeader>
                <CardBody className="pt-0">
                  <VStack gap="16px">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="font-medium text-default-700">节点 ID</p>
                        <p className="text-default-600">{selectedNode.id}</p>
                      </div>
                      <div>
                        <p className="font-medium text-default-700">节点类型</p>
                        <p className="text-default-600">{selectedNode.class_type}</p>
                      </div>
                    </div>

                    {selectedNode.configurable && (
                      <>
                        <Divider />
                        <div>
                          <h4 className="mb-3 font-medium text-default-700">可配置输入字段</h4>
                          <VStack gap="8px">
                            {selectedNode.configurableInputs.map((inputField) => {
                              const currentValue = selectedNode.inputs[inputField]
                              const isAlreadyMapped = nodeBindings.some(
                                (b) => b.nodeId === selectedNode.id && b.inputField === inputField
                              )

                              return (
                                <Card key={inputField} className="border border-default-200 p-3">
                                  <HStack justifyContent="space-between" alignItems="center">
                                    <div className="flex-1">
                                      <p className="font-medium text-sm">{inputField}</p>
                                      <p className="text-default-500 text-xs">当前值: {JSON.stringify(currentValue)}</p>
                                    </div>
                                    <Button
                                      size="sm"
                                      color={isAlreadyMapped ? 'danger' : 'primary'}
                                      variant="flat"
                                      startContent={isAlreadyMapped ? <Trash2 size={14} /> : <Plus size={14} />}
                                      onPress={() => {
                                        if (isAlreadyMapped) {
                                          const binding = nodeBindings.find(
                                            (b) => b.nodeId === selectedNode.id && b.inputField === inputField
                                          )
                                          if (binding) {
                                            handleRemoveParameter(binding.parameterName)
                                          }
                                        } else {
                                          handleOpenParameterConfig(selectedNode.id, inputField)
                                        }
                                      }}>
                                      {isAlreadyMapped ? '移除' : '配置'}
                                    </Button>
                                  </HStack>
                                </Card>
                              )
                            })}
                          </VStack>
                        </div>
                      </>
                    )}
                  </VStack>
                </CardBody>
              </Card>
            ) : (
              <Card>
                <CardBody className="p-8 text-center text-default-500">
                  <p>请选择一个节点查看详情</p>
                </CardBody>
              </Card>
            )}

            {/* 已配置参数列表 */}
            <Card>
              <CardHeader className="pb-4">
                <h3 className="font-semibold text-lg">已配置参数 ({parameters.length})</h3>
              </CardHeader>
              <CardBody className="pt-0">
                <VStack gap="12px">
                  {parameters.length === 0 ? (
                    <div className="p-8 text-center text-default-500">
                      <p>暂无配置参数</p>
                      <p className="mt-1 text-sm">选择节点并添加参数开始配置</p>
                    </div>
                  ) : (
                    parameters.map((param) => {
                      const binding = nodeBindings.find((b) => b.parameterName === param.name)
                      return (
                        <Card key={param.name} className="border border-default-200 p-4">
                          <VStack gap="12px">
                            <HStack justifyContent="space-between" alignItems="center">
                              <div>
                                <p className="font-medium">{param.name}</p>
                                <p className="text-default-600 text-sm">{param.description}</p>
                                {binding && (
                                  <p className="text-default-500 text-xs">
                                    绑定到: 节点 {binding.nodeId} → {binding.inputField}
                                  </p>
                                )}
                              </div>
                              <HStack gap="8px">
                                <Button
                                  size="sm"
                                  color="primary"
                                  variant="flat"
                                  startContent={<Edit size={14} />}
                                  onPress={() => handleEditParameter(param.name)}>
                                  编辑
                                </Button>
                                <Button
                                  size="sm"
                                  color="danger"
                                  variant="flat"
                                  startContent={<Trash2 size={14} />}
                                  onPress={() => handleRemoveParameter(param.name)}>
                                  删除
                                </Button>
                              </HStack>
                            </HStack>
                            <div className="grid grid-cols-3 gap-3 text-sm">
                              <div>
                                <p className="font-medium text-default-700">类型</p>
                                <p className="text-default-600">{param.type}</p>
                              </div>
                              <div>
                                <p className="font-medium text-default-700">必需</p>
                                <p className="text-default-600">{param.required ? '是' : '否'}</p>
                              </div>
                              <div>
                                <p className="font-medium text-default-700">默认值</p>
                                <p className="text-default-600">{JSON.stringify(param.defaultValue)}</p>
                              </div>
                            </div>
                          </VStack>
                        </Card>
                      )
                    })
                  )}
                </VStack>
              </CardBody>
            </Card>
          </div>
        </div>

        {/* 参数配置模态框 */}
        <Modal isOpen={isConfigModalOpen} onClose={handleCloseModal} size="2xl" scrollBehavior="inside">
          <ModalContent>
            <ModalHeader className="flex flex-col gap-1">
              <h3 className="font-semibold text-lg">{editingParameterName ? '编辑参数映射' : '配置参数映射'}</h3>
              <p className="text-default-500 text-sm">
                节点: {configingNodeId} → 字段: {configingInputField}
                {editingParameterName && <span className="ml-2 text-primary-500">(编辑: {editingParameterName})</span>}
              </p>
            </ModalHeader>
            <ModalBody>
              <VStack gap="20px">
                {/* 参数名称 */}
                <Input
                  label="参数名称"
                  placeholder="例如: scene_info"
                  description="API调用时使用的参数名，将用于 <comfyui-xxx 参数名=值 />"
                  value={parameterForm.name}
                  onValueChange={(value) => setParameterForm((prev) => ({ ...prev, name: value }))}
                  variant="bordered"
                  isRequired
                  classNames={{ inputWrapper: parameterInputWrapperClass, input: baseFieldInputClass }}
                />

                {/* 数据类型 */}
                <Select
                  label="数据类型"
                  placeholder="选择参数类型"
                  selectedKeys={[parameterForm.type]}
                  onSelectionChange={(keys) => {
                    const type = Array.from(keys)[0] as ComponentParameter['type']
                    setParameterForm((prev) => ({ ...prev, type }))
                  }}
                  variant="bordered"
                  classNames={{ trigger: parameterSelectTriggerClass }}>
                  <SelectItem key="string">
                    字符串
                  </SelectItem>
                  <SelectItem key="number">
                    数字
                  </SelectItem>
                  <SelectItem key="boolean">
                    布尔值
                  </SelectItem>
                  <SelectItem key="url">
                    URL
                  </SelectItem>
                </Select>

                {/* 参数描述 */}
                <Textarea
                  label="参数描述"
                  placeholder="传入简短的场景信息，使用英文，比如 beautiful garden，简短不超过 20个字符"
                  description="为AI MCP理解提供清晰的参数说明"
                  value={parameterForm.description}
                  onValueChange={(value) => setParameterForm((prev) => ({ ...prev, description: value }))}
                  variant="bordered"
                  minRows={3}
                  classNames={{ inputWrapper: parameterInputWrapperClass, input: baseFieldInputClass }}
                />

                {/* 默认值 */}
                <Input
                  label="参数的默认值"
                  placeholder="beautiful garden"
                  value={parameterForm.defaultValue}
                  onValueChange={(value) => setParameterForm((prev) => ({ ...prev, defaultValue: value }))}
                  variant="bordered"
                  classNames={{ inputWrapper: parameterInputWrapperClass, input: baseFieldInputClass }}
                />

                {/* 必需参数开关 */}
                <div className="flex items-center justify-between rounded-lg border border-default-200 p-3">
                  <div>
                    <p className="font-medium">必需参数</p>
                    <p className="text-default-500 text-sm">是否为必填参数</p>
                  </div>
                  <Switch
                    isSelected={parameterForm.required}
                    onValueChange={(checked) => setParameterForm((prev) => ({ ...prev, required: checked }))}
                    color="primary"
                  />
                </div>

                {/* 动态前缀/后缀配置 - 仅限 string 类型 */}
                {parameterForm.type === 'string' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-default-700">动态前缀/后缀参数</h4>
                        <p className="text-default-500 text-sm">
                          启用后将自动生成 {parameterForm.name}_prefix 和 {parameterForm.name}_suffix 参数
                        </p>
                      </div>
                      <Switch
                        isSelected={parameterForm.enableDynamicPrefixSuffix}
                        onValueChange={(checked) =>
                          setParameterForm((prev) => ({ ...prev, enableDynamicPrefixSuffix: checked }))
                        }
                        color="primary"
                      />
                    </div>

                    {parameterForm.enableDynamicPrefixSuffix && (
                      <div className="space-y-3 border-primary-200 border-l-2 pl-4">
                        <Input
                          label="前缀参数默认值"
                          placeholder="例如: beautiful, masterpiece"
                          value={parameterForm.dynamicPrefixDefault}
                          onValueChange={(value) =>
                            setParameterForm((prev) => ({ ...prev, dynamicPrefixDefault: value }))
                          }
                          variant="bordered"
                          classNames={{ inputWrapper: parameterInputWrapperClass, input: baseFieldInputClass }}
                          description="用户可以通过 {参数名}_prefix 参数动态传入前缀"
                        />

                        <Input
                          label="后缀参数默认值"
                          placeholder="例如: high quality, detailed"
                          value={parameterForm.dynamicSuffixDefault}
                          onValueChange={(value) =>
                            setParameterForm((prev) => ({ ...prev, dynamicSuffixDefault: value }))
                          }
                          variant="bordered"
                          classNames={{ inputWrapper: parameterInputWrapperClass, input: baseFieldInputClass }}
                          description="用户可以通过 {参数名}_suffix 参数动态传入后缀"
                        />
                      </div>
                    )}
                  </div>
                )}
              </VStack>
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onPress={handleCloseModal}>
                取消
              </Button>
              <Button
                color="primary"
                onPress={handleSaveParameterConfig}
                isDisabled={!(parameterForm.name || '').trim()}>
                {editingParameterName ? '保存编辑' : '保存绑定'}
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </VStack>
    </SettingContainer>
  )
}

export default ComfyUIConfigurePage
