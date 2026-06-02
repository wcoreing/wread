import { useEffect, useState } from 'react'
import AiSettings from '../components/AiSettings'
import NoteToolbar, { type NoteMenu } from '../components/NoteToolbar'
import NotebookPane from '../components/NotebookPane'
import TemplateManager from '../components/TemplateManager'
import { useActiveNotebook } from '../hooks/useActiveNotebook'
import { useNotebookListOverlay } from '../hooks/useNotebookListOverlay'
import { useInterpretSettings } from '../hooks/useInterpretSettings'
import { useNoteLayout } from '../hooks/useNoteLayout'
import { useCatalogCollapsed } from '../hooks/useCatalogCollapsed'
import { readerStyleVars } from '../lib/readerStyle'
import './sidebar.css'

/** SidebarPage 内嵌或弹出的笔记窗。 */
export default function SidebarPage({ popout = false }: { popout?: boolean }) {
  const nb = useActiveNotebook()
  const layout = useNoteLayout()
  const interpretSettings = useInterpretSettings()
  const { listOpen, setListOpen } = useNotebookListOverlay()
  const [catalogCollapsed, setCatalogCollapsed] = useCatalogCollapsed()
  const [noteMenu, setNoteMenu] = useState<NoteMenu>('note')

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
    onCatalogAutoAddChange: (auto: boolean) => nb.setCatalogAutoAddMode(auto).catch(console.error),
    pendingInChapter: nb.pendingInChapter,
    onAddToChapter: () => nb.addActiveToChapter().catch(console.error),
    pageTitle: nb.pageTitle,
    concepts: nb.concepts,
    catalogCollapsed,
    onCatalogCollapsedChange: setCatalogCollapsed,
  }

  return (
    <div
      className={`sidebar-root ${popout ? 'popout' : layout.docked ? 'docked' : 'undocked'}`}
      style={readerStyleVars(nb.readerSettings)}
    >
      <NoteToolbar
        version={nb.appInfo?.version}
        layoutPlace={layout.layoutPlace}
        activeMenu={noteMenu}
        onPickMenu={setNoteMenu}
        onPickPlace={(place) => pickNotePlace(place).catch(console.error)}
        showWake={popout}
      />
      {noteMenu === 'templates' && (
        <TemplateManager settings={interpretSettings} className="sidebar-body interpret-settings" />
      )}
      {noteMenu === 'ai' && (
        <AiSettings settings={interpretSettings} className="sidebar-body interpret-settings" />
      )}
      {noteMenu === 'note' && (
        <NotebookPane
          showEdgeRail={noteMenu === 'note'}
          onToggleListOpen={() => setListOpen(!listOpen)}
          notebooks={nb.notebooks}
          activeNotebookId={nb.activeNotebookId}
          listOpen={listOpen}
          onOpenNotebook={(id) => nb.openNotebook(id).catch(console.error)}
          onCreateNotebook={() => nb.createNotebook().catch(console.error)}
          onDeleteNotebook={(id) => nb.deleteNotebook(id).catch(console.error)}
          onBatchDeleteNotebooks={(ids) => nb.deleteNotebooks(ids).catch(console.error)}
          {...notePaneProps}
        />
      )}
    </div>
  )
}
