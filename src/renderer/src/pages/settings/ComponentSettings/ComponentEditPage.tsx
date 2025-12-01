import { Button, Card, CardBody, CardHeader, Chip, Input, Select, SelectItem, Switch, Textarea } from '@heroui/react'
import { loggerService } from '@logger'
import { HStack, VStack } from '@renderer/components/Layout'
import { useAppSelector, useAppDispatch } from '@renderer/store'
import { updateComponentConfig } from '@renderer/store/settings'
import { ComponentConfig, ComponentParameter } from '@renderer/types/component'
import { componentService } from '@renderer/services/ComponentService'
import { ArrowLeft, FileText, Plus, Save, Trash2, Package } from 'lucide-react'
import { FC, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'

import { SettingContainer } from '..'

const logger = loggerService.withContext('ComponentEditPage')

const ComponentEditPage: FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { componentId } = useParams<{ componentId: string }>()

  const componentSettings = useAppSelector((state) => state.settings.componentSettings)
  const [editingComponent, setEditingComponent] = useState<ComponentConfig | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (componentId && componentSettings?.components[componentId]) {
      setEditingComponent({ ...componentSettings.components[componentId] })
    }
  }, [componentId, componentSettings])

  if (!componentId || !editingComponent) {
    return (
      <SettingContainer>
        <div className="p-8 text-center">
          <p className="text-red-500">组件不存在或未找到</p>
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
      window.toast.success('组件配置已保存')
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

  const handleGenerateMD = async () => {
    try {
      const prompt = componentService.generateComponentPrompt(editingComponent.id, {
        includeExamples: true,
        includeParameterDetails: true,
        language: 'zh-CN',
        format: 'markdown'
      })

      if (prompt) {
        await componentService.copyToClipboard(prompt)
        window.toast.success(t('settings.components.prompt.copied'))
      } else {
        window.toast.error('生成MD失败')
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Generate MD error:', err)
      window.toast.error('生成MD时出错')
    }
  }

  const updateComponent = (updates: Partial<ComponentConfig>) => {
    setEditingComponent((prev) => (prev ? { ...prev, ...updates } : null))
    setHasChanges(true)
  }

  // URL修改自动保存
  const updateUrl = (url: string) => {
    const updatedComponent = { ...editingComponent!, url }

    // 立即保存到Redux store
    dispatch(updateComponentConfig({ id: componentId, config: updatedComponent }))

    // 更新本地状态
    setEditingComponent(updatedComponent)

    window.toast.success('TTS服务URL已保存')
  }

  const addParameter = () => {
    const newParam: ComponentParameter = {
      name: '',
      type: 'string',
      description: '',
      required: false,
      defaultValue: ''
    }
    const newParams = [...editingComponent.parameters, newParam]
    const updatedComponent = { ...editingComponent, parameters: newParams }

    // 立即保存到Redux store，让useEffect自动更新本地状态
    dispatch(updateComponentConfig({ id: componentId, config: updatedComponent }))

    window.toast.success('参数已添加并保存')
  }

  const updateParameter = (index: number, updates: Partial<ComponentParameter>) => {
    const newParams = [...editingComponent.parameters]
    newParams[index] = { ...newParams[index], ...updates }
    updateComponent({ parameters: newParams })
  }

  const removeParameter = (index: number) => {
    const newParams = editingComponent.parameters.filter((_, i) => i !== index)
    const updatedComponent = { ...editingComponent, parameters: newParams }

    console.log('删除参数前:', editingComponent.parameters.length)
    console.log('删除参数后:', newParams.length)
    console.log('组件ID:', componentId)
    console.log('更新的组件配置:', updatedComponent)

    // 立即保存到Redux store，让useEffect自动更新本地状态
    dispatch(updateComponentConfig({ id: componentId, config: updatedComponent }))

    window.toast.success('参数已删除并保存')
  }

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
                    <Package size={24} className="text-primary" />
                    编辑组件: {editingComponent.name}
                    {editingComponent.builtin && (
                      <Chip size="sm" color="primary" variant="flat">
                        内置组件
                      </Chip>
                    )}
                  </h2>
                  <p className="mt-1 font-mono text-default-500 text-sm">组件ID: &lt;{editingComponent.id}&gt;</p>
                </div>
              </HStack>

              <HStack gap="12px">
                <Button
                  size="sm"
                  variant="flat"
                  color="secondary"
                  startContent={<FileText size={16} />}
                  onPress={handleGenerateMD}>
                  生成MD
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

              <Textarea
                label="组件描述"
                value={editingComponent.description}
                onValueChange={(value) => updateComponent({ description: value })}
                minRows={3}
                variant="bordered"
                classNames={{ inputWrapper: basicInputWrapperClass, input: baseFieldInputClass }}
              />

              {/* Audio Message 组件的URL配置 */}
              {componentId === 'audio-message' && (
                <Input
                  label="TTS服务URL"
                  value={editingComponent.url || 'http://localhost:9880/'}
                  onValueChange={updateUrl}
                  variant="bordered"
                  description="配置TTS服务的URL地址，用于语音合成"
                  classNames={{ inputWrapper: basicInputWrapperClass, input: baseFieldInputClass }}
                />
              )}
            </VStack>
          </CardBody>
        </Card>

        {/* 参数配置 - 统一卡片样式 */}
        <Card className="w-full">
          <CardHeader className="pb-4">
            <HStack justifyContent="space-between" alignItems="center">
              <h3 className="font-semibold text-lg">参数配置</h3>
              <Button size="sm" variant="flat" color="primary" startContent={<Plus size={16} />} onPress={addParameter}>
                添加参数
              </Button>
            </HStack>
          </CardHeader>
          <CardBody className="pt-0">
            <VStack gap="16px">
              {editingComponent.parameters.length === 0 ? (
                <div className="rounded-xl border border-default-300 border-dashed bg-gradient-to-br from-default-50 to-default-100 p-12 text-center text-default-500">
                  <div className="flex flex-col items-center gap-3">
                    <Package size={32} className="text-default-400" />
                    <p className="font-medium text-lg">暂无参数</p>
                    <p className="text-sm">点击"添加参数"开始配置组件参数</p>
                  </div>
                </div>
              ) : (
                editingComponent.parameters.map((param, index) => (
                  <Card
                    key={index}
                    className="w-full border border-default-200 bg-gradient-to-r from-white to-default-50 p-4 shadow-sm transition-shadow hover:shadow-md">
                    <VStack gap="12px">
                      <HStack gap="12px" className="w-full">
                        <Input
                          label="参数名"
                          value={param.name}
                          onValueChange={(value) => updateParameter(index, { name: value })}
                          className="flex-1"
                          variant="bordered"
                          classNames={{ inputWrapper: parameterInputWrapperClass, input: baseFieldInputClass }}
                        />
                        <Select
                          label="类型"
                          selectedKeys={[param.type]}
                          onSelectionChange={(keys) => {
                            const type = Array.from(keys)[0] as string
                            updateParameter(index, { type: type as any })
                          }}
                          className="w-32"
                          variant="bordered"
                          classNames={{ trigger: parameterSelectTriggerClass }}>
                          <SelectItem key="string">字符串</SelectItem>
                          <SelectItem key="boolean">布尔值</SelectItem>
                          <SelectItem key="number">数字</SelectItem>
                          <SelectItem key="array">数组</SelectItem>
                        </Select>
                        <div className="flex min-w-[80px] flex-col items-center gap-2">
                          <span className="text-default-600 text-xs">必需</span>
                          <Switch
                            size="sm"
                            isSelected={param.required}
                            onValueChange={(required) => updateParameter(index, { required })}
                          />
                        </div>
                        <Button
                          size="sm"
                          variant="flat"
                          color="danger"
                          isIconOnly
                          onPress={() => removeParameter(index)}>
                          <Trash2 size={16} />
                        </Button>
                      </HStack>

                      <Textarea
                        label="参数描述"
                        value={param.description}
                        onValueChange={(value) => updateParameter(index, { description: value })}
                        minRows={2}
                        variant="bordered"
                        classNames={{ inputWrapper: parameterInputWrapperClass, input: baseFieldInputClass }}
                      />

                      <Input
                        label="默认值"
                        value={param.defaultValue || ''}
                        onValueChange={(value) => updateParameter(index, { defaultValue: value })}
                        variant="bordered"
                        classNames={{ inputWrapper: parameterInputWrapperClass, input: baseFieldInputClass }}
                      />
                    </VStack>
                  </Card>
                ))
              )}
            </VStack>
          </CardBody>
        </Card>
      </VStack>
    </SettingContainer>
  )
}

export default ComponentEditPage
