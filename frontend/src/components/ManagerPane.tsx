import { useEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react'
import NoteToolbar, { type NoteMenu } from './NoteToolbar'
import NoteNavColumn from './NoteNavColumn'
import SettingsPanel from './SettingsPanel'
import type { ComponentProps } from 'react'
import type { PanelId, PanelVisibility } from '../lib/panelVisibility'
import type { NotePlaceId } from './NotePlaceBar'
import type { useInterpretSettings } from '../hooks/useInterpretSettings'
import type { WindowLayoutPresetsApi } from '../hooks/useWindowLayoutPresets'
import { useCatalogPanelWidth } from '../hooks/useCatalogPanelWidth'

type NavColumnProps = ComponentProps<typeof NoteNavColumn>

type Props = {
  version?: string
  activeMenu: NoteMenu
  onPickMenu: (menu: NoteMenu) => void
  onMinimizeToPill: () => void
  onRestoreWindow?: () => void
  onMouseDown?: (e: ReactMouseEvent<HTMLDivElement>) => void
  panels: PanelVisibility
  onSetPanel: (id: PanelId, on: boolean) => void
  hidePanels?: PanelId[]
  hasScope?: boolean
  navColumn: NavColumnProps
  catalogAutoAdd?: boolean
  onCatalogAutoAddChange?: (auto: boolean) => void
  settings: ReturnType<typeof useInterpretSettings>
  layoutPresets: WindowLayoutPresetsApi
  layoutPlace: NotePlaceId
  onPickPlace: (place: NotePlaceId) => void
  showWakeReader?: boolean
  /** onWidthChange 管理区总宽（供穿透带几何同步）。 */
  onWidthChange?: (width: number) => void
  className?: string
}

/** ManagerPane 左侧主管理壳：顶栏视图 / 笔记本·目录 / 配置。 */
export default function ManagerPane({
  version,
  activeMenu,
  onPickMenu,
  onMinimizeToPill,
  onRestoreWindow,
  onMouseDown,
  panels,
  onSetPanel,
  hidePanels,
  hasScope = true,
  navColumn,
  catalogAutoAdd,
  onCatalogAutoAddChange,
  settings,
  layoutPresets,
  layoutPlace,
  onPickPlace,
  showWakeReader,
  onWidthChange,
  className = '',
}: Props) {
  const rootRef = useRef<HTMLElement>(null)
  const resizeRef = useRef<HTMLDivElement>(null)
  const { panelStyle, startWidthDrag } = useCatalogPanelWidth('left')

  useEffect(() => {
    if (!onWidthChange) return
    const el = rootRef.current
    if (!el) return
    const report = () => onWidthChange(Math.round(el.getBoundingClientRect().width))
    const ro = new ResizeObserver(report)
    ro.observe(el)
    report()
    return () => ro.disconnect()
  }, [onWidthChange, activeMenu, panelStyle])

  /** onResizeMouseDown 拖动管理区右缘调整宽度。 */
  const onResizeMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const shell = e.currentTarget.closest('.workspace') as HTMLElement | null
    resizeRef.current?.classList.add('dragging')
    startWidthDrag(e.clientX, shell?.clientWidth ?? window.innerWidth, () => {
      resizeRef.current?.classList.remove('dragging')
    })
  }

  return (
    <aside
      ref={rootRef}
      className={`manager-pane workspace-nav-pane ${className}`.trim()}
      style={panelStyle}
    >
      <NoteToolbar
        className="sidebar-toolbar note-toolbar manager-toolbar"
        version={version}
        activeMenu={activeMenu}
        onPickMenu={onPickMenu}
        onMouseDown={onMouseDown}
        onMinimizeToPill={onMinimizeToPill}
        viewMenu={{
          panels,
          onSetPanel,
          layoutPresets,
          hidePanels,
          hasScope,
          onRestoreWindow,
        }}
      />
      {activeMenu === 'note' && (
        <div className="manager-note-body">
          <NoteNavColumn {...navColumn} />
        </div>
      )}
      {activeMenu === 'settings' && (
        <SettingsPanel
          settings={settings}
          layoutPresets={layoutPresets}
          layoutPlace={layoutPlace}
          onPickPlace={onPickPlace}
          catalogAutoAdd={catalogAutoAdd}
          onCatalogAutoAddChange={onCatalogAutoAddChange}
          showWakeReader={showWakeReader}
          className="sidebar-body interpret-settings manager-settings"
        />
      )}
      <div
        ref={resizeRef}
        className="manager-pane-resize"
        title="拖动调整管理区宽度"
        onMouseDown={onResizeMouseDown}
      />
    </aside>
  )
}
