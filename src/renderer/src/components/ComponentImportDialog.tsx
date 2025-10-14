import React, { useMemo, useState } from 'react'
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Textarea } from '@heroui/react'
import { loggerService } from '@logger'
import { componentService } from '@renderer/services/ComponentService'
import {
  checkComponentConflicts,
  generateNewComponentName,
  generateNewId,
  parseImportFile,
  validateImportData
} from '@renderer/utils/componentExport'

type Props = {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  componentType?: 'comfyui' | 'js' | string
}

const logger = loggerService.withContext('ComponentImportDialog')

const ComponentImportDialog: React.FC<Props> = ({ isOpen, onClose, onSuccess, componentType }) => {
  const [working, setWorking] = useState(false)
  const [jsonText, setJsonText] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)

  const handleClose = () => {
    if (!working) onClose?.()
  }

  const doImport = async (importData: { type: string; component: any }) => {
    if (componentType && importData.type !== componentType) {
      window.toast?.error?.('组件类型不匹配')
      return
    }

    const validation = validateImportData(importData as any)
    if (!validation.valid) {
      logger.warn('Invalid import data', { errors: validation.errors })
      window.toast?.error?.('组件 JSON 无效，导入失败')
      return
    }

    // 冲突处理：生成副本，避免覆盖
    const conflicts = checkComponentConflicts(importData.component as any, importData.type as any)
    if (conflicts.length > 0) {
      const c = importData.component as any
      if (c.id) c.id = generateNewId(c.id)
      if (c.componentName)
        c.componentName = generateNewComponentName(c.componentName, importData.type as any)
    }

    if (importData.type === 'js') {
      await window.api.jscomponent.createComponent(importData.component)
      await componentService.syncJSComponents()
    } else {
      const current = componentService.getComponentSettings()
      const newSettings = {
        ...current,
        components: {
          ...current.components,
          [(importData.component as any).id]: {
            enabled: true,
            ...importData.component
          }
        },
        lastUpdated: Date.now()
      }
      componentService.updateComponentSettings(newSettings)
    }

    window.toast?.success?.('导入成功')
    onSuccess?.()
    onClose?.()
  }

  const handleImport = async () => {
    try {
      setWorking(true)
      const filePath = await window.api.select({
        title: 'Select component JSON',
        properties: ['openFile'],
        filters: [{ name: 'JSON', extensions: ['json'] }]
      })
      if (!filePath) return

      const content = await window.api.file.readExternal(String(filePath), true)
      if (!content) throw new Error('Failed to read file')

      const importData = parseImportFile(String(content))
      await doImport(importData)
    } catch (error) {
      logger.error('Component import failed', error as Error)
      window.toast?.error?.('导入失败')
    } finally {
      setWorking(false)
    }
  }

  const handleImportFromText = async () => {
    try {
      setWorking(true)
      setJsonError(null)
      const text = jsonText.trim()
      if (!text) {
        setJsonError('请输入组件 JSON 字符串')
        window.toast?.error?.('请输入组件 JSON 字符串')
        return
      }
      const importData = parseImportFile(text)
      await doImport(importData)
    } catch (e: any) {
      logger.warn('Paste JSON invalid', e)
      setJsonError(e?.message || 'JSON 无法解析或格式不正确')
      window.toast?.error?.('JSON 无法解析或格式不正确')
    } finally {
      setWorking(false)
    }
  }

  const header = useMemo(() => {
    if (componentType === 'js') return '导入 JS 组件'
    if (componentType === 'comfyui') return '导入 ComfyUI 组件'
    return '导入组件'
  }, [componentType])

  return (
    <Modal isOpen={isOpen} onOpenChange={handleClose} size="lg">
      <ModalContent>
        <ModalHeader>{header}</ModalHeader>
        <ModalBody>
          <p>选择一个导出的组件 JSON 文件，系统会自动合并到组件列表。</p>
          <div className="mt-2 text-foreground-500 text-sm">或直接粘贴组件 JSON 字符串：</div>
          <Textarea
            value={jsonText}
            onValueChange={(v) => {
              setJsonText(v)
              if (jsonError) setJsonError(null)
            }}
            minRows={6}
            placeholder={'在此粘贴组件 JSON...'}
            isInvalid={!!jsonError}
            errorMessage={jsonError || undefined}
            variant="bordered"
            // 允许在输入框内正常粘贴，同时阻止事件冒泡到全局 PasteService
            onPaste={(e) => e.stopPropagation()}
            onPasteCapture={(e) => e.stopPropagation()}
            classNames={{
              inputWrapper: [
                '!border-1',
                '!border-default-200',
                'data-[hover=true]:!border-default-300',
                'focus-within:!border-primary-500',
                '!shadow-none',
                'bg-default-50'
              ].join(' '),
              input: '!border-0 !outline-none focus-visible:!outline-none font-mono'
            }}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={handleClose} isLoading={working}>
            取消
          </Button>
          <Button color="primary" onPress={handleImport} isLoading={working}>
            选择文件并导入
          </Button>
          <Button color="secondary" onPress={handleImportFromText} isLoading={working}>
            粘贴 JSON 并导入
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default ComponentImportDialog
