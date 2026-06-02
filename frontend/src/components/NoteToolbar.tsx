import { type MouseEvent as ReactMouseEvent } from 'react'
import { Service } from '../../bindings/wread/internal/app'
import NotePlaceBar, { type NotePlaceId } from './NotePlaceBar'
import '../pages/overlay.css'

export type NoteMenu = 'note' | 'templates' | 'layout' | 'ai'

type Props = {
  version?: string
  layoutPlace: NotePlaceId
  activeMenu: NoteMenu
  onPickMenu: (menu: NoteMenu) => void
  onPickPlace: (place: NotePlaceId) => void
  showWake?: boolean
  className?: string
  onMouseDown?: (e: ReactMouseEvent<HTMLDivElement>) => void
}

/** NoteToolbar 笔记顶栏：笔记、模板、配置。 */
export default function NoteToolbar({
  version,
  layoutPlace,
  activeMenu,
  onPickMenu,
  onPickPlace,
  showWake,
  className = 'sidebar-toolbar note-toolbar',
  onMouseDown,
}: Props) {
  return (
    <div className={className} onMouseDown={onMouseDown}>
      <button
        type="button"
        className={`sidebar-brand note-brand-btn${activeMenu === 'note' ? ' active' : ''}`}
        onClick={() => onPickMenu('note')}
        title="笔记"
      >
        笔记
        {version && <span className="sidebar-version">v{version}</span>}
      </button>
      <span className="note-toolbar-spacer" />
      <button
        type="button"
        className={`sidebar-menu-btn ${activeMenu === 'templates' ? 'active' : ''}`}
        onClick={() => onPickMenu('templates')}
      >
        模板
      </button>
      <button
        type="button"
        className={`sidebar-menu-btn ${activeMenu === 'layout' ? 'active' : ''}`}
        onClick={() => onPickMenu('layout')}
        title="窗口布局预设"
      >
        布局
      </button>
      <button
        type="button"
        className={`sidebar-menu-btn ${activeMenu === 'ai' ? 'active' : ''}`}
        onClick={() => onPickMenu('ai')}
        title="AI 配置"
      >
        配置
      </button>
      <NotePlaceBar active={layoutPlace} onPick={onPickPlace} />
      {showWake && (
        <button type="button" className="sidebar-wake-btn" onClick={() => Service.FocusOverlay().catch(console.error)}>
          阅读器
        </button>
      )}
    </div>
  )
}
