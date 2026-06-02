import { useRef, useState } from 'react'
import NoteCatalog from './NoteCatalog'
import NotebookList from './NotebookList'
import InterpretBody from './InterpretBody'
import NoteReaderSettings from './NoteReaderSettings'
import type { CatalogNodeDO, PromptTemplateDO, ReaderSettingsDO, SessionDO } from '../../bindings/wread/internal/model'
import {
  readCatalogSide,
  saveCatalogSide,
  type CatalogSide,
} from '../lib/catalogLayout'
import { useCatalogPanelWidth } from '../hooks/useCatalogPanelWidth'
import { useNotebookListWidth } from '../hooks/useNotebookListWidth'
import { NoteEdgeRail } from './PaneEdgeRail'

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
  readerSettings: ReaderSettingsDO
  onReaderSettingsChange: (next: ReaderSettingsDO) => void
  templates: PromptTemplateDO[]
  activeTemplateId: string
  onPickTemplate: (id: string) => void
  status: string
  interpreting: boolean
  interpretBody: string
  emptyHint: string
  isStreaming: boolean
  current: string
  question: string
  onQuestionChange: (q: string) => void
  onFollowUp: () => void
  catalogAutoAdd: boolean
  onCatalogAutoAddChange: (auto: boolean) => void
  pendingInChapter: boolean
  onAddToChapter: () => void
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
  showEdgeRail?: boolean
  onToggleListOpen?: () => void
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
  readerSettings,
  onReaderSettingsChange,
  templates,
  activeTemplateId,
  onPickTemplate,
  status,
  interpreting,
  interpretBody,
  emptyHint,
  isStreaming,
  current,
  question,
  onQuestionChange,
  onFollowUp,
  catalogAutoAdd,
  onCatalogAutoAddChange,
  pendingInChapter,
  onAddToChapter,
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
  showEdgeRail = false,
  onToggleListOpen,
  className = 'sidebar-body',
}: Props) {
  const [catalogSide, setCatalogSide] = useState<CatalogSide>(readCatalogSide)
  const splitRef = useRef<HTMLDivElement>(null)
  const { panelStyle, startWidthDrag } = useCatalogPanelWidth(catalogSide)
  const { panelStyle: notebookPanelStyle, startWidthDrag: startNotebookWidthDrag } = useNotebookListWidth()

  /** setCatalogPanelSide 切换目录侧栏左右位置。 */
  const setCatalogPanelSide = (side: CatalogSide) => {
    setCatalogSide(side)
    saveCatalogSide(side)
  }

  return (
    <div className={`${className} notebook-pane-shell`}>
      {showEdgeRail && onToggleListOpen && (
        <NoteEdgeRail
          listOpen={listOpen}
          onToggleList={onToggleListOpen}
          catalogCollapsed={catalogCollapsed}
          onToggleCatalog={() => onCatalogCollapsedChange(!catalogCollapsed)}
        />
      )}
      <div
        ref={splitRef}
        className={`note-split${listOpen ? '' : ' notebook-collapsed'}${catalogCollapsed ? ' catalog-collapsed' : ''}${catalogSide === 'right' ? ' catalog-right' : ''}`}
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

        {!catalogCollapsed && (
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
            onToggleCatalogSide={() => setCatalogPanelSide(catalogSide === 'left' ? 'right' : 'left')}
            panelStyle={panelStyle}
            onResizeStart={(x) => startWidthDrag(x, splitRef.current?.clientWidth || window.innerWidth)}
          />
        )}

        <div className="catalog-splitter">
          {!catalogAutoAdd && pendingInChapter && (
            <button
              type="button"
              className="catalog-splitter-add"
              title="将当前解读归入选中章节"
              onClick={(e) => {
                e.stopPropagation()
                onAddToChapter()
              }}
            >
              归入
            </button>
          )}
        </div>

        <div className="note-page">
          <div className="note-page-bar">
            <NoteReaderSettings
              settings={readerSettings}
              onChange={onReaderSettingsChange}
              templates={templates}
              activeTemplateId={activeTemplateId}
              onPickTemplate={onPickTemplate}
              catalogSide={catalogSide}
              onCatalogSideChange={setCatalogPanelSide}
            />
            <div className="note-catalog-mode" role="radiogroup" aria-label="归入方式">
              <button
                type="button"
                role="radio"
                aria-checked={catalogAutoAdd}
                className={catalogAutoAdd ? 'active' : ''}
                onClick={() => onCatalogAutoAddChange(true)}
              >
                自动
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={!catalogAutoAdd}
                className={!catalogAutoAdd ? 'active' : ''}
                onClick={() => onCatalogAutoAddChange(false)}
              >
                手动
              </button>
            </div>
          </div>
          {status && <div className={`status-line ${interpreting ? 'busy' : 'error'}`}>{status}</div>}
          <div className="panel current-panel">
            <InterpretBody
              content={interpretBody}
              emptyHint={emptyHint}
              streaming={interpreting && isStreaming}
              layoutTheme={readerSettings.layoutTheme}
              pageTitle={pageTitle}
              notebookName={notebookName}
              concepts={concepts}
            />
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
