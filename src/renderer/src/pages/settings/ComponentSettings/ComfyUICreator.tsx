/**
 * ComfyUI 组件创建页面
 * 简化版本：只处理基本信息和工作流上传，参数配置分离到单独页面
 */

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Textarea,
  Chip,
  Select,
  SelectItem,
  useDisclosure
} from '@heroui/react'
import { loggerService } from '@logger'
import { HStack, VStack } from '@renderer/components/Layout'
import { ArrowLeft, Upload, Save, Cpu, Plus } from 'lucide-react'
import { FC, useState, useCallback, useRef } from 'react'

import { useNavigate } from 'react-router-dom'
import { componentService } from '@renderer/services/ComponentService'
import { useAppDispatch } from '@renderer/store'
import { setComponentSettings } from '@renderer/store/settings'
import type { ComfyUIComponentConfig } from '@renderer/types/component'

import ComponentImportDialog from '@renderer/components/ComponentImportDialog'
import { SettingContainer } from '..'

const logger = loggerService.withContext('ComfyUICreator')

const ComfyUICreator: FC = () => {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()

  // 基本信息状态
  const [workflowName, setWorkflowName] = useState('')
  const [componentName, setComponentName] = useState('')
  const [serverUrl, setServerUrl] = useState('http://localhost:8188')
  const [apiKey, setApiKey] = useState('')
  const [description, setDescription] = useState('')
  const [outputType, setOutputType] = useState<'image' | 'video' | 'text'>('image')

  // 工作流状态
  const [workflowFile, setWorkflowFile] = useState<File | null>(null)
  const [workflowJson, setWorkflowJson] = useState<any>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // 导入对话框状态
  const { isOpen: isImportOpen, onOpen: onImportOpen, onClose: onImportClose } = useDisclosure()

  const fileInputRef = useRef<HTMLInputElement>(null)

  // 处理文件上传
  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.name.endsWith('.json')) {
      window.toast.error('请上传 JSON 格式的工作流文件')
      return
    }

    setIsUploading(true)
    try {
      const text = await file.text()
      const json = JSON.parse(text)

      // 简单验证工作流格式
      if (!json || typeof json !== 'object') {
        throw new Error('无效的工作流格式')
      }

      setWorkflowFile(file)
      setWorkflowJson(json)

      window.toast.success('工作流上传成功！')
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to parse workflow:', err)
      window.toast.error('工作流解析失败，请检查文件格式')
    } finally {
      setIsUploading(false)
    }
  }, [])

  // 处理拖拽上传
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) {
        handleFileUpload(files[0])
      }
    },
    [handleFileUpload]
  )

  // 保存组件
  const handleSave = async () => {
    if (!workflowName || !componentName || !workflowJson) {
      window.toast.error('请填写完整的基本信息并上传工作流')
      return
    }

    setIsSaving(true)
    try {
      // 不创建任何默认参数，让用户根据实际工作流配置
      const componentConfig: ComfyUIComponentConfig = {
        id: `comfyui-${componentName}-${Date.now()}`,
        name: workflowName,
        description: description || `ComfyUI ${workflowName} 组件`,
        enabled: true,
        category: 'comfyui',
        builtin: false,
        componentName,
        serverUrl,
        apiKey,
        workflowTemplate: workflowJson,
        nodeBindings: [], // 空的节点绑定，用户需要手动配置
        parameters: [], // 空的参数列表，用户需要手动配置
        outputType, // 输出类型
        version: '1.0.0'
      }

      // 保存组件到本地存储
      const settings = componentService.getComponentSettings()
      const updatedComponents = { ...settings.components }
      updatedComponents[componentConfig.id] = componentConfig

      const updatedSettings = {
        ...settings,
        components: updatedComponents,
        lastUpdated: Date.now()
      }

      // 保存到 Redux store
      dispatch(setComponentSettings(updatedSettings))

      window.toast.success('ComfyUI 组件创建成功！可以在组件列表中配置参数。')
      navigate('/settings/components')
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to save component:', err)
      window.toast.error('组件保存失败')
    } finally {
      setIsSaving(false)
    }
  }

  const handleImportSuccess = () => {
    // 导入成功后返回组件列表
    navigate('/settings/components')
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
                <Button
                  size="sm"
                  variant="flat"
                  startContent={<ArrowLeft size={16} />}
                  onPress={() => navigate('/settings/components')}>
                  返回
                </Button>
                <div>
                  <h2 className="flex items-center gap-3 font-semibold text-2xl">
                    <Cpu size={24} className="text-primary" />
                    创建 ComfyUI 组件
                    <Chip size="sm" color="secondary" variant="flat">
                      动态组件
                    </Chip>
                  </h2>
                  <p className="mt-1 text-default-500 text-sm">上传工作流文件，创建自定义动态组件</p>
                </div>
              </HStack>

              <HStack gap="12px">
                <Button
                  size="sm"
                  variant="flat"
                  color="secondary"
                  startContent={<Upload size={16} />}
                  onPress={onImportOpen}>
                  导入组件
                </Button>
                <Button
                  size="sm"
                  variant="flat"
                  color="primary"
                  startContent={<Plus size={16} />}
                  onPress={() => {
                    /* 当前页面就是新建，不需要额外操作 */
                  }}>
                  新建组件
                </Button>
                <Button size="sm" variant="flat" onPress={() => navigate('/settings/components')}>
                  取消
                </Button>
                <Button
                  size="sm"
                  color="primary"
                  startContent={<Save size={16} />}
                  onPress={handleSave}
                  isDisabled={!workflowName || !componentName || !workflowJson}
                  isLoading={isSaving}>
                  创建组件
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
              <HStack gap="20px" className="w-full">
                <Input
                  label="工作流名称"
                  placeholder="文生图"
                  value={workflowName}
                  onValueChange={setWorkflowName}
                  isRequired
                  className="flex-1"
                  variant="bordered"
                  classNames={{ inputWrapper: basicInputWrapperClass, input: baseFieldInputClass }}
                />
                <Input
                  label="组件名"
                  placeholder="text2image"
                  value={componentName}
                  onValueChange={setComponentName}
                  isRequired
                  className="flex-1"
                  variant="bordered"
                  description="英文，唯一标识"
                  classNames={{ inputWrapper: basicInputWrapperClass, input: baseFieldInputClass }}
                />
              </HStack>

              <HStack gap="20px" className="w-full">
                <Input
                  label="服务器 URL"
                  placeholder="http://localhost:8188"
                  value={serverUrl}
                  onValueChange={setServerUrl}
                  className="flex-1"
                  variant="bordered"
                  classNames={{ inputWrapper: basicInputWrapperClass, input: baseFieldInputClass }}
                />
                <Input
                  label="API Key"
                  placeholder="可选，用于认证"
                  value={apiKey}
                  onValueChange={setApiKey}
                  className="flex-1"
                  variant="bordered"
                  classNames={{ inputWrapper: basicInputWrapperClass, input: baseFieldInputClass }}
                />
              </HStack>

              <HStack gap="20px" className="w-full">
                <Select
                  label="输出类型"
                  placeholder="选择组件输出类型"
                  selectedKeys={[outputType]}
                  onSelectionChange={(keys) => {
                    const selected = Array.from(keys)[0] as 'image' | 'video' | 'text'
                    setOutputType(selected)
                  }}
                  className="flex-1"
                  variant="bordered"
                  description="默认为图片类型">
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
                <div className="flex-1" /> {/* 占位符，保持布局对称 */}
              </HStack>

              <Textarea
                label="描述"
                placeholder="描述工作流的功能（可选）"
                value={description}
                onValueChange={setDescription}
                minRows={3}
                variant="bordered"
                classNames={{ inputWrapper: basicInputWrapperClass, input: baseFieldInputClass }}
              />
            </VStack>
          </CardBody>
        </Card>

        {/* 工作流文件上传 - 统一卡片样式 */}
        <Card className="w-full">
          <CardHeader className="pb-4">
            <h3 className="font-semibold text-lg">工作流文件</h3>
          </CardHeader>
          <CardBody className="pt-0">
            {workflowJson ? (
              <div className="rounded-xl border border-success-300 bg-gradient-to-br from-success-50 to-success-100 p-6 text-center">
                <div className="flex flex-col items-center gap-3">
                  <Upload size={32} className="text-success-600" />
                  <p className="font-medium text-lg text-success-700">{workflowFile?.name}</p>
                  <p className="text-sm text-success-600">✓ 工作流解析成功，可以创建组件</p>
                </div>
              </div>
            ) : (
              <div
                className="flex min-h-[160px] w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-default-300 border-dashed bg-gradient-to-br from-default-50 to-default-100 transition-all hover:border-primary-400 hover:bg-primary-50"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}>
                <Upload size={40} className="mb-3 text-default-400" />
                <div className="text-center">
                  <p className="font-medium text-default-700">上传 ComfyUI 工作流文件</p>
                  <p className="text-default-500 text-sm">支持拖拽或点击选择 JSON 文件</p>
                  {isUploading && <p className="mt-2 text-primary text-sm">解析中...</p>}
                </div>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileUpload(file)
              }}
            />
          </CardBody>
        </Card>
      </VStack>

      {/* 导入对话框 */}
      <ComponentImportDialog
        isOpen={isImportOpen}
        onClose={onImportClose}
        onSuccess={handleImportSuccess}
        componentType="comfyui"
      />
    </SettingContainer>
  )
}

export default ComfyUICreator
