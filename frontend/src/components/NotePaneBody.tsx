import { useRef } from 'react'
import NoteCatalog from './NoteCatalog'
import NotebookList from './NotebookList'
import InterpretBody from './InterpretBody'
import NotePageBar from './NotePageBar'
import NoteSourcePanel from './NoteSourcePanel'
import type { CatalogNodeDO, ReaderSettingsDO, SessionDO } from '../../bindings/wread/internal/model'
import {
  type CatalogSide,
} from '../lib/catalogLayout'
import { useCatalogFontSize } from '../hooks/useCatalogFontSize'
import { useCatalogPanelWidth } from '../hooks/useCatalogPanelWidth'
import { useNotebookListWidth } from '../hooks/useNotebookListWidth'

type Props = {
  notebookName: string
  onNotebookNameChange: (name: string) => void
  catalogNodes: CatalogNodeDO[]
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
  readerSettings: ReaderSettingsDO
  onReaderSettingsChange: (next: ReaderSettingsDO) => void
  status: string
  interpreting: boolean
  interpretBody: string
  emptyHint: string
  isStreaming: boolean
  current: string
  question: string
  onQuestionChange: (q: string) => void
  onFollowUp: () => void
  catalogAutoAdd?: boolean
  pendingCatalogEntry?: boolean
  catalogEntryReady?: boolean
  onAddToChapter?: () => void
  selectedChapterTitle?: string
  catalogEntryScrollId?: string
  onCatalogEntryScrollDone?: () => void
  pageTitle: string
  concepts: string[]
  catalogCollapsed: boolean
  onCatalogCollapsedChange: (collapsed: boolean) => void
  notebooks: SessionDO[]
  activeNotebookId: string
  listOpen: boolean
  onOpenNotebook: (id: string) => void
  onCreateNotebook: () => void
  onDeleteNotebook: (id: string) => void
  onBatchDeleteNotebooks: (ids: string[]) => void
  catalogExternal?: boolean
  notesInScope?: boolean
  hideReaderBar?: boolean
  catalogSide: CatalogSide
  onCatalogSideChange: (side: CatalogSide) => void
  ocrOriginal?: string
  capturePreview?: string
  className?: string
}

