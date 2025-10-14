import 'katex/dist/katex.min.css'
import 'katex/dist/contrib/copy-tex'
import 'katex/dist/contrib/mhchem'
import 'remark-github-blockquote-alert/alert.css'

import ImageViewer from '@renderer/components/ImageViewer'
import MarkdownShadowDOMRenderer from '@renderer/components/MarkdownShadowDOMRenderer'
import { useSettings } from '@renderer/hooks/useSettings'
import { useSmoothStream } from '@renderer/hooks/useSmoothStream'
import type { MainTextMessageBlock, ThinkingMessageBlock, TranslationMessageBlock } from '@renderer/types/newMessage'
import { removeSvgEmptyLines } from '@renderer/utils/formats'
import { processLatexBrackets } from '@renderer/utils/markdown'
import { isEmpty } from 'lodash'
import { type FC, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown, { type Components, defaultUrlTransform } from 'react-markdown'
import rehypeKatex from 'rehype-katex'
// @ts-ignore rehype-mathjax is not typed
import rehypeMathjax from 'rehype-mathjax'
import rehypeRaw from 'rehype-raw'
import remarkCjkFriendly from 'remark-cjk-friendly'
import remarkGfm from 'remark-gfm'
import remarkAlert from 'remark-github-blockquote-alert'
import remarkMath from 'remark-math'
import { Pluggable } from 'unified'

import CodeBlock from './CodeBlock'
import Link from './Link'
import MarkdownSvgRenderer from './MarkdownSvgRenderer'
import MarkdownAudioRenderer from './MarkdownAudioRenderer'
import MarkdownAudioMessage from './MarkdownAudioMessage'
// import MarkdownAudioMessage from './MarkdownAudioMessage'
import OptionsComponent from './OptionsComponent'
import ComfyUIComponent from './ComfyUIComponent'
import { JSComponent } from './JSComponent'
import { componentService } from '@renderer/services/ComponentService'
import rehypeHeadingIds from './plugins/rehypeHeadingIds'
import rehypeScalableSvg from './plugins/rehypeScalableSvg'
import remarkDisableConstructs from './plugins/remarkDisableConstructs'
import remarkOptionsPlugin from './plugins/remarkOptionsPlugin'
import Table from './Table'

const ALLOWED_ELEMENTS =
  /<(style|audio-message|js-component|audio|source|p|div|span|b|i|strong|em|ul|ol|li|table|tr|td|th|thead|tbody|h[1-6]|blockquote|pre|code|br|hr|svg|path|circle|rect|line|polyline|polygon|text|g|defs|title|desc|tspan|sub|sup|details|summary|comfyui-[a-zA-Z0-9_-]+|js-[a-zA-Z0-9_-]+)/i
const DISALLOWED_ELEMENTS = ['iframe', 'script']

interface Props {
  // message: Message & { content: string }
  block: MainTextMessageBlock | TranslationMessageBlock | ThinkingMessageBlock
  // 可选的后处理函数，用于在流式渲染过程中处理文本（如引用标签转换）
  postProcess?: (text: string) => string
}

const Markdown: FC<Props> = ({ block, postProcess }) => {
  const { t } = useTranslation()
  const { mathEngine, mathEnableSingleDollar } = useSettings()

  const isTrulyDone = 'status' in block && block.status === 'success'
  const [displayedContent, setDisplayedContent] = useState(postProcess ? postProcess(block.content) : block.content)
  const [isStreamDone, setIsStreamDone] = useState(isTrulyDone)

  const prevContentRef = useRef(block.content)
  const prevBlockIdRef = useRef(block.id)

  const { addChunk, reset } = useSmoothStream({
    onUpdate: (rawText) => {
      // 如果提供了后处理函数就调用，否则直接使用原始文本
      const finalText = postProcess ? postProcess(rawText) : rawText
      setDisplayedContent(finalText)
    },
    streamDone: isStreamDone,
    initialText: block.content
  })

  useEffect(() => {
    const newContent = block.content || ''
    const oldContent = prevContentRef.current || ''

    const isDifferentBlock = block.id !== prevBlockIdRef.current

    const isContentReset = oldContent && newContent && !newContent.startsWith(oldContent)

    if (isDifferentBlock || isContentReset) {
      reset(newContent)
    } else {
      const delta = newContent.substring(oldContent.length)
      if (delta) {
        addChunk(delta)
      }
    }

    prevContentRef.current = newContent
    prevBlockIdRef.current = block.id

    // 更新 stream 状态
    const isStreaming = block.status === 'streaming'
    setIsStreamDone(!isStreaming)
  }, [block.content, block.id, block.status, addChunk, reset])

  const remarkPlugins = useMemo(() => {
    const plugins = [
      [remarkGfm, { singleTilde: false }] as Pluggable,
      [remarkAlert] as Pluggable,
      remarkCjkFriendly,
      remarkDisableConstructs(['codeIndented']),
      remarkOptionsPlugin
    ]
    if (mathEngine !== 'none') {
      plugins.push([remarkMath, { singleDollarTextMath: mathEnableSingleDollar }])
    }
    return plugins
  }, [mathEngine, mathEnableSingleDollar])

  const messageContent = useMemo(() => {
    if ('status' in block && block.status === 'paused' && isEmpty(block.content)) {
      return t('message.chat.completion.paused')
    }
    return removeSvgEmptyLines(processLatexBrackets(displayedContent))
  }, [block, displayedContent, t])

  const rehypePlugins = useMemo(() => {
    const plugins: Pluggable[] = []
    if (ALLOWED_ELEMENTS.test(messageContent)) {
      plugins.push(rehypeRaw, rehypeScalableSvg)
    }
    plugins.push([rehypeHeadingIds, { prefix: `heading-${block.id}` }])
    if (mathEngine === 'KaTeX') {
      plugins.push(rehypeKatex)
    } else if (mathEngine === 'MathJax') {
      plugins.push(rehypeMathjax)
    }
    return plugins
  }, [mathEngine, messageContent, block.id])

  // 获取ComfyUI组件列表，使用独立的useMemo避免循环依赖
  const comfyUIComponents = useMemo(() => {
    try {
      return componentService.getComfyUIComponents()
    } catch (error) {
      console.warn('Failed to get ComfyUI components:', error)
      return []
    }
  }, [])

  const components = useMemo(() => {
    // 获取JS组件列表
    const jsComponents = componentService.getJSComponents()

    const baseComponents = {
      a: (props: any) => <Link {...props} />,
      code: (props: any) => <CodeBlock {...props} blockId={block.id} />,
      table: (props: any) => <Table {...props} blockId={block.id} />,
      img: (props: any) => <ImageViewer style={{ maxWidth: 500, maxHeight: 500 }} {...props} />,
      audio: (props: any) => <MarkdownAudioRenderer {...props} />,
      'audio-message': (props: any) => <MarkdownAudioMessage {...props} />,
      pre: (props: any) => <pre style={{ overflow: 'visible' }} {...props} />,
      p: (props) => {
        const hasImage = props?.node?.children?.some((child: any) => child.tagName === 'img')
        const hasOptionsComponent = props?.node?.children?.some(
          (child: any) =>
            child.type === 'element' &&
            child.tagName === 'div' &&
            child.properties?.className?.includes('markdown-options')
        )

        if (hasImage || hasOptionsComponent) return <div {...props} />
        return <p {...props} />
      },
      svg: MarkdownSvgRenderer,
      div: (props: any) => {
        // 检查是否是选项组件
        if (props.className === 'markdown-options' && props['data-options']) {
          return <OptionsComponent {...props} />
        }
        return <div {...props} />
      }
    } as Partial<Components>

    // 动态添加ComfyUI组件
    comfyUIComponents.forEach((component) => {
      const tagName = `comfyui-${component.componentName}`
      baseComponents[tagName] = (props: any) => {
        // 生成唯一key，确保多个相同组件能独立渲染
        const uniqueKey = `${component.componentName}-${JSON.stringify(props)}-${Math.random().toString(36).substr(2, 9)}`
        return <ComfyUIComponent key={uniqueKey} componentName={component.componentName} {...props} />
      }

      // 同时注册小写版本以确保兼容性
      const lowerTagName = `comfyui-${component.componentName.toLowerCase()}`
      if (lowerTagName !== tagName) {
        baseComponents[lowerTagName] = (props: any) => {
          const uniqueKey = `${component.componentName}-${JSON.stringify(props)}-${Math.random().toString(36).substr(2, 9)}`
          return <ComfyUIComponent key={uniqueKey} componentName={component.componentName} {...props} />
        }
      }
    })

    // 动态添加JS组件
    jsComponents.forEach((component) => {
      const tagName = `js-${component.componentName}`
      baseComponents[tagName] = (props: any) => {
        // 生成唯一key，确保多个相同组件能独立渲染
        const uniqueKey = `${component.componentName}-${JSON.stringify(props)}-${Math.random().toString(36).substr(2, 9)}`
        return <JSComponent key={uniqueKey} name={component.componentName} {...props} />
      }

      // 同时注册小写版本以确保兼容性
      const lowerTagName = `js-${component.componentName.toLowerCase()}`
      if (lowerTagName !== tagName) {
        baseComponents[lowerTagName] = (props: any) => {
          const uniqueKey = `${component.componentName}-${JSON.stringify(props)}-${Math.random().toString(36).substr(2, 9)}`
          return <JSComponent key={uniqueKey} name={component.componentName} {...props} />
        }
      }
    })

    return baseComponents
  }, [block.id, comfyUIComponents])

  if (/<style\b[^>]*>/i.test(messageContent)) {
    components.style = MarkdownShadowDOMRenderer as any
  }

  const urlTransform = useCallback((value: string) => {
    if (value.startsWith('data:image/png') || value.startsWith('data:image/jpeg')) return value

    // 转换comfyui URL为自定义协议
    if (value.includes('comfyui-') || value.includes('comfy-')) {
      // 提取组件名和参数
      const match = value.match(/comfy(?:ui)?-([a-zA-Z0-9_-]+)(\?.*)?$/)
      if (match) {
        const componentName = match[1]
        const queryString = match[2] || ''
        return `comfyui://${componentName}${queryString}`
      }
    }

    return defaultUrlTransform(value)
  }, [])

  return (
    <div className="markdown">
      <ReactMarkdown
        rehypePlugins={rehypePlugins}
        remarkPlugins={remarkPlugins}
        components={components}
        disallowedElements={DISALLOWED_ELEMENTS}
        urlTransform={urlTransform}
        remarkRehypeOptions={{
          footnoteLabel: t('common.footnotes'),
          footnoteLabelTagName: 'h4',
          footnoteBackContent: ' '
        }}>
        {messageContent}
      </ReactMarkdown>
    </div>
  )
}

export default memo(Markdown)
