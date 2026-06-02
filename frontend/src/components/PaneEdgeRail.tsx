import type { ButtonHTMLAttributes, MouseEvent } from 'react'
import { Window as WailsWindow } from '@wailsio/runtime'
import { catalogRailLabel, notebookRailLabel } from '../lib/catalogLayout'
import './edgeRail.css'

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean
  interpret?: boolean
}

/** EdgeRailBtn 内缘竖条按钮（竖排文案）。 */
export function EdgeRailBtn({ active, interpret, className = '', ...rest }: BtnProps) {
  const extra = [
    'edge-rail-btn',
    active ? 'active' : '',
    interpret ? 'interpret' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return <button type="button" className={extra} {...rest} />
}

/** onEdgeRailFocus 内缘按钮按下时聚焦窗口（不 preventDefault，避免 Web 收不到 click）。 */
export function onEdgeRailFocus(e: MouseEvent<HTMLButtonElement>) {
  e.stopPropagation()
  void WailsWindow.Focus().catch(console.error)
}

/** onEdgeRailClick 内缘按钮点击。 */
export function onEdgeRailClick(action: () => void) {
  return (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    action()
  }
}

type NoteEdgeRailProps = {
  listOpen: boolean
  onToggleList: () => void
  catalogCollapsed: boolean
  onToggleCatalog: () => void
}

/** NoteEdgeRail 笔记左内缘：笔记本、目录。 */
export function NoteEdgeRail({ listOpen, onToggleList, catalogCollapsed, onToggleCatalog }: NoteEdgeRailProps) {
  return (
    <aside className="pane-edge-rail pane-edge-rail-note" aria-label="笔记本与目录">
      <EdgeRailBtn
        active={listOpen}
        title={listOpen ? '收起笔记本列表' : '切换笔记本'}
        onMouseDown={onEdgeRailFocus}
        onClick={onEdgeRailClick(onToggleList)}
      >
        {notebookRailLabel()}
      </EdgeRailBtn>
      <EdgeRailBtn
        active={!catalogCollapsed}
        title={catalogCollapsed ? '展开目录' : '收起目录'}
        aria-expanded={!catalogCollapsed}
        onMouseDown={onEdgeRailFocus}
        onClick={onEdgeRailClick(onToggleCatalog)}
      >
        {catalogRailLabel()}
      </EdgeRailBtn>
    </aside>
  )
}

type ReaderEdgeRailProps = {
  interpreting: boolean
  onInterpret: () => void
}

/** ReaderEdgeRail 阅读器靠翻页侧内缘：解读。 */
export function ReaderEdgeRail({ interpreting, onInterpret }: ReaderEdgeRailProps) {
  return (
    <aside className="pane-edge-rail pane-edge-rail-reader" aria-label="解读">
      <EdgeRailBtn
        interpret
        disabled={interpreting}
        className={interpreting ? 'busy' : ''}
        title={interpreting ? '解读中…' : '解读当前页'}
        onMouseDown={onEdgeRailFocus}
        onClick={onEdgeRailClick(onInterpret)}
      >
        {interpreting ? '解读中' : '解读'}
      </EdgeRailBtn>
    </aside>
  )
}
