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

/** NoteToolbar 顶栏：左品牌+版本（可拖/缩放），右文字链 视图·笔记·配置·休息。 */
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
      <div className="note-toolbar-brand-block">
        <span className="sidebar-brand note-app-brand">wread</span>
        {version && <span className="sidebar-version">v{version}</span>}
      </div>

      <span className="note-toolbar-spacer" aria-hidden />

      <div className="note-toolbar-actions">
        {viewMenu && (
          <ViewMenu
            className="note-toolbar-view"
            panels={viewMenu.panels}
            onSetPanel={viewMenu.onSetPanel}
            layoutPresets={viewMenu.layoutPresets}
            hidePanels={viewMenu.hidePanels}
            hasScope={viewMenu.hasScope}
            onRestoreWindow={viewMenu.onRestoreWindow}
          />
        )}

        <div className="note-toolbar-nav" role="tablist" aria-label="笔记视图">
          <button
            type="button"
            role="tab"
            aria-selected={activeMenu === 'note'}
            className={`note-toolbar-link${activeMenu === 'note' ? ' active' : ''}`}
            onClick={() => onPickMenu('note')}
            title="笔记本与目录"
          >
            笔记
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeMenu === 'settings'}
            className={`note-toolbar-link${activeMenu === 'settings' ? ' active' : ''}`}
            onClick={() => onPickMenu('settings')}
            title="AI、外观、模板与布局"
          >
            配置
          </button>
        </div>

        {onMinimizeToPill && (
          <button
            type="button"
            className="note-toolbar-link note-toolbar-rest"
            title="休息：收起为悬浮图标（⌘⇧M）"
            aria-label="休息，收起为悬浮图标"
            onClick={onMinimizeToPill}
          >
            休息
          </button>
        )}
      </div>
    </div>
  )
}
