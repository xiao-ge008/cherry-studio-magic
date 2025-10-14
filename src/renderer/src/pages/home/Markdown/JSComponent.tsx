import React, { useState, useEffect, useRef } from 'react'
import { Card, CardBody, Button, Spinner } from '@heroui/react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { componentService } from '@renderer/services/ComponentService'
import { JSComponentResult } from '@renderer/types/component'
// 内联JSON解析函数
function parseJsonSimple(value: any, paramName = 'unknown', debug = false): any {
  if (!value) return {}
  if (typeof value === 'object') return value

  if (typeof value === 'string') {
    // 1. URL解码
    try {
      const decoded = decodeURIComponent(value)
      const parsed = JSON.parse(decoded)
      if (debug) console.log(`[JSON Parser] URL解码成功 ${paramName}:`, parsed)
      return parsed
    } catch (e) {
      if (debug) console.warn(`[JSON Parser] URL解码失败 ${paramName}:`, (e as Error).message)
    }

    // 2. HTML实体解码
    try {
      const htmlDecoded = value
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
      const parsed = JSON.parse(htmlDecoded)
      if (debug) console.log(`[JSON Parser] HTML解码成功 ${paramName}:`, parsed)
      return parsed
    } catch (e) {
      if (debug) console.warn(`[JSON Parser] HTML解码失败 ${paramName}:`, (e as Error).message)
    }

    // 3. 直接解析
    try {
      const parsed = JSON.parse(value)
      if (debug) console.log(`[JSON Parser] 直接解析成功 ${paramName}:`, parsed)
      return parsed
    } catch (e) {
      if (debug) console.warn(`[JSON Parser] 直接解析失败 ${paramName}:`, (e as Error).message)
    }

    // 4. 单引号转换
    try {
      const fixedJson = value.replace(/'/g, '"')
      const parsed = JSON.parse(fixedJson)
      if (debug) console.log(`[JSON Parser] 单引号转换成功 ${paramName}:`, parsed)
      return parsed
    } catch (e) {
      if (debug) console.error(`[JSON Parser] 所有解析都失败 ${paramName}:`, (e as Error).message)
    }
  }

  return {}
}

interface JSComponentProps {
  name: string
  [key: string]: any
}

export const JSComponent: React.FC<JSComponentProps> = ({ name, ...props }) => {
  const [result, setResult] = useState<JSComponentResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 使用统一的JSON解析工具
  const parseJsonSafely = (value: string, key: string): any => {
    return parseJsonSimple(value, key, true)
  }

  const executeComponent = async () => {
    if (!name) {
      setError('Component name is required')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const jsComponents = componentService.getJSComponents()
      const component = jsComponents.find((c) => c.componentName === name)

      if (!component) {
        throw new Error(`JS component "${name}" is not registered`)
      }

      if (!component.enabled) {
        throw new Error(`JS component "${name}" is disabled`)
      }

      const parameters: Record<string, any> = {}

      Object.keys(props).forEach((key) => {
        if (key !== 'children') {
          // 改进参数解析，增加容错性
          let value = props[key]

          // 尝试解析可能的JSON字符串
          if (typeof value === 'string') {
            // 处理HTML实体转义的JSON
            if (value.includes('&quot;')) {
              value = value.replace(/&quot;/g, '"')
            }

            // 尝试解析JSON字符串
            if ((value.startsWith('{') && value.endsWith('}')) || (value.startsWith('[') && value.endsWith(']'))) {
              value = parseJsonSafely(value, key)
            }

            // 处理布尔值字符串
            if (value === 'true') value = true
            if (value === 'false') value = false

            // 处理数字字符串
            if (/^\d+(\.\d+)?$/.test(value)) {
              const numValue = Number(value)
              if (!isNaN(numValue)) value = numValue
            }
          }

          parameters[key] = value
        }
      })

      // 添加调试信息
      console.log(`[JS Component Debug] ${name}:`, {
        originalProps: props,
        parsedParameters: parameters,
        componentConfig: component
      })

      const executionResult = await componentService.executeJSComponent(component.id, parameters)
      setResult(executionResult)

      if (!executionResult.success) {
        console.error(`[JS Component Error] ${name}:`, {
          error: executionResult.error,
          parameters,
          component
        })
        setError(executionResult.error || 'Execution failed')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(errorMessage)
      console.error('JS component execution failed:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    executeComponent()
  }, [name, JSON.stringify(props)])

  const handleRetry = () => {
    executeComponent()
  }

  if (loading) {
    return (
      <Card className="my-4">
        <CardBody className="flex flex-row items-center gap-3 py-4">
          <Spinner size="sm" />
          <span className="text-default-600">Running JS component...</span>
        </CardBody>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="my-4 border-danger-200 bg-danger-50">
        <CardBody className="py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="mt-0.5 flex-shrink-0 text-danger" />
            <div className="min-w-0 flex-1">
              <div className="mb-1 font-medium text-danger">JS component execution failed</div>
              <div className="mb-3 text-danger-600 text-sm">{error}</div>
              <Button
                size="sm"
                color="danger"
                variant="flat"
                startContent={<RefreshCw size={14} />}
                onPress={handleRetry}>
                Retry
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    )
  }

  if (result?.success) {
    const content = result.output || ''

    if (result.type === 'html') {
      return <JSComponentHTMLRenderer content={content} componentName={name} />
    }

    return (
      <Card className="my-4">
        <CardBody className="py-4">
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-default-100 p-3 font-mono text-sm">
            {content}
          </pre>
          <div className="mt-2 text-default-500 text-xs">Execution time: {result.executionTime}ms</div>
        </CardBody>
      </Card>
    )
  }

  return (
    <Card className="my-4 border-warning-200 bg-warning-50">
      <CardBody className="py-4">
        <div className="flex items-center gap-2 text-warning-600">
          <AlertTriangle size={16} />
          <span className="text-sm">JS component state is unexpected</span>
        </div>
      </CardBody>
    </Card>
  )
}

const processComfyUIContent = (content: string) => {
  if (!content) {
    return content
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return content
  }

  const wrapper = document.createElement('div')
  wrapper.innerHTML = content

  const selector = 'img[src^="comfyui-"], img[src^="comfy-"], image[src^="comfyui-"], image[src^="comfy-"]'
  const targets = wrapper.querySelectorAll(selector)

  if (!targets.length) {
    return content
  }

  targets.forEach((element) => {
    const src = element.getAttribute('src')
    if (!src) return

    let normalized = src
    if (normalized.startsWith('comfyui-')) {
      normalized = normalized.substring('comfyui-'.length)
    } else if (normalized.startsWith('comfy-')) {
      normalized = normalized.substring('comfy-'.length)
    } else {
      return
    }

    const [componentNameRaw, queryString] = normalized.split('?')
    const componentName = componentNameRaw?.trim()
    if (!componentName) return

    const comfySrc = `comfyui://${componentName}${queryString ? `?${queryString}` : ''}`
    element.setAttribute('src', comfySrc)
    element.removeAttribute('onclick')
    element.setAttribute('data-comfy-component', componentName)
  })

  return wrapper.innerHTML
}

const JSComponentHTMLRenderer: React.FC<{ content: string; componentName: string }> = ({ content, componentName }) => {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const scripts = container.querySelectorAll('script')
    scripts.forEach((script) => {
      try {
        const newScript = document.createElement('script')
        if (script.src) {
          newScript.src = script.src
        } else {
          newScript.textContent = script.textContent
        }
        document.head.appendChild(newScript)
        setTimeout(() => {
          if (newScript.parentNode) {
            newScript.parentNode.removeChild(newScript)
          }
        }, 100)
      } catch (executionError) {
        console.warn(`JS component ${componentName} script execution failed:`, executionError)
      }
    })

    container.classList.add('js-component-root')

    const styleElement = document.createElement('style')
    styleElement.textContent = `
      .js-component-root {
        display: flex;
        justify-content: center;
        width: 100%;
        margin: 0;
        padding: 0;
      }
      .js-component-root .scoped-char-card {
        --bg-card: #ffffff;
        --border-color: #f0f0f0;
        --text-primary: #1f1f1f;
        --text-secondary: #6c757d;
        --accent-color: #fa709a;
        --progress-color: #f4a8cd;
        --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        font-family: var(--font-family);
        color: var(--text-primary);
        background-color: var(--bg-card);
        border-radius: 14px;
        box-shadow: 0 8px 28px rgba(0, 0, 0, 0.06);
        max-width: 680px;
        width: 100%;
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        padding: 12px 20px 18px;
        margin: 0 auto;
      }
      .js-component-root .scoped-char-card * {
        box-sizing: border-box;
      }
      .js-component-root .scoped-char-card p,
      .js-component-root .scoped-char-card span {
        white-space: normal;
        margin: 0;
        line-height: 1.55;
      }
      .js-component-root .scoped-char-card .card-header {
        text-align: center;
        padding: 0;
        margin-bottom: 6px;
      }
      .js-component-root .scoped-char-card h1 {
        margin: 10px 0 6px;
        font-size: 1.6em;
        font-weight: 700;
      }
      .js-component-root .scoped-char-card .tab-nav {
        display: flex;
        border-bottom: 2px solid var(--border-color);
        margin: 2px 0 6px;
        gap: 12px;
      }
      .js-component-root .scoped-char-card .tab-btn {
        flex: 1;
        padding: 6px 0;
        background: none;
        border: none;
        cursor: pointer;
        border-bottom: 3px solid transparent;
        font-size: 0.92em;
        font-weight: 500;
        color: var(--text-secondary);
        text-align: center;
        transition: all 0.2s ease-in-out;
        margin-bottom: -2px;
      }
      .js-component-root .scoped-char-card .tab-btn:hover {
        color: var(--text-primary);
      }
      .js-component-root .scoped-char-card .tab-btn.active {
        color: var(--accent-color);
        font-weight: 600;
        border-bottom-color: var(--accent-color);
      }
      .js-component-root .scoped-char-card .tab-content-wrapper {
        flex-grow: 0;
      }
      .js-component-root .scoped-char-card .tab-content {
        display: none;
        padding-top: 6px;
      }
      .js-component-root .scoped-char-card .tab-content.active {
        display: block;
        animation: scoped-char-card-fadeIn 0.2s;
      }
      @keyframes scoped-char-card-fadeIn {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
      .js-component-root .scoped-char-card .avatar-img-container {
        width: min(100%, 520px);
        margin: 0 auto 10px;
      }
      .js-component-root .scoped-char-card .avatar-img {
        width: 100%;
        height: auto;
        max-height: none;
        border-radius: 14px;
        object-fit: contain;
        background: #f1f3f5;
        cursor: pointer;
        box-shadow: 0 14px 34px rgba(15, 23, 42, 0.16);
      }
      .js-component-root .scoped-char-card .card-row {
        display: grid;
        grid-template-columns: 82px 1fr;
        gap: 10px;
        align-items: flex-start;
        padding: 8px 0;
        border-bottom: 1px solid var(--border-color);
        font-size: 0.95em;
      }
      .js-component-root .scoped-char-card .card-row:last-child {
        border-bottom: none;
      }
      .js-component-root .scoped-char-card .card-label {
        font-weight: 600;
        color: var(--text-primary);
        line-height: 1.5;
      }
      .js-component-root .scoped-char-card .card-value {
        color: var(--text-secondary);
        line-height: 1.55;
      }
      .js-component-root .scoped-char-card .progress-value-wrapper {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }
      .js-component-root .scoped-char-card .progress-description {
        font-size: 0.9em;
        line-height: 1.45;
      }
      .js-component-root .scoped-char-card .score-text {
        color: var(--progress-color);
        font-weight: 600;
      }
      .js-component-root .scoped-char-card progress {
        width: 100%;
        height: 6px;
        border-radius: 3px;
        background-color: #e9ecef;
        border: none;
      }
      .js-component-root .scoped-char-card progress::-webkit-progress-bar {
        background-color: #e9ecef;
        border-radius: 3px;
      }
      .js-component-root .scoped-char-card progress::-webkit-progress-value {
        background-color: var(--progress-color);
        border-radius: 3px;
      }
    `
    container.prepend(styleElement)

    const restoreStyles: Array<{ element: HTMLElement; property: string; value: string }> = []
    const applyStyle = (element: HTMLElement | null, property: string, value: string) => {
      if (!element) {
        return
      }
      restoreStyles.push({ element, property, value: element.style.getPropertyValue(property) })
      element.style.setProperty(property, value)
    }

    const paragraphWrapper = container.closest('p') as HTMLElement | null
    const messageContent = container.closest('.message-content-container') as HTMLElement | null
    const messageWrapper = container.closest('.message') as HTMLElement | null
    const bubbleWrapper = container.closest('.bubble') as HTMLElement | null

    applyStyle(paragraphWrapper, 'margin', '0')
    applyStyle(paragraphWrapper, 'white-space', 'normal')
    applyStyle(paragraphWrapper, 'line-height', 'normal')
    applyStyle(paragraphWrapper, 'display', 'block')
    applyStyle(paragraphWrapper, 'width', '100%')

    applyStyle(messageContent, 'padding-left', '0')
    applyStyle(messageContent, 'padding-right', '0')
    applyStyle(messageContent, 'padding-top', '8px')
    applyStyle(messageContent, 'padding-bottom', '16px')
    applyStyle(messageWrapper, 'padding', '4px 0')
    applyStyle(messageWrapper, 'margin', '0')
    applyStyle(bubbleWrapper, 'padding', '0')
    applyStyle(bubbleWrapper, 'margin', '0')

    const imageListeners: Array<{ element: HTMLImageElement; listener: (event: Event) => void }> = []
    const images = container.querySelectorAll<HTMLImageElement>('img[data-comfy-component]')

    images.forEach((image) => {
      image.style.display = 'block'
      image.style.margin = '0 auto'
      image.style.cursor = 'zoom-in'

      const listener = () => {
        const src = image.getAttribute('src')
        if (!src) {
          return
        }
        const alt = image.getAttribute('alt') || 'Preview Image'

        if (window.modal) {
          window.modal.info({
            centered: true,
            maskClosable: true,
            icon: null,
            width: 960,
            title: alt,
            content: (
              <div style={{ textAlign: 'center' }}>
                <img
                  src={src}
                  alt={alt}
                  style={{
                    maxWidth: '100%',
                    borderRadius: 16,
                    boxShadow: '0 18px 45px rgba(15, 23, 42, 0.25)'
                  }}
                />
              </div>
            )
          })
        } else {
          window.open(src, '_blank')
        }
      }

      image.addEventListener('click', listener)
      imageListeners.push({ element: image, listener })
    })

    return () => {
      styleElement.remove()
      container.classList.remove('js-component-root')
      restoreStyles.forEach(({ element, property, value }) => {
        if (value) {
          element.style.setProperty(property, value)
        } else {
          element.style.removeProperty(property)
        }
      })
      imageListeners.forEach(({ element, listener }) => {
        element.removeEventListener('click', listener)
      })
    }
  }, [content, componentName])

  const processedContent = processComfyUIContent(content).replace(/<(\w+)([^>]*?)>/g, (match, tagName, attributes) => {
    const needsConstraints = ['img', 'video', 'canvas', 'iframe', 'table', 'pre'].includes(tagName.toLowerCase())

    if (!needsConstraints) {
      return match
    }

    let constraintStyles = 'max-width: 100%; box-sizing: border-box;'

    if (['img', 'video', 'canvas', 'iframe'].includes(tagName.toLowerCase())) {
      constraintStyles += ' height: auto;'
    } else if (tagName.toLowerCase() === 'table') {
      constraintStyles += ' width: 100%; table-layout: fixed; border-collapse: collapse;'
    } else if (tagName.toLowerCase() === 'pre') {
      constraintStyles += ' white-space: pre-wrap; overflow-x: auto;'
    }

    const styleMatch = attributes.match(/style\s*=\s*["']([^"']*)["']/)
    if (styleMatch) {
      const existingStyles = styleMatch[1]
      const newAttributes = attributes.replace(
        /style\s*=\s*["']([^"']*)["']/,
        `style="${existingStyles}; ${constraintStyles}"`
      )
      return `<${tagName}${newAttributes}>`
    }

    return `<${tagName} style="${constraintStyles}"${attributes}>`
  })

  return (
    <div
      ref={containerRef}
      style={{
        maxWidth: '100%',
        boxSizing: 'border-box',
        overflow: 'visible',
        whiteSpace: 'normal',
        wordWrap: 'break-word'
      }}
      dangerouslySetInnerHTML={{ __html: processedContent }}
    />
  )
}

export default JSComponent
