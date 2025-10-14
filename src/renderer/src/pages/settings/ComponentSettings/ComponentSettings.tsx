import { Button, Card, CardBody, CardHeader, Chip, Switch, Tooltip, useDisclosure } from '@heroui/react'
import { loggerService } from '@logger'
import { HStack, VStack } from '@renderer/components/Layout'
import { useAppSelector, useAppDispatch } from '@renderer/store'
import { setComponentEnabled, setComponentSettings } from '@renderer/store/settings'
import { ComponentConfig, ComfyUIComponentConfig, JSComponentConfig } from '@renderer/types/component'
import { componentService } from '@renderer/services/ComponentService'
import { Edit, FileText, Package, Plus, Cpu, Settings, Trash2, Code, Download } from 'lucide-react'
import { FC, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { SettingContainer } from '..'
import ComponentMDDialog from '@renderer/components/ComponentMDDialog'

const logger = loggerService.withContext('ComponentSettings')

const ComponentSettings: FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()

  const [comfyUIComponents, setComfyUIComponents] = useState<ComfyUIComponentConfig[]>([])
  const [jsComponents, setJSComponents] = useState<JSComponentConfig[]>([])
  const [refreshTrigger] = useState(0)

  // MD对话框状态
  const { isOpen: isMDOpen, onOpen: onMDOpen, onClose: onMDClose } = useDisclosure()
  const [selectedComponent, setSelectedComponent] = useState<ComponentConfig | null>(null)

  // 从Redux store获取组件设置
  const componentSettings = useAppSelector((state) => state.settings.componentSettings)

  // 防御性编程：确保componentSettings存在
  if (!componentSettings || !componentSettings.components) {
    logger.error('Component settings not initialized in Redux store')
    return (
      <SettingContainer>
        <div className="p-8 text-center">
          <p className="text-red-500">组件设置未正确初始化，请刷新页面重试</p>
        </div>
      </SettingContainer>
    )
  }

  const components = Object.values(componentSettings.components)

  const renderTypeChip = (component: ComponentConfig) => {
    const map: Record<string, { label: string; color: 'primary' | 'secondary' | 'success' | 'warning' }> = {
      media: { label: 'audio', color: 'success' },
      interaction: { label: 'option', color: 'warning' },
      comfyui: { label: 'comfyui', color: 'primary' },
      javascript: { label: 'js', color: 'secondary' }
    }
    const info = map[component.category]
    if (!info) return null
    return (
      <Chip size="sm" color={info.color} variant="flat" className="flex-shrink-0">
        {info.label}
      </Chip>
    )
  }

  const renderHeaderIcon = (component: ComponentConfig) => {
    if (component.category === 'javascript') return <Code size={18} className="text-secondary" />
    if (component.category === 'comfyui') return <Cpu size={18} className="text-primary" />
    if (component.category === 'media') return <Package size={18} className="text-success" />
    if (component.category === 'interaction') return <Package size={18} className="text-warning" />
    return <Package size={18} className="text-default-500" />
  }

  // 加载组件的函数
  const loadComponents = async () => {
    try {
      // 加载 ComfyUI 组件
      const comfyComponents = componentService.getComfyUIComponents()
      setComfyUIComponents(comfyComponents)

      // 加载 JS 组件 - 先同步后端数据
      await componentService.syncJSComponents()
      const jsComponentList = componentService.getJSComponents()
      setJSComponents(jsComponentList)
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      console.error('Failed to load components:', err)
    }
  }

  // 加载 ComfyUI 组件和 JS 组件
  useEffect(() => {
    loadComponents()
  }, [componentSettings, refreshTrigger])

  // 监听页面焦点，当从其他页面返回时刷新组件列表
  useEffect(() => {
    const handleFocus = () => {
      loadComponents()
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [])

  // 处理组件启用/禁用
  const handleToggleComponent = async (componentId: string, enabled: boolean) => {
    try {
      // 检查是否是JS组件
      const jsComponent = jsComponents.find((c) => c.id === componentId)
      if (jsComponent) {
        // JS组件需要同步到后端
        const updatedComponent = { ...jsComponent, enabled }
        await window.api.jscomponent.updateComponent(componentId, updatedComponent)
        await componentService.syncJSComponents()
        // 重新加载JS组件列表
        const updatedJSComponents = componentService.getJSComponents()
        setJSComponents(updatedJSComponents)
        window.toast.success(`JS组件已${enabled ? '启用' : '禁用'}`)
      } else {
        // 其他组件直接更新Redux状态
        dispatch(setComponentEnabled({ id: componentId, enabled }))
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to toggle component:', err)
      window.toast.error('切换组件状态失败')
    }
  }

  // 处理编辑组件
  const handleEditComponent = (componentId: string) => {
    navigate(`/settings/components/edit/${componentId}`)
  }

  // 处理编辑 ComfyUI 组件
  const handleEditComfyUIComponent = (componentId: string) => {
    navigate(`/settings/components/comfyui/edit/${componentId}`)
  }

  // 处理配置 ComfyUI 组件参数
  const handleConfigureComfyUIComponent = (componentId: string) => {
    navigate(`/settings/components/comfyui/configure/${componentId}`)
  }

  // 处理删除 ComfyUI 组件
  const handleDeleteComfyUIComponent = async (componentId: string) => {
    const component = comfyUIComponents.find((c) => c.id === componentId)
    if (!component) {
      window.toast.error('组件不存在')
      return
    }

    // 确认删除
    const confirmMessage = `确定要删除组件 "${component.name}" (${component.componentName}) 吗？\n\n此操作将会：\n• 删除组件的所有配置\n• 删除工作流模板\n• 删除参数绑定\n• 删除缓存的图片\n\n此操作不可撤销！`

    if (!confirm(confirmMessage)) {
      return
    }

    try {
      // 尝试清理主进程缓存（如果失败也继续）
      try {
        await window.api.comfyui.deleteComponent(componentId)
        logger.info('主进程组件删除成功')
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error))
        logger.warn('主进程组件删除失败，继续清理前端数据', err)
      }

      // 直接从 Redux store 中删除组件
      const currentSettings = componentSettings
      const updatedComponents = { ...currentSettings.components }
      delete updatedComponents[componentId]

      const updatedSettings = {
        ...currentSettings,
        components: updatedComponents,
        lastUpdated: Date.now()
      }

      // 更新 Redux store
      dispatch(setComponentSettings(updatedSettings))

      window.toast.success(`组件 "${component.name}" 删除成功`)

      // 重新加载组件列表
      const refreshedComponents = componentService.getComfyUIComponents()
      setComfyUIComponents(refreshedComponents)
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('删除组件失败', err)
      window.toast.error('删除组件失败: ' + (error as Error).message)
    }
  }

  // 处理编辑 JS 组件
  const handleEditJSComponent = (componentId: string) => {
    navigate(`/settings/components/js/edit/${componentId}`)
  }

  // 处理删除 JS 组件
  const handleDeleteJSComponent = async (componentId: string) => {
    const component = jsComponents.find((c) => c.id === componentId)
    if (!component) {
      window.toast.error('组件不存在')
      return
    }

    if (!window.confirm(`确定要删除组件 "${component.name}" 吗？`)) {
      return
    }

    try {
      await componentService.deleteJSComponent(componentId)
      window.toast.success('组件删除成功')

      // 同步组件数据并重新加载组件列表
      await componentService.syncJSComponents()
      await loadComponents()
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('删除JS组件失败', err)
      window.toast.error('删除组件失败: ' + (error as Error).message)
    }
  }

  // 处理生成单个组件的MD
  const handleGenerateComponentMD = (component: ComponentConfig) => {
    const maybeComponent = component as any
    const slugValue =
      typeof maybeComponent?.componentName === 'string' && maybeComponent.componentName.trim().length > 0
        ? maybeComponent.componentName.trim()
        : component.id

    let displayName = component.name
    if (component.category === 'javascript') {
      displayName = `js-${slugValue}`
    } else if (component.category === 'comfyui') {
      displayName = `comfyui-${slugValue}`
    } else if (component.category === 'media') {
      displayName = `audio-${slugValue}`
    } else if (component.category === 'interaction') {
      displayName = `option-${slugValue}`
    }

    setSelectedComponent({ ...component, name: displayName })
    onMDOpen()
  }

  // 处理导出组件
  const handleExportComponent = async (component: ComponentConfig) => {
    try {
      const success = await componentService.exportComponent(component.id, component.category as 'js' | 'comfyui')
      if (success) {
        window.toast.success(`组件 "${component.name}" 导出成功`)
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Export component failed:', err)
      window.toast.error('导出组件失败')
    }
  }

  // 获取组件统计
  const stats = componentService.getComponentStats()

  return (
    <SettingContainer>
      <VStack gap="24px">
        {/* 页面标题和统计 */}
        <VStack gap="16px">
          <div>
            <h2 className="flex items-center gap-3 font-semibold text-2xl">
              <Package size={24} className="text-primary" />
              {t('settings.components.title')}
            </h2>
            <p className="mt-2 text-default-500">{t('settings.components.description')}</p>
          </div>

          {/* 统计卡片 */}
          <Card className="bg-gradient-to-r from-primary-50 to-secondary-50 p-6">
            <HStack gap="32px" justifyContent="center">
              <div className="text-center">
                <div className="font-bold text-3xl text-primary">{stats.total}</div>
                <div className="font-medium text-default-600 text-sm">{t('settings.components.stats.total')}</div>
              </div>
              <div className="h-12 w-px bg-default-200"></div>
              <div className="text-center">
                <div className="font-bold text-3xl text-success">{stats.enabled}</div>
                <div className="font-medium text-default-600 text-sm">{t('settings.components.stats.enabled')}</div>
              </div>
              <div className="h-12 w-px bg-default-200"></div>
              <div className="text-center">
                <div className="font-bold text-3xl text-default-400">{stats.disabled}</div>
                <div className="font-medium text-default-600 text-sm">{t('settings.components.stats.disabled')}</div>
              </div>
            </HStack>
          </Card>
        </VStack>

        {/* 组件标题 */}
        <div>
          <h3 className="flex items-center gap-2 font-semibold text-xl">
            <Package size={20} className="text-default-600" />
            组件管理
          </h3>
          <p className="mt-1 text-default-500 text-sm">管理内置组件、ComfyUI组件和JS组件</p>
        </div>

        {/* 组件网格 */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {components
            .filter((c) => c.builtin)
            .map((component) => (
              <Card
                key={component.id}
                className="flex h-[280px] flex-col rounded-xl border border-default-200/60 shadow-[0_3px_10px_rgba(0,0,0,0.03)] transition-all duration-200 hover:scale-[1.01] hover:shadow-[0_6px_18px_rgba(0,0,0,0.06)]">
                <CardHeader className="flex-shrink-0 pb-2">
                  <VStack gap="8px" className="w-full">
                    <HStack justifyContent="space-between" alignItems="center">
                      <HStack gap="8px" alignItems="center" className="min-w-0">
                        <div className="rounded-md bg-default-100 p-1.5">{renderHeaderIcon(component)}</div>
                        <span className="truncate font-semibold text-lg">{component.name}</span>
                      </HStack>
                      <Switch
                        size="sm"
                        color="success"
                        isSelected={component.enabled}
                        onValueChange={(enabled) => handleToggleComponent(component.id, enabled)}
                        className="flex-shrink-0"
                      />
                    </HStack>
                    <HStack gap="8px" alignItems="center">
                      <span className="max-w-full truncate rounded-md bg-default-100 px-2 py-1 font-mono text-default-600 text-xs">
                        &lt;{component.id}&gt;
                      </span>
                      {renderTypeChip(component)}
                    </HStack>
                  </VStack>
                </CardHeader>

                <CardBody className="flex flex-1 flex-col justify-between pt-0">
                  <VStack gap="8px" className="flex-1">
                    <p className="line-clamp-3 text-default-600 text-sm leading-relaxed">{component.description}</p>

                    <div className="text-default-500 text-xs">参数数量: {component.parameters.length}</div>
                  </VStack>

                  <HStack gap="8px" className="mt-3 w-full justify-center">
                    <Tooltip content="编辑组件" placement="top">
                      <Button
                        size="sm"
                        variant="flat"
                        color="primary"
                        isIconOnly
                        onPress={() => handleEditComponent(component.id)}
                        className="h-8 min-w-8">
                        <Edit size={16} />
                      </Button>
                    </Tooltip>
                    <Tooltip content="生成组件使用文档" placement="top">
                      <Button
                        size="sm"
                        variant="flat"
                        color="secondary"
                        isIconOnly
                        onPress={() => handleGenerateComponentMD(component)}
                        className="h-8 min-w-8">
                        <FileText size={16} />
                      </Button>
                    </Tooltip>
                    <Tooltip content="导出组件" placement="top">
                      <Button
                        size="sm"
                        variant="flat"
                        color="success"
                        isIconOnly
                        onPress={() => handleExportComponent(component)}
                        className="h-8 min-w-8">
                        <Download size={16} />
                      </Button>
                    </Tooltip>
                  </HStack>
                </CardBody>
              </Card>
            ))}

          {/* ComfyUI 组件 */}
                    {comfyUIComponents.map((component) => (
            <Card
              key={component.id}
              className="flex h-[280px] flex-col rounded-xl border border-primary-200 shadow-[0_3px_10px_rgba(0,0,0,0.03)] transition-all duration-200 hover:scale-[1.01] hover:shadow-[0_6px_18px_rgba(0,0,0,0.06)]">
              <CardHeader className="flex-shrink-0 pb-2">
                <VStack gap="8px" className="w-full">
                  <HStack justifyContent="space-between" alignItems="center">
                    <HStack gap="8px" alignItems="center" className="min-w-0">
                      <div className="rounded-md bg-primary-100 p-1.5">
                        <Cpu size={16} className="text-primary" />
                      </div>
                      <span className="truncate font-semibold text-lg">{component.name}</span>
                    </HStack>
                    <Switch
                      size="sm"
                      color="primary"
                      isSelected={component.enabled}
                      onValueChange={(enabled) => handleToggleComponent(component.id, enabled)}
                      className="flex-shrink-0"
                    />
                  </HStack>
                  <HStack gap="8px" alignItems="center">
                    <span className="max-w-full truncate rounded-md bg-primary-100 px-2 py-1 font-mono text-primary-700 text-xs">
                      &lt;comfyui-{component.componentName}&gt;
                    </span>
                    {renderTypeChip(component)}
                  </HStack>
                </VStack>
              </CardHeader>

              <CardBody className="flex flex-1 flex-col justify-between pt-0">
                <VStack gap="8px" className="flex-1">
                  <p className="line-clamp-2 text-default-600 text-sm leading-relaxed">{component.description}</p>

                  <div className="text-default-500 text-xs">
                    参数数量: {component.parameters?.length || 0} | 服务器: {new URL(component.serverUrl).host} | 输出:{' '}
                    {component.outputType === 'image'
                      ? '图片'
                      : component.outputType === 'video'
                        ? '视频'
                        : component.outputType === 'text'
                          ? '文本'
                          : '图片'}
                  </div>
                </VStack>

                <HStack gap="8px" className="mt-3 w-full justify-center">
                  <Tooltip content="编辑组件" placement="top">
                    <Button
                      size="sm"
                      variant="flat"
                      color="primary"
                      isIconOnly
                      onPress={() => handleEditComfyUIComponent(component.id)}
                      className="h-8 min-w-8">
                      <Edit size={16} />
                    </Button>
                  </Tooltip>
                  <Tooltip content="配置组件" placement="top">
                    <Button
                      size="sm"
                      variant="flat"
                      color="secondary"
                      isIconOnly
                      onPress={() => handleConfigureComfyUIComponent(component.id)}
                      className="h-8 min-w-8">
                      <Settings size={16} />
                    </Button>
                  </Tooltip>
                  <Tooltip content="生成组件使用文档" placement="top">
                    <Button
                      size="sm"
                      variant="flat"
                      color="default"
                      isIconOnly
                      onPress={() => handleGenerateComponentMD(component)}
                      className="h-8 min-w-8">
                      <FileText size={16} />
                    </Button>
                  </Tooltip>
                  <Tooltip content="导出组件" placement="top">
                    <Button
                      size="sm"
                      variant="flat"
                      color="success"
                      isIconOnly
                      onPress={() => handleExportComponent(component)}
                      className="h-8 min-w-8">
                      <Download size={16} />
                    </Button>
                  </Tooltip>
                  <Tooltip content="删除组件" placement="top">
                    <Button
                      size="sm"
                      variant="flat"
                      color="danger"
                      isIconOnly
                      onPress={() => handleDeleteComfyUIComponent(component.id)}
                      className="h-8 min-w-8">
                      <Trash2 size={16} />
                    </Button>
                  </Tooltip>
                </HStack>
              </CardBody>
            </Card>
          ))}

          {/* JS 组件 */}
                    {jsComponents.map((component) => (
            <Card
              key={component.id}
              className="flex h-[280px] flex-col rounded-xl border border-secondary-200 shadow-[0_3px_10px_rgba(0,0,0,0.03)] transition-all duration-200 hover:scale-[1.01] hover:shadow-[0_6px_18px_rgba(0,0,0,0.06)]">
              <CardHeader className="flex-shrink-0 pb-2">
                <VStack gap="8px" className="w-full">
                  <HStack justifyContent="space-between" alignItems="center">
                    <HStack gap="8px" alignItems="center" className="min-w-0">
                      <div className="rounded-md bg-secondary-100 p-1.5">
                        <Code size={16} className="text-secondary" />
                      </div>
                      <span className="truncate font-semibold text-lg">{component.name}</span>
                    </HStack>
                    <Switch
                      size="sm"
                      color="success"
                      isSelected={component.enabled}
                      onValueChange={(enabled) => handleToggleComponent(component.id, enabled)}
                      className="flex-shrink-0"
                    />
                  </HStack>
                  <HStack gap="8px" alignItems="center">
                    <span className="max-w-full truncate rounded-md bg-secondary-100 px-2 py-1 font-mono text-secondary-700 text-xs">
                      &lt;js-{component.componentName}&gt;
                    </span>
                    {renderTypeChip(component)}
                  </HStack>
                </VStack>
              </CardHeader>

              <CardBody className="flex flex-1 flex-col justify-between pt-0">
                <VStack gap="8px" className="flex-1">
                  <p className="line-clamp-2 text-default-600 text-sm leading-relaxed">{component.description}</p>

                  <div className="text-default-500 text-xs">
                    参数数量: {component.parameters?.length || 0} | 输出:{' '}
                    {component.outputType === 'html' ? 'HTML' : '文本'} | 超时: {component.timeout || 5000}ms
                  </div>
                </VStack>

                <HStack gap="8px" className="mt-3 w-full justify-center">
                  <Tooltip content="编辑组件" placement="top">
                    <Button
                      size="sm"
                      variant="flat"
                      color="secondary"
                      isIconOnly
                      onPress={() => handleEditJSComponent(component.id)}
                      className="h-8 min-w-8">
                      <Edit size={16} />
                    </Button>
                  </Tooltip>
                  <Tooltip content="生成组件使用文档" placement="top">
                    <Button
                      size="sm"
                      variant="flat"
                      color="default"
                      isIconOnly
                      onPress={() => handleGenerateComponentMD(component)}
                      className="h-8 min-w-8">
                      <FileText size={16} />
                    </Button>
                  </Tooltip>
                  <Tooltip content="导出组件" placement="top">
                    <Button
                      size="sm"
                      variant="flat"
                      color="success"
                      isIconOnly
                      onPress={() => handleExportComponent(component)}
                      className="h-8 min-w-8">
                      <Download size={16} />
                    </Button>
                  </Tooltip>
                  <Tooltip content="删除组件" placement="top">
                    <Button
                      size="sm"
                      variant="flat"
                      color="danger"
                      isIconOnly
                      onPress={() => handleDeleteJSComponent(component.id)}
                      className="h-8 min-w-8">
                      <Trash2 size={16} />
                    </Button>
                  </Tooltip>
                </HStack>
              </CardBody>
            </Card>
          ))}

          {/* 新增 ComfyUI 组件卡片 */}
          <Card
            className="flex h-[280px] cursor-pointer border-2 border-primary-300 border-dashed bg-primary-50/30 transition-all duration-200 hover:scale-[1.01] hover:shadow-md"
            isPressable
            onPress={() => navigate('/settings/components/comfyui/create')}>
            <CardBody className="flex flex-col items-center justify-center p-6 text-center">
              <VStack gap="12px" alignItems="center">
                <div className="rounded-full bg-primary-100 p-4">
                  <Cpu size={32} className="text-primary" />
                </div>
                <VStack gap="6px" alignItems="center">
                  <span className="font-semibold text-lg text-primary">新增 ComfyUI 组件</span>
                  <p className="max-w-[200px] text-default-600 text-sm leading-relaxed">
                    上传 ComfyUI 工作流，创建自定义动态组件
                  </p>
                </VStack>
                <Button color="primary" variant="flat" startContent={<Plus size={16} />} size="sm">
                  开始创建
                </Button>
              </VStack>
            </CardBody>
          </Card>

          {/* 新增 JS 组件卡片 */}
          <Card
            className="flex h-[280px] cursor-pointer border-2 border-secondary-300 border-dashed bg-secondary-50/30 transition-all duration-200 hover:scale-[1.01] hover:shadow-md"
            isPressable
            onPress={() => navigate('/settings/components/js/create')}>
            <CardBody className="flex flex-col items-center justify-center p-6 text-center">
              <VStack gap="12px" alignItems="center">
                <div className="rounded-full bg-secondary-100 p-4">
                  <Code size={32} className="text-secondary" />
                </div>
                <VStack gap="6px" alignItems="center">
                  <span className="font-semibold text-lg text-secondary">新增 JS 组件</span>
                  <p className="max-w-[200px] text-default-600 text-sm leading-relaxed">
                    编写JavaScript代码，创建自定义组件
                  </p>
                </VStack>
                <Button color="secondary" variant="flat" startContent={<Plus size={16} />} size="sm">
                  开始创建
                </Button>
              </VStack>
            </CardBody>
          </Card>
        </div>
      </VStack>

      {/* MD生成对话框 */}
      <ComponentMDDialog isOpen={isMDOpen} onClose={onMDClose} component={selectedComponent} />
    </SettingContainer>
  )
}

export default ComponentSettings






