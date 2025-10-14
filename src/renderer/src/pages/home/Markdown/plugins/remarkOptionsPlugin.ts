import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'
import type { Text, Parent } from 'mdast'
import { OPTION_KEYWORDS, type OptionsData } from '@renderer/types/markdown'

/**
 * Remark插件：识别和解析选项格式
 *
 * 支持的格式：
 * - options ["选项1", "选项2", "选项3"]
 * - choices ["选项1", "选项2", "选项3"]
 * - select ["选项1", "选项2", "选项3"]
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

/**
 * 解析选项文本，提取选项数组
 * @param text 包含选项的文本
 * @returns 解析后的选项数据，如果解析失败返回null
 */
function parseOptionsText(text: string): OptionsData | null {
  // 匹配格式：keyword ["选项1", "选项2", "选项3"]
  const optionRegex = new RegExp(`\\b(${OPTION_KEYWORDS.join('|')})\\s*\\[([^\\]]+)\\]`, 'gi')

  const match = optionRegex.exec(text)
  if (!match) return null

  const keyword = match[1].toLowerCase()
  const optionsStr = match[2]

  try {
    // 解析选项字符串，支持单引号和双引号
    const optionMatches = optionsStr.match(/"([^"]+)"|'([^']+)'/g)
    if (!optionMatches) return null

    const options = optionMatches
      .map(
        (opt) => opt.replace(/^["']|["']$/g, '') // 移除引号
      )
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
 * Remark插件：将选项格式转换为特殊的AST节点
 */
const remarkOptionsPlugin: Plugin = function () {
  return (tree) => {
    visit(tree, 'text', (node: Text, index, parent) => {
      if (!parent || typeof index !== 'number') return

      const optionsData = parseOptionsText(node.value)
      if (!optionsData) return

      // 创建选项节点
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

      // 处理文本节点的分割
      const beforeText = node.value.substring(0, node.value.indexOf(optionsData.rawText))
      const afterText = node.value.substring(node.value.indexOf(optionsData.rawText) + optionsData.rawText.length)

      const newNodes: any[] = []

      // 添加前面的文本（如果有）
      if (beforeText.trim()) {
        newNodes.push({
          type: 'text',
          value: beforeText
        })
      }

      // 添加选项节点
      newNodes.push(optionsNode)

      // 添加后面的文本（如果有）
      if (afterText.trim()) {
        newNodes.push({
          type: 'text',
          value: afterText
        })
      }

      // 替换原节点
      if (newNodes.length === 1) {
        ;(parent as Parent).children[index] = newNodes[0]
      } else {
        ;(parent as Parent).children.splice(index, 1, ...newNodes)
      }
    })
  }
}

export default remarkOptionsPlugin
