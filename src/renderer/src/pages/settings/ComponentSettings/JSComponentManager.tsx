import { useState, useEffect } from 'react'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Divider,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure
} from '@heroui/react'
import { Trash2, Edit, Play, Plus } from 'lucide-react'
import { JSComponentConfig } from '@renderer/types/component'
import { componentService } from '@renderer/services/ComponentService'
import { JSComponentCreator } from './JSComponentCreator'

export const JSComponentManager: React.FC = () => {
  const [components, setComponents] = useState<JSComponentConfig[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedComponent, setSelectedComponent] = useState<JSComponentConfig | null>(null)
  const [deleteComponentId, setDeleteComponentId] = useState<string | null>(null)

  const { isOpen: isCreateOpen, onOpen: onCreateOpen, onClose: onCreateClose } = useDisclosure()
  const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure()
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure()

  // 加载组件列表
  const loadComponents = async () => {
    setLoading(true)
    try {
      await componentService.syncJSComponents()
      const jsComponents = componentService.getJSComponents()
      setComponents(jsComponents)
    } catch (error) {
      console.error('Failed to load JS components:', error)
      window.toast.error('加载JS组件失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadComponents()
  }, [])

  // 删除组件
  const handleDelete = async () => {
    if (!deleteComponentId) return

    try {
      await componentService.deleteJSComponent(deleteComponentId)
      window.toast.success('组件删除成功')
      loadComponents()
    } catch (error) {
      console.error('Failed to delete component:', error)
      window.toast.error('删除组件失败')
    } finally {
      setDeleteComponentId(null)
      onDeleteClose()
    }
  }

  // 测试组件
  const handleTest = async (component: JSComponentConfig) => {
    try {
      // 构造测试参数
      const testParams: Record<string, any> = {}
      component.parameters.forEach((param) => {
        if (param.example) {
          testParams[param.name] = param.example
        } else if (param.defaultValue !== undefined) {
          testParams[param.name] = param.defaultValue
        } else if (param.required) {
          // 为必需参数提供默认测试值
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

      const result = await componentService.executeJSComponent(component.id, testParams)

      if (result.success) {
        window.toast.success(`组件测试成功 (${result.executionTime}ms)`)
        console.log('Test result:', result.output)
      } else {
        window.toast.error(`组件测试失败: ${result.error}`)
      }
    } catch (error) {
      console.error('Failed to test component:', error)
      window.toast.error('测试组件失败')
    }
  }

  // 编辑组件
  const handleEdit = (component: JSComponentConfig) => {
    setSelectedComponent(component)
    onEditOpen()
  }

  // 组件创建/编辑完成
  const handleComponentSaved = () => {
    loadComponents()
    onCreateClose()
    onEditClose()
    setSelectedComponent(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">JS组件管理</h3>
        <Button color="primary" startContent={<Plus size={16} />} onPress={onCreateOpen}>
          创建组件
        </Button>
      </div>

      {loading ? (
        <div className="py-8 text-center">
          <div className="text-default-500">加载中...</div>
        </div>
      ) : components.length === 0 ? (
        <Card>
          <CardBody className="py-8 text-center">
            <div className="mb-4 text-default-500">暂无JS组件</div>
            <Button color="primary" variant="flat" onPress={onCreateOpen}>
              创建第一个组件
            </Button>
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-4">
          {components.map((component) => (
            <Card key={component.id}>
              <CardHeader className="flex justify-between">
                <div>
                  <h4 className="font-semibold">{component.name}</h4>
                  <p className="text-default-500 text-sm">{component.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Chip size="sm" color={component.enabled ? 'success' : 'default'} variant="flat">
                    {component.enabled ? '已启用' : '已禁用'}
                  </Chip>
                  <Chip size="sm" color="primary" variant="flat">
                    {component.outputType}
                  </Chip>
                </div>
              </CardHeader>
              <Divider />
              <CardBody>
                <div className="space-y-3">
                  <div>
                    <span className="font-medium text-sm">组件名: </span>
                    <span className="text-default-600 text-sm">{component.componentName}</span>
                  </div>

                  <div>
                    <span className="font-medium text-sm">参数: </span>
                    <span className="text-default-600 text-sm">{component.parameters.length} 个参数</span>
                  </div>

                  <div>
                    <span className="font-medium text-sm">超时时间: </span>
                    <span className="text-default-600 text-sm">{component.timeout || 5000}ms</span>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      color="primary"
                      variant="flat"
                      startContent={<Play size={14} />}
                      onPress={() => handleTest(component)}>
                      测试
                    </Button>
                    <Button
                      size="sm"
                      color="default"
                      variant="flat"
                      startContent={<Edit size={14} />}
                      onPress={() => handleEdit(component)}>
                      编辑
                    </Button>
                    <Button
                      size="sm"
                      color="danger"
                      variant="flat"
                      startContent={<Trash2 size={14} />}
                      onPress={() => {
                        setDeleteComponentId(component.id)
                        onDeleteOpen()
                      }}
                      isDisabled={component.builtin}>
                      删除
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* 创建组件模态框 */}
      <Modal isOpen={isCreateOpen} onClose={onCreateClose} size="5xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>创建JS组件</ModalHeader>
          <ModalBody>
            <JSComponentCreator onSave={handleComponentSaved} onCancel={onCreateClose} />
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* 编辑组件模态框 */}
      <Modal isOpen={isEditOpen} onClose={onEditClose} size="5xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>编辑JS组件</ModalHeader>
          <ModalBody>
            {selectedComponent && (
              <JSComponentCreator component={selectedComponent} onSave={handleComponentSaved} onCancel={onEditClose} />
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* 删除确认模态框 */}
      <Modal isOpen={isDeleteOpen} onClose={onDeleteClose}>
        <ModalContent>
          <ModalHeader>确认删除</ModalHeader>
          <ModalBody>
            <p>确定要删除这个JS组件吗？此操作不可撤销。</p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onDeleteClose}>
              取消
            </Button>
            <Button color="danger" onPress={handleDelete}>
              删除
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
