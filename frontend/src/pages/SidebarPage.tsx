import { useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react'
import NoteToolbar, { type NoteMenu } from '../components/NoteToolbar'
import NoteScopeBar from '../components/NoteScopeBar'
import NotebookPane from '../components/NotebookPane'
import SettingsPanel from '../components/SettingsPanel'
import { useActiveNotebook } from '../hooks/useActiveNotebook'
import { useNotebookListOverlay } from '../hooks/useNotebookListOverlay'
import { useInterpretSettings } from '../hooks/useInterpretSettings'
import { useNoteLayout } from '../hooks/useNoteLayout'
import { useCatalogCollapsed } from '../hooks/useCatalogCollapsed'
import { useWorkspaceFrameDrag } from '../hooks/useWorkspaceFrameDrag'
import { useWindowLayoutPresets } from '../hooks/useWindowLayoutPresets'
import { useScopeMode } from '../hooks/useScopeMode'
import { readCatalogSide, saveCatalogSide, type CatalogSide } from '../lib/catalogLayout'
import { readerStyleVars } from '../lib/readerStyle'
import './overlay.css'
import './workspace.css'
import './sidebar.css'

/** SidebarPage 独立弹出笔记窗（结构与内嵌 place-right 笔记区一致）。 */
export default function SidebarPage() {
  const nb = useActiveNotebook()
  const layout = useNoteLayout()
  const interpretSettings = useInterpretSettings()
  const { listOpen, setListOpen } = useNotebookListOverlay()
  const [catalogCollapsed, setCatalogCollapsed] = useCatalogCollapsed()
  const [catalogSide, setCatalogSide] = useState<CatalogSide>(readCatalogSide)
  const [noteMenu, setNoteMenu] = useState<NoteMenu>('note')
  const frameDrag = useWorkspaceFrameDrag(true)
  const layoutPresets = useWindowLayoutPresets()
  const { notesInScope } = useScopeMode()

  useEffect(() => {
    if (noteMenu !== 'note') setListOpen(false)
  }, [noteMenu, setListOpen])

  const pickNotePlace = async (place: Parameters<typeof layout.pickNotePlace>[0]) => {
    try {
      await layout.pickNotePlace(place)
    } catch (e: unknown) {
      nb.setStatus(String(e))
    }
  }

  /** setCatalogPanelSide 切换目录在笔记区内的左右位置。 */
  const setCatalogPanelSide = (side: CatalogSide) => {
    setCatalogSide(side)
    saveCatalogSide(side)
  }

  /** onNoteToolbarMouseDown 顶栏空白区拖动移动独立笔记窗。 */
  const onNoteToolbarMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement
    if (t.closest('button, .note-layout-select, .note-theme-select, .note-toolbar-spacer')) {
      return
    }
    frameDrag.startMove(e)
  }

  useEffect(() => {
    if (nb.catalogEntryScrollId) {
      setCatalogCollapsed(false)
    }
  }, [nb.catalogEntryScrollId, setCatalogCollapsed])

  const notePaneProps = {
    notebookName: nb.notebookName,
    onNotebookNameChange: nb.updateNotebookName,
    catalogNodes: nb.catalogNodes,
    selectedChapterId: nb.selectedChapterId,
    selectedPageId: nb.selectedPageId,
    onSelectChapter: (node: Parameters<typeof nb.selectChapter>[0]) => nb.selectChapter(node).catch(console.error),
    onSelectPage: (node: Parameters<typeof nb.selectPage>[0]) => nb.selectPage(node).catch(console.error),
    onCreateChapter: (parentId: string) => nb.createChapter(parentId).catch(console.error),
    onRenameNode: (node: Parameters<typeof nb.renameCatalogNode>[0], title: string) =>
      nb.renameCatalogNode(node, title).catch(console.error),
    onDeleteNode: (node: Parameters<typeof nb.deleteCatalogNode>[0]) => nb.deleteCatalogNode(node).catch(console.error),
    onBatchDeleteNodes: (ids: string[]) => nb.deleteCatalogNodes(ids).catch(console.error),
    onMoveNode: (nodeId: string, parentId: string, index: number) =>
      nb.moveCatalogNode(nodeId, parentId, index).catch(console.error),
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
    templates: interpretSettings.promptSettings.templates,
    activeTemplateId: interpretSettings.promptSettings.activeId,
    onPickTemplate: (id: string) => interpretSettings.pickTemplate(id).catch(console.error),
    catalogAutoAdd: nb.catalogAutoAdd,
    pendingCatalogEntry: nb.pendingCatalogEntry,
    catalogEntryReady: nb.catalogEntryReady,
    onAddToChapter: () => nb.addActiveToChapter().catch(console.error),
    selectedChapterTitle: nb.selectedChapterTitle,
    catalogEntryScrollId: nb.catalogEntryScrollId,
    onCatalogEntryScrollDone: nb.clearCatalogEntryScroll,
    pageTitle: nb.pageTitle,
    concepts: nb.concepts,
    catalogCollapsed,
    onCatalogCollapsedChange: setCatalogCollapsed,
    notesInScope,
    hideReaderBar: false,
    catalogSide,
    onCatalogSideChange: setCatalogPanelSide,
    ocrOriginal: nb.ocrOriginal,
    capturePreview: nb.capturePreview,
  }

  return (
    <div className="workspace docked place-right note-only" style={readerStyleVars(nb.readerSettings)}>
      <div className="overlay-edge overlay-edge-top" onMouseDown={(e) => frameDrag.start('n', e)} />
      <div className="overlay-edge overlay-edge-bottom" onMouseDown={(e) => frameDrag.start('s', e)} />
      <div className="overlay-edge overlay-edge-left" onMouseDown={(e) => frameDrag.start('w', e)} />
      <div className="overlay-edge overlay-edge-right" onMouseDown={(e) => frameDrag.start('e', e)} />
      <div className="overlay-corner overlay-corner-nw" onMouseDown={(e) => frameDrag.start('nw', e)} />
      <div className="overlay-corner overlay-corner-ne" onMouseDown={(e) => frameDrag.start('ne', e)} />
      <div className="overlay-corner overlay-corner-sw" onMouseDown={(e) => frameDrag.start('sw', e)} />
      <div className="overlay-corner overlay-corner-se" onMouseDown={(e) => frameDrag.start('se', e)} />
      <aside className="note-pane">
        <NoteToolbar
          className="sidebar-toolbar note-toolbar"
          version={nb.appInfo?.version}
          activeMenu={noteMenu}
          onPickMenu={setNoteMenu}
          onMouseDown={onNoteToolbarMouseDown}
        />
        {noteMenu === 'settings' && (
          <SettingsPanel
            settings={interpretSettings}
            layoutPresets={layoutPresets}
            layoutPlace={layout.layoutPlace}
            onPickPlace={(place) => pickNotePlace(place).catch(console.error)}
            showWakeReader
            className="sidebar-body interpret-settings"
          />
        )}
        {noteMenu === 'note' && (
          <>
            <NoteScopeBar
              listOpen={listOpen}
              onToggleList={() => setListOpen(!listOpen)}
              catalogCollapsed={catalogCollapsed}
              onToggleCatalog={() => setCatalogCollapsed(!catalogCollapsed)}
              catalogAutoAdd={nb.catalogAutoAdd}
              onCatalogAutoAddChange={(auto) => nb.setCatalogAutoAddMode(auto).catch(console.error)}
              pendingCatalogEntry={nb.pendingCatalogEntry}
              catalogEntryReady={nb.catalogEntryReady}
              onAddToChapter={() => nb.addActiveToChapter().catch(console.error)}
            />
            <NotebookPane
              notebooks={nb.notebooks}
              activeNotebookId={nb.activeNotebookId}
              listOpen={listOpen}
              onOpenNotebook={(id) => nb.openNotebook(id).catch(console.error)}
              onCreateNotebook={() => nb.createNotebook().catch(console.error)}
              onDeleteNotebook={(id) => nb.deleteNotebook(id).catch(console.error)}
              onBatchDeleteNotebooks={(ids) => nb.deleteNotebooks(ids).catch(console.error)}
              {...notePaneProps}
            />
          </>
        )}
      </aside>
    </div>
  )
}
