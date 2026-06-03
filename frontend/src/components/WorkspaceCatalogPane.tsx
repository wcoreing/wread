import { useEffect, useRef, type CSSProperties } from 'react'
import { Service } from '../../bindings/wread/internal/app'
import type { CatalogNodeDO } from '../../bindings/wread/internal/model'
import { useCatalogFontSize } from '../hooks/useCatalogFontSize'
import { useCatalogPanelWidth } from '../hooks/useCatalogPanelWidth'
import NoteCatalog from './NoteCatalog'

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
  scrollToNodeId?: string
  onScrollToNodeDone?: () => void
}

/** WorkspaceCatalogPane 工作区目录侧栏（独立列，由笔记区二级栏展开/收起）。 */
export default function WorkspaceCatalogPane({
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
  scrollToNodeId = '',
  onScrollToNodeDone,
}: Props) {
  const shellRef = useRef<HTMLElement>(null)
  const { panelW, panelStyle: widthStyle, startWidthDrag } = useCatalogPanelWidth('left')
  const { fontSize, panelStyle: fontStyle, changeFontSize } = useCatalogFontSize()

  useEffect(() => {
    void Service.SetCatalogWidth(panelW).catch(console.error)
  }, [panelW])

  const workspaceW = () => {
    const root = shellRef.current?.closest('.workspace') as HTMLElement | null
    return root?.clientWidth || window.innerWidth
  }

  const shellStyle = {
    '--catalog-panel-w': `${panelW}px`,
    ...widthStyle,
    ...fontStyle,
  } as CSSProperties

  return (
    <aside ref={shellRef} className="catalog-pane-shell" style={shellStyle}>
      <div className="catalog-pane-body">
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
          onOrganizeApplied={onOrganizeApplied}
          onOrganizeError={onOrganizeError}
          catalogSide="left"
          onToggleCatalogSide={() => {}}
          hideSideToggle
          panelStyle={shellStyle}
          fontSize={fontSize}
          onFontSizeChange={changeFontSize}
          scrollToNodeId={scrollToNodeId}
          onScrollToNodeDone={onScrollToNodeDone}
        />
      </div>
      <div
        className="catalog-pane-resize"
        title="拖动调整目录宽度"
        onMouseDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
          startWidthDrag(e.clientX, workspaceW())
        }}
      />
    </aside>
  )
}
