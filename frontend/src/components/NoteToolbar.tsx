import { Service } from '../../bindings/wread/internal/app'
import NotePlaceBar, { type NotePlaceId } from './NotePlaceBar'

export type NoteMenu = 'note' | 'templates' | 'ai'

type Props = {
  version?: string
  layoutPlace: NotePlaceId
  activeMenu: NoteMenu
  onPickMenu: (menu: NoteMenu) => void
  onPickPlace: (place: NotePlaceId) => void
  showWake?: boolean
  className?: string
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
}: Props) {
  return (
    <div className={className}>
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
