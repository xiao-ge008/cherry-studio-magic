import { ActionIconButton } from '@renderer/components/Buttons'
import { QuickPanelListItem, QuickPanelReservedSymbol, useQuickPanel } from '@renderer/components/QuickPanel'
import { componentService } from '@renderer/services/ComponentService'
import { ComponentConfig } from '@renderer/types/component'
import { Tooltip } from 'antd'
import { Package } from 'lucide-react'
import React, { FC, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

export interface ComponentToolsButtonRef {
  openQuickPanel: () => void
}

interface Props {
  ref?: React.RefObject<ComponentToolsButtonRef | null>
  selectedComponentIds?: string[]
  onSelect: (componentIds: string[]) => void
}

const ComponentToolsButton: FC<Props> = ({ ref, selectedComponentIds, onSelect }) => {
  const { t } = useTranslation()
  const quickPanel = useQuickPanel()

  // 使用 ref 缓存最新的选中状态，避免回调中拿到旧的值
  const selectedIdsRef = useRef<string[] | undefined>(selectedComponentIds)

  useEffect(() => {
    selectedIdsRef.current = selectedComponentIds
  }, [selectedComponentIds])

  const handleComponentSelect = useCallback(
    (component: ComponentConfig) => {
      const current = selectedIdsRef.current ?? []
      const exists = current.includes(component.id)
      const next = exists ? current.filter((id) => id !== component.id) : [...current, component.id]
      onSelect(next)
    },
    [onSelect]
  )

  const items = useMemo<QuickPanelListItem[]>(() => {
    const enabledComponents = componentService.getEnabledComponents()

    const componentItems: QuickPanelListItem[] = enabledComponents.map((component) => ({
      label: component.name,
      description: component.description,
      icon: <Package />,
      action: () => handleComponentSelect(component),
      isSelected: selectedComponentIds?.includes(component.id)
    }))

    // 顶部展示“选择组件”作为列表标题提示，不执行任何操作
    componentItems.unshift({
      label: t('settings.components.select_components'),
      description: '',
      icon: <Package />,
      isSelected: false,
      action: () => {}
    })

    return componentItems
  }, [handleComponentSelect, selectedComponentIds, t])

  const openQuickPanel = useCallback(() => {
    quickPanel.open({
      title: t('settings.components.select_components'),
      list: items,
      symbol: QuickPanelReservedSymbol.Components,
      multiple: true,
      afterAction({ item }) {
        // 手动维护 isSelected 字段，用于实时刷新勾选状态
        item.isSelected = !item.isSelected
      }
    })
  }, [items, quickPanel, t])

  const handleOpenQuickPanel = useCallback(() => {
    if (quickPanel.isVisible && quickPanel.symbol === QuickPanelReservedSymbol.Components) {
      quickPanel.close()
    } else {
      openQuickPanel()
    }
  }, [openQuickPanel, quickPanel])

  // 选中状态变化时，如果面板已打开，需要同步列表状态
  useEffect(() => {
    if (quickPanel.isVisible && quickPanel.symbol === QuickPanelReservedSymbol.Components) {
      quickPanel.updateList(items)
    }
  }, [items, quickPanel])

  useImperativeHandle(ref, () => ({
    openQuickPanel
  }))

  return (
    <Tooltip placement="top" title={t('settings.components.select_components')} mouseLeaveDelay={0} arrow>
      <ActionIconButton
        onClick={handleOpenQuickPanel}
        active={!!selectedComponentIds && selectedComponentIds.length > 0}>
        <Package size={18} />
      </ActionIconButton>
    </Tooltip>
  )
}

export default memo(ComponentToolsButton)

