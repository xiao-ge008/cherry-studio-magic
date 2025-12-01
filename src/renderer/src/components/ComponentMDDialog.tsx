/**
 * 组件使用说明编辑对话框 - 完全重写版本
 */

import { Button, Chip, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Textarea } from '@heroui/react'
import { fetchGenerate } from '@renderer/services/ApiService'
import { componentService } from '@renderer/services/ComponentService'
import type { RootState } from '@renderer/store'
import { handleSaveData } from '@renderer/store'
import type { ComponentConfig } from '@renderer/types/component'
import { Copy, Eye, FileText, Hash, Save, Sparkles, Target } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'

interface ComponentMDDialogProps {
  isOpen: boolean
  onClose: () => void
  component: ComponentConfig | null
}

const ComponentMDDialog: React.FC<ComponentMDDialogProps> = ({ isOpen, onClose, component }) => {
  const [mdContent, setMdContent] = useState('')
  const [copied, setCopied] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [activeTab, setActiveTab] = useState<'purpose' | 'triggers' | 'usage' | 'preview'>('purpose')

  // 获取默认模型
  const defaultModel = useSelector((state: RootState) => state.llm.defaultModel)

  // 三个核心区块
  const [purpose, setPurpose] = useState('')
  const [triggers, setTriggers] = useState('')
  const [usage, setUsage] = useState('')

  // 原始模板
  const [templateMarkdown, setTemplateMarkdown] = useState('')

  // 解析 Markdown 的三个部分
  const parseSections = (markdown: string) => {
    const lines = markdown.split('\n')
    const purposeLines: string[] = []
    const triggerLines: string[] = []
    const usageLines: string[] = []

    type Section = 'purpose' | 'trigger' | 'usage' | null
    let current: Section = null

    const getHeading = (line: string): Section => {
      const trimmed = line.trim()
      if (trimmed.startsWith('### 1.') || (trimmed.startsWith('###') && trimmed.includes('用途'))) return 'purpose'
      if (trimmed.startsWith('### 2.') || (trimmed.startsWith('###') && trimmed.includes('触发'))) return 'trigger'
      if (
        trimmed.startsWith('### 3.') ||
        (trimmed.startsWith('###') && (trimmed.includes('使用') || trimmed.toLowerCase().includes('how to use'))) ||
        (trimmed.startsWith('###') && (trimmed.includes('示例') || trimmed.toLowerCase().includes('example')))
      )
        return 'usage'
      return null
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const heading = getHeading(line)
      if (heading) {
        current = heading
        continue
      }

      if (line.trim().startsWith('### ')) {
        current = null
      }

      if (current === 'purpose') purposeLines.push(line)
      else if (current === 'trigger') triggerLines.push(line)
      else if (current === 'usage') usageLines.push(line)
    }

    return {
      purpose: purposeLines.join('\n').trim(),
      triggers: triggerLines.join('\n').trim(),
      usage: usageLines.join('\n').trim()
    }
  }

  // 构建 Markdown
  const buildMarkdownFromSections = (
    markdown: string,
    sections: { purpose: string; triggers: string; usage: string }
  ) => {
    const lines = markdown.split('\n')
    const out: string[] = []

    const replaceSection = (startIndex: number, content: string) => {
      let i = startIndex
      out.push(lines[i])

      const contentLines = content.trim().length > 0 ? content.split('\n') : []
      out.push('')
      out.push(...contentLines)

      while (i + 1 < lines.length && !lines[i + 1].trim().startsWith('### ')) {
        i++
      }
      return i
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()

      if (trimmed.startsWith('### 1.') || (trimmed.startsWith('###') && trimmed.includes('用途'))) {
        i = replaceSection(i, sections.purpose)
        continue
      }

      if (trimmed.startsWith('### 2.') || (trimmed.startsWith('###') && trimmed.includes('触发'))) {
        i = replaceSection(i, sections.triggers)
        continue
      }

      if (
        trimmed.startsWith('### 3.') ||
        (trimmed.startsWith('###') && (trimmed.includes('使用') || trimmed.toLowerCase().includes('how to use')))
      ) {
        i = replaceSection(i, sections.usage)
        continue
      }

      out.push(line)
    }

    return out.join('\n').trim()
  }

  // 生成/加载
  useEffect(() => {
    if (!isOpen || !component) return

    try {
      const maybeSaved = (component as any).skillPromptMarkdown as string | undefined
      const prompt =
        maybeSaved ||
        componentService.generateComponentPrompt(component.id, {
          includeExamples: true,
          includeParameterDetails: true,
          language: 'zh-CN',
          format: 'markdown'
        }) ||
        ''

      setTemplateMarkdown(prompt)
      setMdContent(prompt)

      const sections = parseSections(prompt)
      setPurpose(sections.purpose)
      setTriggers(sections.triggers)
      setUsage(sections.usage)
    } catch (error) {
      console.error('Failed to generate MD:', error)
      setMdContent('生成组件使用说明失败，请稍后重试。')
    }
  }, [isOpen, component])

  // 同步 - 实时更新预览
  useEffect(() => {
    // 强制使用固定格式
    const newContent = `## 组件：${component?.name || ''}

### 1. 用途（What it does）
${purpose || ''}

### 2. 触发条件（When to trigger）
${triggers || ''}

### 3. 使用方法（How to use）
${usage || ''}`

    setMdContent(newContent)
  }, [purpose, triggers, usage, component])

  // 复制
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(mdContent)
      setCopied(true)
      window.toast.success('已复制到剪贴板')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
      window.toast.error('复制失败')
    }
  }

  // 保存
  const handleSave = async () => {
    if (!component || !mdContent.trim()) return

    try {
      const finalPrompt = buildMarkdownFromSections(templateMarkdown || mdContent, {
        purpose,
        triggers,
        usage
      })

      console.log('[ComponentMDDialog] 准备保存:', {
        componentId: component.id,
        finalPromptLength: finalPrompt.length,
        skillPromptMarkdown: finalPrompt.substring(0, 200) + '...'
      })

      const ok = componentService.updateComponentConfig(component.id, {
        skillPromptMarkdown: finalPrompt
      })

      console.log('[ComponentMDDialog] 保存结果:', { ok })

      if (ok) {
        // 强制刷新 Redux persistor，确保数据立即写入本地存储
        console.log('[ComponentMDDialog] 刷新 Redux persistor...')
        await handleSaveData()
        console.log('[ComponentMDDialog] Redux persistor 刷新完成')

        // 验证保存后的数据
        const savedComponent = componentService.getComponentConfig(component.id)
        console.log('[ComponentMDDialog] 保存后验证:', {
          hasSkillPromptMarkdown: !!savedComponent?.skillPromptMarkdown,
          savedLength: savedComponent?.skillPromptMarkdown?.length || 0
        })

        setMdContent(finalPrompt)
        window.toast.success('组件提示词已保存')
      } else {
        console.error('[ComponentMDDialog] 保存失败: updateComponentConfig 返回 false')
        window.toast.error('保存失败')
      }
    } catch (error) {
      console.error('[ComponentMDDialog] 保存异常:', error)
      window.toast.error('保存失败')
    }
  }

  // 关闭
  const handleClose = () => {
    onClose()
    setCopied(false)
    setActiveTab('purpose')
    setMdContent('')
    setPurpose('')
    setTriggers('')
    setUsage('')
    setTemplateMarkdown('')
  }

  // AI智能生成
  const handleAIGenerate = async () => {
    if (!component || generating) {
      console.log('[AI生成] 条件不满足:', { component: !!component, generating })
      return
    }

    if (!defaultModel) {
      window.toast.error('请先在设置中配置默认聊天模型')
      console.log('[AI生成] 没有默认模型')
      return
    }

    console.log('[AI生成] 开始生成...')
    setGenerating(true)
    window.toast.info('正在生成组件说明...')

    try {
      // 构建参数信息
      const paramsInfo = component.parameters
        .map((p) => `- ${p.name} (${p.type}): ${p.description} ${p.required ? '[必填]' : '[可选]'}`)
        .join('\n')

      // 构建prompt
      const systemPrompt = `你是技术文档助手。根据组件信息生成JSON格式的使用说明。

输出JSON格式：
{
  "purpose": "组件用途（2-3句话）",
  "triggers": "触发条件和场景",
  "usage": "使用方法和参数说明"
}`

      const userContent = `组件: ${component.name}
描述: ${component.description}
参数:
${paramsInfo}`

      // 调用API
      console.log('[AI生成] 调用fetchGenerate...')
      const response = await fetchGenerate({
        prompt: systemPrompt,
        content: userContent,
        model: defaultModel
      })

      console.log('[AI生成] 收到响应，长度:', response?.length || 0)

      // 空响应检查
      if (!response || !response.trim()) {
        console.error('[AI生成] 响应为空')
        window.toast.error('AI未返回内容，请检查模型和API配置')
        return
      }

      // 解析JSON
      let data: any
      try {
        data = JSON.parse(response)
      } catch (e) {
        // 尝试提取JSON
        const jsonMatch = response.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          try {
            data = JSON.parse(jsonMatch[0])
          } catch (e2) {
            console.error('[AI生成] JSON解析失败')
            window.toast.error('AI响应格式错误，请重试')
            return
          }
        } else {
          console.error('[AI生成] 无法提取JSON')
          window.toast.error('AI响应格式错误，请重试')
          return
        }
      }

      // 填充数据
      if (data.purpose) setPurpose(data.purpose.trim())
      if (data.triggers) setTriggers(data.triggers.trim())
      if (data.usage) setUsage(data.usage.trim())

      setActiveTab('purpose')
      window.toast.success('智能生成完成！')
      console.log('[AI生成] 生成成功')
    } catch (error: any) {
      console.error('[AI生成] 捕获错误:', error)
      const msg = String(error?.message || error || '')

      if (msg.includes('401') || msg.toLowerCase().includes('unauthorized')) {
        window.toast.error('API认证失败，请配置API密钥')
      } else {
        window.toast.error(`生成失败: ${msg || '未知错误'}`)
      }
    } finally {
      setGenerating(false)
      console.log('[AI生成] 完成')
    }
  }

  if (!component) {
    return null
  }

  // Tab 按钮样式
  const tabButtonClass = (isActive: boolean) =>
    `px-4 py-2 text-sm font-medium transition-all ${
      isActive
        ? 'text-primary border-b-2 border-primary'
        : 'text-default-600 hover:text-default-900 border-b-2 border-transparent'
    }`

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="5xl" className="h-[95vh]" hideCloseButton>
      <ModalContent className="flex h-full flex-col">
        {/* Header */}
        <ModalHeader className="flex flex-shrink-0 items-center gap-3 border-divider border-b">
          <FileText size={18} className="text-primary-600" />
          <span className="font-medium text-base">组件使用说明</span>
          <Chip size="sm" color="primary" variant="flat">
            {component.name}
          </Chip>
          <span className="text-default-400 text-xs">
            {component.category === 'javascript'
              ? 'JavaScript'
              : component.category === 'comfyui'
                ? 'ComfyUI'
                : '内置组件'}
          </span>
        </ModalHeader>

        {/* Tab 导航 */}
        <div className="flex flex-shrink-0 gap-1 border-divider border-b px-6">
          <button
            type="button"
            className={tabButtonClass(activeTab === 'purpose')}
            onClick={() => setActiveTab('purpose')}>
            <div className="flex items-center gap-2">
              <Hash size={14} />
              <span>组件用途</span>
            </div>
          </button>
          <button
            type="button"
            className={tabButtonClass(activeTab === 'triggers')}
            onClick={() => setActiveTab('triggers')}>
            <div className="flex items-center gap-2">
              <Target size={14} />
              <span>触发条件</span>
            </div>
          </button>
          <button type="button" className={tabButtonClass(activeTab === 'usage')} onClick={() => setActiveTab('usage')}>
            <div className="flex items-center gap-2">
              <FileText size={14} />
              <span>使用方法</span>
            </div>
          </button>
          <button
            type="button"
            className={tabButtonClass(activeTab === 'preview')}
            onClick={() => setActiveTab('preview')}>
            <div className="flex items-center gap-2">
              <Eye size={14} />
              <span>Markdown 预览</span>
            </div>
          </button>
        </div>

        {/* Body - 内容区 */}
        <ModalBody className="flex-1 overflow-auto px-6 py-4">
          {activeTab === 'purpose' && (
            <div className="flex h-full flex-col gap-3">
              <div className="flex flex-shrink-0 items-center justify-between">
                <span className="text-default-600 text-sm">描述组件的主要功能和作用</span>
                <span className="text-default-400 text-xs">{purpose.length} 字符</span>
              </div>
              <div className="min-h-0 flex-1">
                <Textarea
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="例如：将文本转换为语音并播放，支持 TTS 语音合成功能。&#10;&#10;这是一个基于现代语音合成技术的组件，可以将任意文本转换为自然流畅的语音输出。"
                  variant="flat"
                  style={{
                    fontSize: '16px',
                    lineHeight: '1.75',
                    color: '#18181b'
                  }}
                  classNames={{
                    base: 'w-full h-full',
                    inputWrapper:
                      '!border-0 !shadow-none !outline-none !ring-0 bg-default-50 hover:bg-default-100 transition-colors h-full min-h-[500px]',
                    input: '!border-0 !shadow-none !outline-none !ring-0 !min-h-[480px]'
                  }}
                />
              </div>
            </div>
          )}

          {/* Tab 2: 触发条件 */}
          {activeTab === 'triggers' && (
            <div className="flex h-full flex-col gap-3">
              <div className="flex flex-shrink-0 items-center justify-between">
                <span className="text-default-600 text-sm">说明使用场景和关键词</span>
                <span className="text-default-400 text-xs">{triggers.length} 字符</span>
              </div>
              <div className="min-h-0 flex-1">
                <Textarea
                  value={triggers}
                  onChange={(e) => setTriggers(e.target.value)}
                  placeholder="例如：当用户提及以下关键词时应主动使用：&#10;- 语音播放、读出来、TTS&#10;- 转语音、念给我听&#10;&#10;适用场景：&#10;- 用户需要听取长文本内容"
                  variant="flat"
                  style={{
                    fontSize: '16px',
                    lineHeight: '1.75',
                    color: '#18181b'
                  }}
                  classNames={{
                    base: 'w-full h-full',
                    inputWrapper:
                      '!border-0 !shadow-none !outline-none !ring-0 bg-default-50 hover:bg-default-100 transition-colors h-full min-h-[500px]',
                    input: '!border-0 !shadow-none !outline-none !ring-0 !min-h-[480px]'
                  }}
                />
              </div>
            </div>
          )}

          {/* Tab 3: 使用方法 */}
          {activeTab === 'usage' && (
            <div className="flex h-full flex-col gap-3">
              <div className="flex flex-shrink-0 items-center justify-between">
                <span className="text-default-600 text-sm">说明标签格式和参数</span>
                <span className="text-default-400 text-xs">{usage.length} 字符</span>
              </div>
              <div className="min-h-0 flex-1">
                <Textarea
                  value={usage}
                  onChange={(e) => setUsage(e.target.value)}
                  placeholder="例如：在回答中输出以下格式：&#10;&#10;&lt;audio-audio-message text=&quot;文本内容&quot; /&gt;&#10;&#10;参数说明：&#10;- text: 必填"
                  variant="flat"
                  style={{
                    fontSize: '16px',
                    lineHeight: '1.75',
                    color: '#18181b'
                  }}
                  classNames={{
                    base: 'w-full h-full',
                    inputWrapper:
                      '!border-0 !shadow-none !outline-none !ring-0 bg-default-50 hover:bg-default-100 transition-colors h-full min-h-[500px]',
                    input: '!border-0 !shadow-none !outline-none !ring-0 !min-h-[480px]'
                  }}
                />
              </div>
            </div>
          )}

          {activeTab === 'preview' && (
            <div className="flex h-full flex-col gap-3">
              <div className="flex flex-shrink-0 items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-default-600 text-sm">完整 Markdown 内容</span>
                  <Chip size="sm" variant="flat" color="warning">
                    只读
                  </Chip>
                </div>
                <span className="text-default-400 text-xs">
                  {mdContent.length} 字符 · {mdContent.split('\n').length} 行
                </span>
              </div>
              <div className="min-h-0 flex-1">
                <Textarea
                  value={mdContent}
                  isReadOnly
                  placeholder="完整的 Markdown 内容"
                  variant="flat"
                  classNames={{
                    base: 'w-full h-full',
                    inputWrapper: '!border-0 !shadow-none !outline-none !ring-0 bg-warning-50/30 h-full min-h-[500px]',
                    input:
                      '!border-0 !shadow-none !outline-none !ring-0 text-[14px] leading-relaxed text-default-700 font-mono !min-h-[480px]'
                  }}
                />
              </div>
            </div>
          )}
        </ModalBody>

        {/* Footer */}
        <ModalFooter className="flex-shrink-0 gap-3 border-divider border-t">
          <Button variant="flat" onPress={handleClose} isDisabled={generating}>
            关闭
          </Button>
          <Button
            variant="flat"
            color="secondary"
            startContent={<Sparkles size={16} />}
            onPress={handleAIGenerate}
            isLoading={generating}
            isDisabled={generating || !component}>
            {generating ? '生成中...' : '智能生成'}
          </Button>
          <div className="flex-1"></div>
          <Button
            variant="flat"
            color={copied ? 'success' : 'default'}
            startContent={<Copy size={16} />}
            onPress={handleCopy}
            isDisabled={!mdContent || generating}>
            {copied ? '已复制' : '复制内容'}
          </Button>
          <Button
            variant="flat"
            color="primary"
            onPress={handleSave}
            isDisabled={!mdContent.trim() || generating}
            startContent={<Save size={16} />}>
            保存到配置
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default ComponentMDDialog
