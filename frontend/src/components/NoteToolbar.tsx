import { type MouseEvent as ReactMouseEvent } from 'react'
import ViewMenu from './ViewMenu'
import type { PanelId, PanelVisibility } from '../lib/panelVisibility'
import type { WindowLayoutPresetsApi } from '../hooks/useWindowLayoutPresets'
import '../pages/overlay.css'

export type NoteMenu = 'note' | 'settings'

type ViewMenuProps = {
  panels: PanelVisibility
  onSetPanel: (id: PanelId, on: boolean) => void
  layoutPresets?: WindowLayoutPresetsApi
  hidePanels?: PanelId[]
  hasScope?: boolean
  onRestoreWindow?: () => void
}

type Props = {
  version?: string
  activeMenu: NoteMenu
  onPickMenu: (menu: NoteMenu) => void
  viewMenu?: ViewMenuProps
  className?: string
  onMouseDown?: (e: ReactMouseEvent<HTMLDivElement>) => void
  onMinimizeToPill?: () => void
}

/** NoteToolbar 顶栏：品牌 / 视图 / 笔记·配置 / 收起。 */
export default function NoteToolbar({
  version,
  activeMenu,
  onPickMenu,
  viewMenu,
  className = 'sidebar-toolbar note-toolbar',
  onMouseDown,
  onMinimizeToPill,
}: Props) {
  return (
    <div className={className} onMouseDown={onMouseDown}>
      <span className="sidebar-brand note-app-brand">
        wread
        {version && <span className="sidebar-version">v{version}</span>}
      </span>
      {viewMenu && (
        <ViewMenu
          panels={viewMenu.panels}
          onSetPanel={viewMenu.onSetPanel}
          layoutPresets={viewMenu.layoutPresets}
          hidePanels={viewMenu.hidePanels}
          hasScope={viewMenu.hasScope}
          onRestoreWindow={viewMenu.onRestoreWindow}
        />
      )}
      <span className="note-toolbar-spacer" />
      <div className="note-toolbar-nav overlay-mode-radio" role="tablist" aria-label="笔记视图">
        <button
          type="button"
          role="tab"
          aria-selected={activeMenu === 'note'}
          className={activeMenu === 'note' ? 'active' : ''}
          onClick={() => onPickMenu('note')}
          title="笔记"
        >
          笔记
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeMenu === 'settings'}
          className={activeMenu === 'settings' ? 'active' : ''}
          onClick={() => onPickMenu('settings')}
          title="AI、外观、模板与布局"
        >
          配置
        </button>
      </div>
      {onMinimizeToPill && (
        <button
          type="button"
          className="note-pill-btn"
          title="收起为悬浮图标（⌘⇧M）"
          aria-label="收起为悬浮图标"
          onClick={onMinimizeToPill}
        >
          收起
        </button>
      )}
    </div>
  )
}
