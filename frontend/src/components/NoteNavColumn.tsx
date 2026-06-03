import { useEffect, useRef } from 'react'
import NoteCatalog from './NoteCatalog'
import NotebookSwitcher from './NotebookSwitcher'
import type { CatalogNodeDO, SessionDO } from '../../bindings/wread/internal/model'
import { useCatalogFontSize } from '../hooks/useCatalogFontSize'
import { useCatalogPanelWidth } from '../hooks/useCatalogPanelWidth'

type Props = {
  notebookName: string
  onNotebookNameChange: (name: string) => void
  catalogNodes: CatalogNodeDO[]
  rootSelected: boolean
  onSelectRoot: () => void
  selectedChapterId: string
  selectedPageId: string
  onSelectChapter: (node: CatalogNodeDO) => void
  onSelectPage: (node: CatalogNodeDO) => void
  onCreateChapter: (parentId: string) => void
  onRenameNode: (node: CatalogNodeDO, title: string) => void
  onDeleteNode: (node: CatalogNodeDO) => void
  onBatchDeleteNodes: (ids: string[]) => void
  onMoveNode: (nodeId: string, parentId: string, index: number) => void
  onOrganizeApplied?: () => void
  onOrganizeError?: (msg: string) => void
  catalogEntryScrollId?: string
  onCatalogEntryScrollDone?: () => void
  notebooks: SessionDO[]
  activeNotebookId: string
  onOpenNotebook: (id: string) => void
  onCreateNotebook: () => void
  onDeleteNotebook: (id: string) => void
  onBatchDeleteNotebooks: (ids: string[]) => void
  /** onWidthChange 导航列总宽变化时回调（供穿透带同步）。 */
  onWidthChange?: (width: number) => void
  className?: string
}

/** NoteNavColumn 单栏：笔记本切换 + 全宽目录。 */
export default function NoteNavColumn({
  notebookName,
  onNotebookNameChange,
  catalogNodes,
  rootSelected,
  onSelectRoot,
  selectedChapterId,
  selectedPageId,
  onSelectChapter,
  onSelectPage,
  onCreateChapter,
  onRenameNode,
  onDeleteNode,
  onBatchDeleteNodes,
  onMoveNode,
  onOrganizeApplied,
  onOrganizeError,
  catalogEntryScrollId = '',
  onCatalogEntryScrollDone,
  notebooks,
  activeNotebookId,
  onOpenNotebook,
  onCreateNotebook,
  onDeleteNotebook,
  onBatchDeleteNotebooks,
  onWidthChange,
  className = '',
}: Props) {
  const columnRef = useRef<HTMLElement>(null)
  const { panelStyle: catalogWidthStyle, panelW: catalogW, startWidthDrag } = useCatalogPanelWidth('left')
  const { fontSize, panelStyle: catalogFontStyle, changeFontSize } = useCatalogFontSize()
  const catalogPanelStyle = { ...catalogFontStyle }

  const containerW = () => columnRef.current?.parentElement?.clientWidth || window.innerWidth

  useEffect(() => {
    if (!onWidthChange) return
    onWidthChange(catalogW)
  }, [catalogW, onWidthChange])

  useEffect(() => {
    if (!onWidthChange) return
    const el = columnRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      onWidthChange(Math.round(el.getBoundingClientRect().width))
    })
    ro.observe(el)
    onWidthChange(Math.round(el.getBoundingClientRect().width))
    return () => ro.disconnect()
  }, [onWidthChange])

  return (
    <aside
      ref={columnRef}
      className={`workspace-nav-body note-nav-column note-nav-single ${className}`.trim()}
      style={catalogWidthStyle}
    >
      <NotebookSwitcher
        notebooks={notebooks}
        activeNotebookId={activeNotebookId}
        onOpen={onOpenNotebook}
        onCreate={onCreateNotebook}
        onDelete={onDeleteNotebook}
        onBatchDelete={onBatchDeleteNotebooks}
      />
      <div className="note-nav-catalog">
        <NoteCatalog
          notebookName={notebookName}
          onNotebookNameChange={onNotebookNameChange}
          nodes={catalogNodes}
          rootSelected={rootSelected}
          onSelectRoot={onSelectRoot}
          selectedChapterId={selectedChapterId}
          selectedPageId={selectedPageId}
          onSelectChapter={onSelectChapter}
          onSelectPage={onSelectPage}
          onCreateChapter={onCreateChapter}
          onRename={onRenameNode}
          onDelete={onDeleteNode}
          onBatchDelete={onBatchDeleteNodes}
          onMove={onMoveNode}
          catalogSide="left"
          onToggleCatalogSide={() => {}}
          hideSideToggle
          panelStyle={catalogPanelStyle}
          fontSize={fontSize}
          onFontSizeChange={changeFontSize}
          scrollToNodeId={catalogEntryScrollId}
          onScrollToNodeDone={onCatalogEntryScrollDone}
          onOrganizeApplied={onOrganizeApplied}
          onOrganizeError={onOrganizeError}
        />
      </div>
      <div
        className="note-nav-resize"
        title="拖动调整导航区宽度"
        onMouseDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
          startWidthDrag(e.clientX, containerW())
        }}
      />
    </aside>
  )
}