/** NotePaneBody 笔记本视图：目录 + 解读正文。 */
export default function NotePaneBody({
  notebookName,
  onNotebookNameChange,
  catalogNodes,
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
  readerSettings,
  onReaderSettingsChange,
  status,
  interpreting,
  interpretBody,
  emptyHint,
  isStreaming,
  current,
  question,
  onQuestionChange,
  onFollowUp,
  catalogAutoAdd = true,
  pendingCatalogEntry = false,
  catalogEntryReady = false,
  onAddToChapter,
  selectedChapterTitle = '',
  catalogEntryScrollId = '',
  onCatalogEntryScrollDone,
  pageTitle,
  concepts,
  catalogCollapsed,
  onCatalogCollapsedChange,
  notebooks,
  activeNotebookId,
  listOpen,
  onOpenNotebook,
  onCreateNotebook,
  onDeleteNotebook,
  onBatchDeleteNotebooks,
  catalogExternal = false,
  notesInScope = false,
  hideReaderBar = false,
  catalogSide,
  onCatalogSideChange,
  ocrOriginal = '',
  capturePreview = '',
  className = 'sidebar-body',
}: Props) {
  const splitRef = useRef<HTMLDivElement>(null)
  const { panelStyle: catalogWidthStyle, startWidthDrag } = useCatalogPanelWidth(catalogSide)
  const { fontSize, panelStyle: catalogFontStyle, changeFontSize } = useCatalogFontSize()
  const catalogPanelStyle = { ...catalogWidthStyle, ...catalogFontStyle }
  const { panelStyle: notebookPanelStyle, startWidthDrag: startNotebookWidthDrag } = useNotebookListWidth()

  return (
    <div className={`${className} notebook-pane-shell`}>
      <div
        ref={splitRef}
        className={`note-split${listOpen ? '' : ' notebook-collapsed'}${catalogExternal || catalogCollapsed ? ' catalog-collapsed' : ''}${!catalogExternal && catalogSide === 'right' ? ' catalog-right' : ''}`}
      >
        {listOpen && (
          <div className="notebook-panel-wrap">
            <div className="notebook-panel" style={notebookPanelStyle}>
              <NotebookList
                notebooks={notebooks}
                activeNotebookId={activeNotebookId}
                onOpen={onOpenNotebook}
                onCreate={onCreateNotebook}
                onDelete={onDeleteNotebook}
                onBatchDelete={onBatchDeleteNotebooks}
              />
            </div>
            <div
              className="notebook-panel-resize"
              title="拖动调整笔记本列表宽度"
              onMouseDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
                startNotebookWidthDrag(e.clientX, splitRef.current?.clientWidth || window.innerWidth)
              }}
            />
          </div>
        )}

        {!catalogExternal && !catalogCollapsed && (
          <NoteCatalog
            notebookName={notebookName}
            onNotebookNameChange={onNotebookNameChange}
            nodes={catalogNodes}
            selectedChapterId={selectedChapterId}
            selectedPageId={selectedPageId}
            onSelectChapter={onSelectChapter}
            onSelectPage={onSelectPage}
            onCreateChapter={onCreateChapter}
            onRename={onRenameNode}
            onDelete={onDeleteNode}
            onBatchDelete={onBatchDeleteNodes}
            onMove={onMoveNode}
            catalogSide={catalogSide}
            onToggleCatalogSide={() => onCatalogSideChange(catalogSide === 'left' ? 'right' : 'left')}
            panelStyle={catalogPanelStyle}
            fontSize={fontSize}
            onFontSizeChange={changeFontSize}
            onResizeStart={(x) => startWidthDrag(x, splitRef.current?.clientWidth || window.innerWidth)}
            scrollToNodeId={catalogEntryScrollId}
            onScrollToNodeDone={onCatalogEntryScrollDone}
            onOrganizeApplied={onOrganizeApplied}
            onOrganizeError={onOrganizeError}
          />
        )}

        <div className="note-page">
          {!hideReaderBar && (
            <NotePageBar
              settings={readerSettings}
              onChange={onReaderSettingsChange}
            />
          )}
          {!catalogAutoAdd && pendingCatalogEntry && onAddToChapter && (
            <div className="note-entry-banner">
              <span className="note-entry-banner-text">
                {catalogEntryReady
                  ? `待录入${selectedChapterTitle ? ` · ${selectedChapterTitle}` : ''}`
                  : '解读已完成，请先在目录选择章节'}
              </span>
              <button
                type="button"
                className={`note-action-btn${catalogEntryReady ? ' primary' : ''}`}
                onClick={onAddToChapter}
              >
                录入
              </button>
            </div>
          )}
          {status && <div className={`status-line ${interpreting ? 'busy' : 'error'}`}>{status}</div>}
          <div className={`panel current-panel${notesInScope ? ' source-mode' : ''}`}>
            {notesInScope ? (
              <NoteSourcePanel
                ocrOriginal={ocrOriginal}
                capturePreview={capturePreview}
                pageTitle={pageTitle}
              />
            ) : (
              <InterpretBody
                content={interpretBody}
                emptyHint={emptyHint}
                streaming={interpreting && isStreaming}
                pageTitle={pageTitle}
                notebookName={notebookName}
                concepts={concepts}
              />
            )}
            <div className="followup">
              <input
                value={question}
                onChange={(e) => onQuestionChange(e.target.value)}
                placeholder="针对当前段落追问…"
                disabled={!current && !isStreaming}
                onKeyDown={(e) => e.key === 'Enter' && onFollowUp()}
              />
              <button type="button" onClick={onFollowUp} disabled={!current && !isStreaming}>追问</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
