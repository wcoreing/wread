import { useCallback, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { Service } from '../../bindings/wread/internal/app'
import ManagerPane from '../components/ManagerPane'
import NotebookPane from '../components/NotebookPane'
import PanelRestoreRail from '../components/PanelRestoreRail'
import { useActiveNotebook } from '../hooks/useActiveNotebook'
import { useInterpretSettings } from '../hooks/useInterpretSettings'
import { useNoteLayout } from '../hooks/useNoteLayout'
import { useSyncNavCatalogWidth } from '../hooks/useSyncNavCatalogWidth'
import { useWorkspaceFrameDrag } from '../hooks/useWorkspaceFrameDrag'
import { useWindowLayoutPresets } from '../hooks/useWindowLayoutPresets'
import { usePillRestore } from '../hooks/usePillRestore'
import { usePanelVisibility } from '../hooks/usePanelVisibility'
import type { NoteMenu } from '../components/NoteToolbar'
import { readerStyleVars } from '../lib/readerStyle'
import './overlay.css'
import './workspace.css'
import './sidebar.css'

/** SidebarPage 独立笔记窗：左栏管理 + 右栏 wread / 原文。 */
export default function SidebarPage() {
  const nb = useActiveNotebook()
  const layout = useNoteLayout()
  const interpretSettings = useInterpretSettings()
  const { panels, setPanel, showManager, showWread, showNotePane } = usePanelVisibility({ hasScope: false })
  const [noteMenu, setNoteMenu] = useState<NoteMenu>('note')
  const frameDrag = useWorkspaceFrameDrag(true)
  const layoutPresets = useWindowLayoutPresets()
  const { reportManagerWidth } = useSyncNavCatalogWidth(showManager)

  const minimizeToPill = useCallback(() => {
    void Service.MinimizeToPill(noteMenu).catch(console.error)
  }, [noteMenu])

  usePillRestore(setNoteMenu)

  const pickNotePlace = async (place: Parameters<typeof layout.pickNotePlace>[0]) => {
    try {
      await layout.pickNotePlace(place)
    } catch (e: unknown) {
      nb.setStatus(String(e))
    }
  }

  const onManagerMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement
    if (t.closest('button, .note-toolbar-nav, .note-toolbar-spacer, .note-pill-btn, .view-menu, .menu-dropdown, .choice-select')) {
      return
    }
    frameDrag.startMove(e)
  }

  const notePaneProps = {
    readerSettings: nb.readerSettings,
    onReaderSettingsChange: nb.updateReaderSettings,
    status: nb.status,
    interpreting: nb.interpreting,
    interpretBody: nb.interpretBody,
    emptyHint: nb.emptyHint,
    isStreaming: Boolean(nb.streaming),
    current: nb.current,
    question: nb.question,
    onQuestionChange: nb.setQuestion,
    onFollowUp: () => nb.followUp().catch(console.error),
    catalogAutoAdd: nb.catalogAutoAdd,
    pendingCatalogEntry: nb.pendingCatalogEntry,
    catalogEntryReady: nb.catalogEntryReady,
    onAddToChapter: () => nb.addActiveToChapter().catch(console.error),
    selectedChapterTitle: nb.selectedChapterTitle,
    pageTitle: nb.pageTitle,
    concepts: nb.concepts,
    notebookName: nb.notebookName,
    sourceCollapsed: !panels.source,
    wreadVisible: showWread,
    ocrOriginal: nb.ocrOriginal,
    capturePreview: nb.capturePreview,
  }

  const shellClass = [
    'workspace docked place-right note-only shell-layout',
    showManager ? 'has-manager' : 'manager-hidden',
    !showWread ? 'wread-hidden' : '',
    panels.source ? 'source-open' : 'source-hidden',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={shellClass} style={readerStyleVars(nb.readerSettings)}>
      <div className="overlay-edge overlay-edge-top" onMouseDown={(e) => frameDrag.start('n', e)} />
      <div className="overlay-edge overlay-edge-bottom" onMouseDown={(e) => frameDrag.start('s', e)} />
      <div className="overlay-edge overlay-edge-left" onMouseDown={(e) => frameDrag.start('w', e)} />
      <div className="overlay-edge overlay-edge-right" onMouseDown={(e) => frameDrag.start('e', e)} />
      <div className="overlay-corner overlay-corner-nw" onMouseDown={(e) => frameDrag.start('nw', e)} />
      <div className="overlay-corner overlay-corner-ne" onMouseDown={(e) => frameDrag.start('ne', e)} />
      <div className="overlay-corner overlay-corner-sw" onMouseDown={(e) => frameDrag.start('sw', e)} />
      <div className="overlay-corner overlay-corner-se" onMouseDown={(e) => frameDrag.start('se', e)} />
      <div className={`note-only-shell${noteMenu !== 'note' ? ' manager-only' : ''}${!showNotePane ? ' note-hidden' : ''}`}>
        {showManager && (
          <ManagerPane
            version={nb.appInfo?.version}
            activeMenu={noteMenu}
            onPickMenu={setNoteMenu}
            onMinimizeToPill={minimizeToPill}
            onMouseDown={onManagerMouseDown}
            panels={panels}
            onSetPanel={setPanel}
            hidePanels={['scope']}
            hasScope={false}
            onWidthChange={reportManagerWidth}
            layoutPlace={layout.layoutPlace}
            onPickPlace={(place) => pickNotePlace(place).catch(console.error)}
            showWakeReader
            settings={interpretSettings}
            layoutPresets={layoutPresets}
            catalogAutoAdd={nb.catalogAutoAdd}
            onCatalogAutoAddChange={(auto) => nb.setCatalogAutoAddMode(auto).catch(console.error)}
            navColumn={{
              notebookName: nb.notebookName,
              onNotebookNameChange: nb.updateNotebookName,
              catalogNodes: nb.catalogNodes,
              rootSelected: nb.rootSelected,
              onSelectRoot: () => nb.selectRoot().catch(console.error),
              selectedChapterId: nb.selectedChapterId,
              selectedPageId: nb.selectedPageId,
              onSelectChapter: (node) => nb.selectChapter(node).catch(console.error),
              onSelectPage: (node) => nb.selectPage(node).catch(console.error),
              onCreateChapter: (parentId) => nb.createChapter(parentId).catch(console.error),
              onRenameNode: (node, title) => nb.renameCatalogNode(node, title).catch(console.error),
              onDeleteNode: (node) => nb.deleteCatalogNode(node).catch(console.error),
              onBatchDeleteNodes: (ids) => nb.deleteCatalogNodes(ids).catch(console.error),
              onMoveNode: (nodeId, parentId, index) => nb.moveCatalogNode(nodeId, parentId, index).catch(console.error),
              onOrganizeApplied: nb.catalogOrganizeApplied,
              onOrganizeError: nb.catalogOrganizeError,
              catalogEntryScrollId: nb.catalogEntryScrollId,
              onCatalogEntryScrollDone: nb.clearCatalogEntryScroll,
              notebooks: nb.notebooks,
              activeNotebookId: nb.activeNotebookId,
              onOpenNotebook: (id) => nb.openNotebook(id).catch(console.error),
              onCreateNotebook: () => nb.createNotebook().catch(console.error),
              onDeleteNotebook: (id) => nb.deleteNotebook(id).catch(console.error),
              onBatchDeleteNotebooks: (ids) => nb.deleteNotebooks(ids).catch(console.error),
            }}
          />
        )}
        {!showManager && (
          <PanelRestoreRail
            panels={panels}
            onSetPanel={setPanel}
            layoutPresets={layoutPresets}
            hidePanels={['scope']}
            hasScope={false}
          />
        )}
        {noteMenu === 'note' && showNotePane && (
          <aside className="note-pane note-only-content focus-canvas-note">
            <NotebookPane {...notePaneProps} />
          </aside>
        )}
      </div>
    </div>
  )
}
