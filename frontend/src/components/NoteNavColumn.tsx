import { useRef } from 'react'
import NoteCatalog from './NoteCatalog'
import NotebookSwitcher from './NotebookSwitcher'
import type { CatalogNodeDO, SessionDO } from '../../bindings/wread/internal/model'
import { useCatalogFontSize } from '../hooks/useCatalogFontSize'

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
  className = '',
}: Props) {
  const columnRef = useRef<HTMLElement>(null)
  const { fontSize, panelStyle: catalogFontStyle, changeFontSize } = useCatalogFontSize()

  return (
    <aside
      ref={columnRef}
      className={`workspace-nav-body note-nav-column note-nav-single ${className}`.trim()}
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
          panelStyle={catalogFontStyle}
          fontSize={fontSize}
          onFontSizeChange={changeFontSize}
          scrollToNodeId={catalogEntryScrollId}
          onScrollToNodeDone={onCatalogEntryScrollDone}
          onOrganizeApplied={onOrganizeApplied}
          onOrganizeError={onOrganizeError}
        />
      </div>
    </aside>
  )
}
