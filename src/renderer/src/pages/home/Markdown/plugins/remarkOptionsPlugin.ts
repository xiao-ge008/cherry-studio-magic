import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'
import type { Text, Parent } from 'mdast'
import { OPTION_KEYWORDS, type OptionsData } from '@renderer/types/markdown'

/**
 * Remark 插件：识别并解析 options 选项语法
 *
 * 支持的格式：
 * - options ["选项1", "选项2", "选项3"]
 * - choices ["选项1", "选项2", "选项3"]
 * - select ["选项1", "选项2", "选项3"]
 *
 * 设计目标：
 * - 完全不受段落结构和 <br> 影响，只要某个 text 节点里出现 options [...] 就转换
 * - 兼容「——小雨的引导选项—— options [...]」等行内写法
 */

interface OptionsNode extends Parent {
  type: 'options'
  data: {
    hName: 'div'
    hProperties: {
      'data-options': string
      className: 'markdown-options'
    }
  }
  children: []
}

function parseOptionsText(text: string): OptionsData | null {
  // 匹配 keyword ["选项1", "选项2", "选项3"]
  // 不使用单词边界，只要出现 options/choices/select [...] 就解析。
  const optionRegex = new RegExp(`(${OPTION_KEYWORDS.join('|')})\\s*\\[([^\\]]+)\\]`, 'i')

  const match = optionRegex.exec(text)
  if (!match) return null

  const keyword = match[1].toLowerCase()
  const optionsStr = match[2]

  try {
    // 提取引号包裹的内容，支持单引号和双引号
    const optionMatches = optionsStr.match(/"([^"]+)"|'([^']+)'/g)
    if (!optionMatches) return null

    const options = optionMatches
      .map((opt) => opt.replace(/^["']|["']$/g, '')) // 去掉首尾引号
      .filter((opt) => opt.trim().length > 0)

    if (options.length === 0) return null

    return {
      options,
      keyword,
      rawText: match[0]
    }
  } catch (error) {
    console.warn('Failed to parse options:', error)
    return null
  }
}

/**
 * 在 text 节点层面处理 options 语法，这样无论段落里是否包含 <br> / html 等其它节点，都不会影响识别。
 */
const remarkOptionsPlugin: Plugin = function () {
  return (tree) => {
    visit(tree, 'text', (node: Text, index, parent) => {
      if (!parent || typeof index !== 'number') return

      const optionsData = parseOptionsText(node.value)
      if (!optionsData) return

      const startIndex = node.value.indexOf(optionsData.rawText)
      const beforeText = node.value.substring(0, startIndex)
      const afterText = node.value.substring(startIndex + optionsData.rawText.length)

      const newNodes: any[] = []

      if (beforeText.trim()) {
        newNodes.push({
          type: 'text',
          value: beforeText
        })
      }

      const optionsNode: OptionsNode = {
        type: 'options',
        data: {
          hName: 'div',
          hProperties: {
            'data-options': JSON.stringify(optionsData),
            className: 'markdown-options'
          }
        },
        children: []
      }

      newNodes.push(optionsNode)

      if (afterText.trim()) {
        newNodes.push({
          type: 'text',
          value: afterText
        })
      }

      if (newNodes.length === 1) {
        ;(parent as Parent).children[index] = newNodes[0]
      } else {
        ;(parent as Parent).children.splice(index, 1, ...newNodes)
      }
    })
  }
}

export default remarkOptionsPlugin

