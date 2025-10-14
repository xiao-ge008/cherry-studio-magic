import { useState, useEffect } from 'react'
import {
  Button,
  Input,
  Textarea,
  Select,
  SelectItem,
  Switch,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter
} from '@heroui/react'
import { Plus, Trash2, Save, X, Maximize2, Minimize2 } from 'lucide-react'
import { JSComponentConfig, ComponentParameter, JSComponentOutputType } from '@renderer/types/component'
import { componentService } from '@renderer/services/ComponentService'
import { jsExecutionService } from '@renderer/services/JSExecutionService'
import { v4 as uuidv4 } from 'uuid'

interface JSComponentCreatorProps {
  component?: JSComponentConfig
  onSave: () => void
  onCancel: () => void
}

export const JSComponentCreator: React.FC<JSComponentCreatorProps> = ({ component, onSave, onCancel }) => {
  // HeroUI 输入框样式类 - 解决黑框问题
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
  const [formData, setFormData] = useState<Partial<JSComponentConfig>>({
    id: '',
    name: '',
    componentName: '',
    description: '',
    enabled: true,
    category: 'javascript',
    builtin: false,
    jsCode: '',
    outputType: 'text',
    timeout: 5000,
    parameters: [],
    version: '1.0.0'
  })

  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false)
  const [fullscreenCode, setFullscreenCode] = useState('')

  // 初始化表单数据
  useEffect(() => {
    if (component) {
      setFormData(component)
    } else {
      setFormData((prev) => ({
        ...prev,
        id: uuidv4()
      }))
    }
  }, [component])

  // 全屏编辑器键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFullscreenOpen) {
        // Ctrl+S 保存代码
        if (e.ctrlKey && e.key === 's') {
          e.preventDefault()
          saveFullscreenCode()
        }
        // ESC 退出全屏
        if (e.key === 'Escape') {
          e.preventDefault()
          closeFullscreenEditor()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isFullscreenOpen, fullscreenCode])

  // 添加参数
  const addParameter = () => {
    const newParam: ComponentParameter = {
      name: '',
      type: 'string',
      description: '',
      required: false,
      example: ''
    }
    setFormData((prev) => ({
      ...prev,
      parameters: [...(prev.parameters || []), newParam]
    }))
  }

  // 删除参数
  const removeParameter = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      parameters: prev.parameters?.filter((_, i) => i !== index) || []
    }))
  }

  // 更新参数
  const updateParameter = (index: number, field: keyof ComponentParameter, value: any) => {
    setFormData((prev) => ({
      ...prev,
      parameters: prev.parameters?.map((param, i) => (i === index ? { ...param, [field]: value } : param)) || []
    }))
  }

  // 测试JS代码
  const testCode = async () => {
    if (!formData.jsCode) {
      window.toast.error('请先输入JS代码')
      return
    }

    setTesting(true)
    try {
      // 验证语法
      const validation = jsExecutionService.validateJSCode(formData.jsCode)
      if (!validation.valid) {
        window.toast.error(`代码语法错误: ${validation.error}`)
        return
      }

      // 构造测试参数
      const testParams: Record<string, any> = {}
      formData.parameters?.forEach((param) => {
        if (param.example) {
          testParams[param.name] = param.example
        } else if (param.defaultValue !== undefined) {
          testParams[param.name] = param.defaultValue
        } else if (param.required) {
          switch (param.type) {
            case 'string':
              testParams[param.name] = 'test'
              break
            case 'number':
              testParams[param.name] = 1
              break
            case 'boolean':
              testParams[param.name] = true
              break
            case 'json':
              testParams[param.name] = {}
              break
          }
        }
      })

      // 执行测试
      const result = await jsExecutionService.executeComponent(formData as JSComponentConfig, testParams)

      if (result.success) {
        window.toast.success(`代码测试成功 (${result.executionTime}ms)`)
        console.log('Test output:', result.output)
      } else {
        window.toast.error(`代码测试失败: ${result.error}`)
      }
    } catch (error) {
      console.error('Test failed:', error)
      window.toast.error('测试失败')
    } finally {
      setTesting(false)
    }
  }

  // 全屏编辑器处理函数
  const openFullscreenEditor = () => {
    setFullscreenCode(formData.jsCode || '')
    setIsFullscreenOpen(true)
  }

  const closeFullscreenEditor = () => {
    setIsFullscreenOpen(false)
  }

  const saveFullscreenCode = () => {
    setFormData((prev) => ({ ...prev, jsCode: fullscreenCode }))
    setIsFullscreenOpen(false)
    window.toast.success('代码已保存')
  }

  // 保存组件
  const handleSave = async () => {
    // 验证表单
    if (!formData.name?.trim()) {
      window.toast.error('请输入组件名称')
      return
    }
    if (!formData.componentName?.trim()) {
      window.toast.error('请输入组件英文名')
      return
    }
    if (!formData.description?.trim()) {
      window.toast.error('请输入组件描述')
      return
    }
    if (!formData.jsCode?.trim()) {
      window.toast.error('请输入JS代码')
      return
    }

    // 验证组件名唯一性
    if (!component && !componentService.isJSComponentNameAvailable(formData.componentName!)) {
      window.toast.error('组件英文名已存在')
      return
    }

    setSaving(true)
    try {
      if (component) {
        // 更新组件
        await window.api.jscomponent.updateComponent(component.id, formData)
        window.toast.success('组件更新成功')
      } else {
        // 创建组件
        await window.api.jscomponent.createComponent(formData as JSComponentConfig)
        window.toast.success('组件创建成功')
      }

      // 同步组件数据到前端
      await componentService.syncJSComponents()

      onSave()
    } catch (error) {
      console.error('Failed to save component:', error)
      window.toast.error(component ? '更新组件失败' : '创建组件失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 基本信息 */}
      <Card>
        <CardHeader>
          <h4 className="font-semibold">基本信息</h4>
        </CardHeader>
        <Divider />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="组件名称"
              placeholder="输入组件显示名称"
              value={formData.name || ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              variant="bordered"
              classNames={{ inputWrapper: basicInputWrapperClass, input: baseFieldInputClass }}
              isRequired
            />
            <Input
              label="组件英文名"
              placeholder="输入组件英文标识"
              value={formData.componentName || ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, componentName: e.target.value }))}
              variant="bordered"
              classNames={{ inputWrapper: basicInputWrapperClass, input: baseFieldInputClass }}
              isRequired
            />
          </div>

          <Textarea
            label="组件描述"
            placeholder="输入组件功能描述"
            value={formData.description || ''}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            variant="bordered"
            classNames={{ inputWrapper: basicInputWrapperClass, input: baseFieldInputClass }}
            isRequired
          />

          <div className="grid grid-cols-3 gap-4">
            <Select
              label="输出类型"
              selectedKeys={formData.outputType ? [formData.outputType] : []}
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0] as JSComponentOutputType
                setFormData((prev) => ({ ...prev, outputType: value }))
              }}
              variant="bordered"
              classNames={{ trigger: parameterSelectTriggerClass }}>
              <SelectItem key="text">文本</SelectItem>
              <SelectItem key="html">HTML</SelectItem>
            </Select>

            <Input
              label="超时时间(ms)"
              type="number"
              value={String(formData.timeout || 5000)}
              onChange={(e) => setFormData((prev) => ({ ...prev, timeout: Number(e.target.value) }))}
              variant="bordered"
              classNames={{ inputWrapper: basicInputWrapperClass, input: baseFieldInputClass }}
            />

            <div className="flex items-center">
              <Switch
                isSelected={formData.enabled}
                onValueChange={(checked) => setFormData((prev) => ({ ...prev, enabled: checked }))}>
                启用组件
              </Switch>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* 参数配置 */}
      <Card>
        <CardHeader className="flex justify-between">
          <h4 className="font-semibold">参数配置</h4>
          <Button size="sm" color="primary" variant="flat" startContent={<Plus size={14} />} onPress={addParameter}>
            添加参数
          </Button>
        </CardHeader>
        <Divider />
        <CardBody>
          {formData.parameters?.length === 0 ? (
            <div className="py-4 text-center text-default-500">暂无参数，点击"添加参数"开始配置</div>
          ) : (
            <div className="space-y-4">
              {formData.parameters?.map((param, index) => (
                <div key={index} className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">参数 {index + 1}</span>
                    <Button size="sm" color="danger" variant="flat" isIconOnly onPress={() => removeParameter(index)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="参数名"
                      value={param.name}
                      onChange={(e) => updateParameter(index, 'name', e.target.value)}
                      variant="bordered"
                      classNames={{ inputWrapper: parameterInputWrapperClass, input: baseFieldInputClass }}
                    />
                    <Select
                      label="参数类型"
                      selectedKeys={[param.type]}
                      onSelectionChange={(keys) => {
                        const value = Array.from(keys)[0] as string
                        updateParameter(index, 'type', value)
                      }}
                      variant="bordered"
                      classNames={{ trigger: parameterSelectTriggerClass }}>
                      <SelectItem key="string">字符串</SelectItem>
                      <SelectItem key="number">数值</SelectItem>
                      <SelectItem key="boolean">布尔值</SelectItem>
                      <SelectItem key="json">JSON</SelectItem>
                    </Select>
                  </div>

                  <Textarea
                    label="参数描述"
                    value={param.description}
                    onChange={(e) => updateParameter(index, 'description', e.target.value)}
                    variant="bordered"
                    classNames={{ inputWrapper: parameterInputWrapperClass, input: baseFieldInputClass }}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="示例值"
                      value={param.example || ''}
                      onChange={(e) => updateParameter(index, 'example', e.target.value)}
                      variant="bordered"
                      classNames={{ inputWrapper: parameterInputWrapperClass, input: baseFieldInputClass }}
                    />
                    <div className="flex items-center">
                      <Switch
                        isSelected={param.required}
                        onValueChange={(checked) => updateParameter(index, 'required', checked)}>
                        必需参数
                      </Switch>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* JS代码 */}
      <Card>
        <CardHeader className="flex justify-between">
          <h4 className="font-semibold">JS代码</h4>
          <div className="flex gap-2">
            <Button
              size="sm"
              color="default"
              variant="flat"
              onPress={openFullscreenEditor}
              startContent={<Maximize2 size={14} />}>
              全屏编辑
            </Button>
            <Button size="sm" color="secondary" variant="flat" onPress={testCode} isLoading={testing}>
              测试代码
            </Button>
          </div>
        </CardHeader>
        <Divider />
        <CardBody>
          <Textarea
            placeholder={`// 编写你的JS代码，例如：
// 返回文本
return "Hello, " + (name || "World") + "!"

// 返回HTML
return {
  type: "html",
  content: "<div style='color: blue;'>Hello, " + (name || "World") + "!</div>"
}`}
            value={formData.jsCode || ''}
            onChange={(e) => setFormData((prev) => ({ ...prev, jsCode: e.target.value }))}
            minRows={10}
            maxRows={20}
            className="font-mono"
            variant="bordered"
            classNames={{ inputWrapper: basicInputWrapperClass, input: baseFieldInputClass }}
          />
        </CardBody>
      </Card>

      {/* 操作按钮 */}
      <div className="flex justify-end gap-3">
        <Button variant="flat" startContent={<X size={16} />} onPress={onCancel}>
          取消
        </Button>
        <Button color="primary" startContent={<Save size={16} />} onPress={handleSave} isLoading={saving}>
          {component ? '更新' : '创建'}
        </Button>
      </div>

      {/* 全屏代码编辑器 */}
      <Modal
        isOpen={isFullscreenOpen}
        onClose={closeFullscreenEditor}
        size="full"
        scrollBehavior="inside"
        classNames={{
          base: 'm-0 sm:m-0',
          wrapper: 'w-full h-full',
          body: 'p-0 flex-1',
          header: 'border-b border-divider flex-shrink-0',
          footer: 'border-t border-divider flex-shrink-0'
        }}>
        <ModalContent className="flex h-full flex-col">
          <ModalHeader className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <Maximize2 size={20} className="text-primary" />
              <h3 className="font-semibold text-lg">全屏代码编辑器</h3>
            </div>
            <Button size="sm" variant="flat" onPress={closeFullscreenEditor} startContent={<Minimize2 size={14} />}>
              退出全屏
            </Button>
          </ModalHeader>
          <ModalBody className="flex flex-1 flex-col p-6" style={{ height: 'calc(100vh - 140px)' }}>
            <Textarea
              placeholder={`// 编写你的JS代码，例如：
// 返回文本
return "Hello, " + (name || "World") + "!"

// 返回HTML
return {
  type: "html",
  content: "<div style='color: blue;'>Hello, " + (name || "World") + "!</div>"
}

// 支持的参数类型：
// - string: 字符串类型
// - number: 数值类型
// - boolean: 布尔类型
// - json: JSON对象类型

// 代码执行环境：
// - 可以使用所有标准JavaScript语法
// - 禁用了危险的API（如fetch、eval等）
// - 执行超时时间可配置
// - 支持返回文本或HTML格式`}
              value={fullscreenCode}
              onChange={(e) => setFullscreenCode(e.target.value)}
              className="w-full font-mono text-sm"
              variant="bordered"
              classNames={{
                base: 'h-full',
                inputWrapper: `${basicInputWrapperClass} !h-full`,
                input: `${baseFieldInputClass} !h-full resize-none`
              }}
              minRows={30}
              style={{
                height: 'calc(100vh - 200px)'
              }}
            />
          </ModalBody>
          <ModalFooter className="px-6 py-4">
            <div className="flex w-full items-center justify-between">
              <div className="text-default-500 text-sm">提示：使用 Ctrl+S 快速保存，ESC 退出全屏</div>
              <div className="flex gap-3">
                <Button variant="flat" onPress={closeFullscreenEditor}>
                  取消
                </Button>
                <Button color="primary" onPress={saveFullscreenCode} startContent={<Save size={16} />}>
                  保存代码
                </Button>
              </div>
            </div>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
