import { FC, useState, useEffect } from 'react'
import { Button, useDisclosure } from '@heroui/react'
import { ArrowLeft, Upload, Plus } from 'lucide-react'
import { useParams, useNavigate } from 'react-router-dom'
import { SettingContainer } from '..'
import { JSComponentCreator } from './JSComponentCreator'
import ComponentImportDialog from '@renderer/components/ComponentImportDialog'
import { componentService } from '@renderer/services/ComponentService'
import { JSComponentConfig } from '@renderer/types/component'

const JSComponentSettings: FC = () => {
  const { componentId } = useParams<{ componentId: string }>()
  const navigate = useNavigate()
  const [component, setComponent] = useState<JSComponentConfig | null>(null)
  const [loading, setLoading] = useState(false)

  // 导入对话框状态
  const { isOpen: isImportOpen, onOpen: onImportOpen, onClose: onImportClose } = useDisclosure()

  const isEditMode = !!componentId

  // 加载组件数据（编辑模式）
  useEffect(() => {
    if (isEditMode && componentId) {
      setLoading(true)
      const loadComponent = async () => {
        try {
          const components = componentService.getJSComponents()
          const foundComponent = components.find((c) => c.id === componentId)
          if (foundComponent) {
            setComponent(foundComponent)
          } else {
            window.toast.error('组件不存在')
            navigate('/settings/components')
          }
        } catch (error) {
          console.error('Failed to load component:', error)
          window.toast.error('加载组件失败')
          navigate('/settings/components')
        } finally {
          setLoading(false)
        }
      }
      loadComponent()
    }
  }, [componentId, isEditMode, navigate])

  const handleSave = () => {
    // 保存成功后返回组件列表
    navigate('/settings/components')
  }

  const handleCancel = () => {
    // 取消后返回组件列表
    navigate('/settings/components')
  }

  const handleImportSuccess = () => {
    // 导入成功后返回组件列表
    navigate('/settings/components')
  }

  if (loading) {
    return (
      <SettingContainer>
        <div className="flex items-center justify-center p-8">
          <div>加载中...</div>
        </div>
      </SettingContainer>
    )
  }

  return (
    <SettingContainer>
      <div className="space-y-6">
        {/* 返回按钮和标题 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="flat" size="sm" startContent={<ArrowLeft size={16} />} onPress={handleCancel}>
              返回
            </Button>
            <h2 className="font-bold text-2xl">{isEditMode ? '编辑 JS 组件' : '创建 JS 组件'}</h2>
          </div>

          {/* 只在创建模式下显示导入和新建按钮 */}
          {!isEditMode && (
            <div className="flex gap-2">
              <Button
                variant="flat"
                color="secondary"
                size="sm"
                startContent={<Upload size={16} />}
                onPress={onImportOpen}>
                导入组件
              </Button>
              <Button
                color="primary"
                size="sm"
                startContent={<Plus size={16} />}
                onPress={() => {
                  /* 当前页面就是新建，不需要额外操作 */
                }}>
                新建组件
              </Button>
            </div>
          )}
        </div>

        {/* 组件创建/编辑器 */}
        <JSComponentCreator component={component ?? undefined} onSave={handleSave} onCancel={handleCancel} />
      </div>

      {/* 导入对话框 */}
      <ComponentImportDialog
        isOpen={isImportOpen}
        onClose={onImportClose}
        onSuccess={handleImportSuccess}
        componentType="js"
      />
    </SettingContainer>
  )
}

export default JSComponentSettings
