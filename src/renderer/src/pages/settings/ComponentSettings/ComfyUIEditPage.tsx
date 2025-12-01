import { Button, Card, CardBody, CardHeader, Chip, Input, Switch, Textarea, Select, SelectItem } from '@heroui/react'
import { HStack, VStack } from '@renderer/components/Layout'
import { useAppSelector, useAppDispatch } from '@renderer/store'
import { updateComponentConfig } from '@renderer/store/settings'
import { ComfyUIComponentConfig } from '@renderer/types/component'
import { ArrowLeft, Save, Cpu, Settings } from 'lucide-react'
import { FC, useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { SettingContainer } from '..'


const ComfyUIEditPage: FC = () => {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { componentId } = useParams<{ componentId: string }>()

  const componentSettings = useAppSelector((state) => state.settings.componentSettings)
  const [editingComponent, setEditingComponent] = useState<ComfyUIComponentConfig | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (componentId && componentSettings?.components[componentId]) {
      const component = componentSettings.components[componentId]
      if (component.category === 'comfyui') {
        setEditingComponent({ ...component } as ComfyUIComponentConfig)
      }
    }
  }, [componentId, componentSettings])

  if (!componentId || !editingComponent) {
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

  const handleSave = () => {
    if (editingComponent) {
      dispatch(updateComponentConfig({ id: componentId, config: editingComponent }))
      setHasChanges(false)
      window.toast.success('ComfyUI 组件配置已保存')
    }
  }

  const handleBack = () => {
    if (hasChanges) {
      if (window.confirm('有未保存的更改，确定要离开吗？')) {
        navigate('/settings/components')
      }
    } else {
      navigate('/settings/components')
    }
  }

  const handleConfigureParameters = () => {
    // TODO: 跳转到参数配置页面
    navigate(`/settings/components/comfyui/configure/${componentId}`)
  }

  const updateComponent = (updates: Partial<ComfyUIComponentConfig>) => {
    setEditingComponent((prev) => (prev ? { ...prev, ...updates } : null))
    setHasChanges(true)
  }

  // 样式类定义（与内置组件编辑页面保持一致）
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
  const basicInputWrapperClass = `${baseInputWrapperClass} bg-default-100`
  const baseFieldInputClass = '!border-0 !outline-none focus-visible:!outline-none'

  return (
    <SettingContainer>
      <VStack gap="24px">
        {/* 页面头部 - 统一卡片样式 */}
        <Card className="w-full bg-gradient-to-r from-primary-50 to-secondary-50">
          <CardBody className="p-6">
            <HStack justifyContent="space-between" alignItems="center">
              <HStack gap="20px" alignItems="center">
                <Button size="sm" variant="flat" startContent={<ArrowLeft size={16} />} onPress={handleBack}>
                  返回
                </Button>
                <div>
                  <h2 className="flex items-center gap-3 font-semibold text-2xl">
                    <Cpu size={24} className="text-primary" />
                    编辑 ComfyUI 组件: {editingComponent.name}
                    <Chip size="sm" color="secondary" variant="flat">
                      ComfyUI
                    </Chip>
                  </h2>
                  <p className="mt-1 font-mono text-default-500 text-sm">
                    组件ID: &lt;comfyui-{editingComponent.componentName}&gt;
                  </p>
                </div>
              </HStack>

              <HStack gap="12px">
                <Button
                  size="sm"
                  variant="flat"
                  color="secondary"
                  startContent={<Settings size={16} />}
                  onPress={handleConfigureParameters}>
                  配置参数
                </Button>
                <Button
                  size="sm"
                  color="primary"
                  startContent={<Save size={16} />}
                  onPress={handleSave}
                  isDisabled={!hasChanges}>
                  保存更改
                </Button>
              </HStack>
            </HStack>
          </CardBody>
        </Card>

        {/* 基本信息 - 统一卡片样式 */}
        <Card className="w-full">
          <CardHeader className="pb-4">
            <h3 className="font-semibold text-lg">基本信息</h3>
          </CardHeader>
          <CardBody className="pt-0">
            <VStack gap="20px">
              <HStack gap="20px" className="w-full" alignItems="flex-end">
                <Input
                  label="组件名称"
                  value={editingComponent.name}
                  onValueChange={(value) => updateComponent({ name: value })}
                  className="flex-1"
                  variant="bordered"
                  classNames={{ inputWrapper: basicInputWrapperClass, input: baseFieldInputClass }}
                />
                <div className="flex min-w-[120px] flex-col items-center gap-2">
                  <span className="text-default-600 text-sm">启用状态</span>
                  <Switch
                    isSelected={editingComponent.enabled}
                    onValueChange={(enabled) => updateComponent({ enabled })}
                    color="success"
                    size="lg"
                  />
                </div>
              </HStack>

              <Input
                label="组件名"
                value={editingComponent.componentName}
                onValueChange={(value) => updateComponent({ componentName: value })}
                variant="bordered"
                description="英文，唯一标识"
                classNames={{ inputWrapper: basicInputWrapperClass, input: baseFieldInputClass }}
              />

              <Textarea
                label="组件描述"
                value={editingComponent.description}
                onValueChange={(value) => updateComponent({ description: value })}
                minRows={3}
                variant="bordered"
                classNames={{ inputWrapper: basicInputWrapperClass, input: baseFieldInputClass }}
              />
            </VStack>
          </CardBody>
        </Card>

        {/* 服务器配置 - 统一卡片样式 */}
        <Card className="w-full">
          <CardHeader className="pb-4">
            <h3 className="font-semibold text-lg">服务器配置</h3>
          </CardHeader>
          <CardBody className="pt-0">
            <VStack gap="20px">
              <Input
                label="服务器 URL"
                value={editingComponent.serverUrl}
                onValueChange={(value) => updateComponent({ serverUrl: value })}
                variant="bordered"
                classNames={{ inputWrapper: basicInputWrapperClass, input: baseFieldInputClass }}
              />
              <Input
                label="API Key"
                value={editingComponent.apiKey || ''}
                onValueChange={(value) => updateComponent({ apiKey: value })}
                variant="bordered"
                description="可选，用于认证"
                classNames={{ inputWrapper: basicInputWrapperClass, input: baseFieldInputClass }}
              />
              <Select
                label="输出类型"
                placeholder="选择组件输出类型"
                selectedKeys={[editingComponent.outputType || 'image']}
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0] as 'image' | 'video' | 'text'
                  updateComponent({ outputType: selected })
                }}
                variant="bordered"
                description="组件输出的内容类型">
                <SelectItem key="image">
                  🖼️ 图片
                </SelectItem>
                <SelectItem key="video">
                  🎬 视频
                </SelectItem>
                <SelectItem key="text">
                  📝 文字
                </SelectItem>
              </Select>
            </VStack>
          </CardBody>
        </Card>

        {/* 工作流信息 - 统一卡片样式 */}
        <Card className="w-full">
          <CardHeader className="pb-4">
            <h3 className="font-semibold text-lg">工作流信息</h3>
          </CardHeader>
          <CardBody className="pt-0">
            <VStack gap="16px">
              <div className="rounded-xl border border-default-200 bg-gradient-to-br from-default-50 to-default-100 p-4">
                <div className="flex flex-col gap-2">
                  <p className="font-medium text-default-700">工作流状态</p>
                  <p className="text-default-600 text-sm">
                    {editingComponent.workflowTemplate && Object.keys(editingComponent.workflowTemplate).length > 0
                      ? '✓ 工作流已加载'
                      : '⚠ 工作流未配置'}
                  </p>
                  <p className="text-default-500 text-xs">
                    参数绑定: {editingComponent.nodeBindings?.length || 0} 个 | 组件参数:{' '}
                    {editingComponent.parameters?.length || 0} 个
                  </p>
                </div>
              </div>

              <div className="text-center">
                <Button
                  variant="flat"
                  color="primary"
                  startContent={<Settings size={16} />}
                  onPress={handleConfigureParameters}>
                  配置工作流参数映射
                </Button>
              </div>
            </VStack>
          </CardBody>
        </Card>
      </VStack>
    </SettingContainer>
  )
}

export default ComfyUIEditPage