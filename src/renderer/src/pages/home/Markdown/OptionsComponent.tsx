import { cn, Skeleton } from '@heroui/react'
import { loggerService } from '@logger'
import { EVENT_NAMES, EventEmitter } from '@renderer/services/EventService'
import type { OptionsData } from '@renderer/types/markdown'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const logger = loggerService.withContext('OptionsComponent')

interface OptionsComponentProps {
  /** 选项数据的JSON字符串 */
  'data-options': string
  /** 是否显示加载状态 */
  loading?: boolean
  /** 是否禁用所有选项 */
  disabled?: boolean
  /** 最大显示选项数量，超过则启用虚拟化（预留功能） */
  maxVisibleOptions?: number
  /** 选项选择回调 */
  onOptionSelect?: (option: string, optionsData: OptionsData) => void
  /** 其他HTML属性 */
  [key: string]: any
}

/**
 * 优化的Markdown选项组件
 * 使用HeroUI组件，支持键盘导航、无障碍访问和更好的用户体验
 */
const OptionsComponent: React.FC<OptionsComponentProps> = ({
  'data-options': dataOptions,
  loading = false,
  disabled = false,
  maxVisibleOptions = 50,
  onOptionSelect,
  ...props
}) => {
  const { t } = useTranslation()
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([])

  // 解析选项数据
  const optionsData = useMemo<OptionsData | null>(() => {
    if (!dataOptions) return null

    try {
      const parsed = JSON.parse(dataOptions)
      if (!parsed || !Array.isArray(parsed.options) || parsed.options.length === 0) {
        logger.warn('Invalid options data structure:', parsed)
        return null
      }
      return parsed
    } catch (error) {
      logger.error('Failed to parse options data:', error as Error)
      return null
    }
  }, [dataOptions])

  // 注意：虚拟化功能预留，当前版本暂未实现
  // const needsVirtualization = optionsData && optionsData.options.length > maxVisibleOptions

  // 处理选项点击
  const handleOptionClick = useCallback(
    (option: string, index: number) => {
      if (selectedOption || disabled) return

      setSelectedOption(option)

      try {
        // 调用外部回调
        if (onOptionSelect && optionsData) {
          onOptionSelect(option, optionsData)
        }

        // 通过EventEmitter发送消息
        EventEmitter.emit(EVENT_NAMES.SEND_OPTION_MESSAGE, {
          content: option,
          originalOptions: optionsData,
          selectedIndex: index
        })

        logger.info('Option selected:', { option, index })
      } catch (error) {
        logger.error('Error handling option selection:', error as Error)
      }
    },
    [selectedOption, disabled, onOptionSelect, optionsData]
  )

  // 键盘导航处理
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!optionsData || disabled) return

      const { options } = optionsData
      const maxIndex = options.length - 1

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          setFocusedIndex((prev) => Math.min(prev + 1, maxIndex))
          break
        case 'ArrowUp':
          event.preventDefault()
          setFocusedIndex((prev) => Math.max(prev - 1, 0))
          break
        case 'Enter':
        case ' ':
          event.preventDefault()
          if (focusedIndex >= 0 && focusedIndex <= maxIndex) {
            handleOptionClick(options[focusedIndex], focusedIndex)
          }
          break
        case 'Escape':
          setFocusedIndex(-1)
          break
      }
    },
    [optionsData, disabled, focusedIndex, handleOptionClick]
  )

  // 自动聚焦到第一个选项
  useEffect(() => {
    if (optionsData && optionsData.options.length > 0 && focusedIndex === -1) {
      setFocusedIndex(0)
    }
  }, [optionsData, focusedIndex])

  // 聚焦管理
  useEffect(() => {
    if (focusedIndex >= 0 && optionRefs.current[focusedIndex]) {
      optionRefs.current[focusedIndex]?.focus()
    }
  }, [focusedIndex])

  // 如果正在加载，显示骨架屏
  if (loading) {
    return (
      <div className="my-2 rounded-md border border-default-200/50 bg-default-50/50 p-2" {...props}>
        <div className="mb-2">
          <Skeleton className="h-3 w-32 rounded" />
        </div>
        <div className="space-y-1">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-full rounded" />
          ))}
        </div>
      </div>
    )
  }

  // 如果解析失败或没有选项，不渲染任何内容
  if (!optionsData || !optionsData.options.length) {
    return null
  }

  const { options, keyword } = optionsData

  return (
    <div
      className="my-2 rounded-md border border-default-200/50 bg-default-50/50 p-2"
      ref={containerRef}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="group"
      aria-label={t('message.markdown.options.title', { keyword })}
      {...props}>
      <div className="mb-2">
        <span className="font-medium text-default-500 text-xs">{t('message.markdown.options.title', { keyword })}</span>
      </div>
      <div className="space-y-1">
        {options.map((option, index) => {
          const isSelected = selectedOption === option
          // const isFocused = focusedIndex === index

          return (
            <button
              type="button"
              key={`${option}-${index}`}
              ref={(el) => {
                optionRefs.current[index] = el
              }}
              disabled={isSelected || disabled}
              className={cn(
                'w-full rounded p-2 text-left text-sm transition-colors duration-150',
                'border border-default-300 bg-white hover:bg-default-50',
                'focus:outline-none focus:ring-1 focus:ring-primary',
                isSelected && 'cursor-default bg-default-100 opacity-50',
                disabled && 'cursor-not-allowed'
              )}
              onClick={() => handleOptionClick(option, index)}
              onFocus={() => setFocusedIndex(index)}
              aria-pressed={isSelected}
              aria-describedby={isSelected ? 'selected-option-info' : undefined}>
              <span className="block leading-relaxed">{option}</span>
            </button>
          )
        })}
      </div>

      {selectedOption && (
        <div className="mt-2 border-default-200 border-t pt-2">
          <div id="selected-option-info" className="text-default-500 text-xs italic" role="status" aria-live="polite">
            {t('message.markdown.options.selected', { option: selectedOption })}
          </div>
        </div>
      )}
    </div>
  )
}

export default React.memo(OptionsComponent)
