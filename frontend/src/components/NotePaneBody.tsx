import { useRef } from 'react'
import InterpretBody from './InterpretBody'
import NotePageBar from './NotePageBar'
import NoteSourcePanel from './NoteSourcePanel'
import type { ReaderSettingsDO } from '../../bindings/wread/internal/model'
import { useSourcePanelWidth } from '../hooks/useSourcePanelWidth'

type Props = {
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
  pageTitle: string
  concepts: string[]
  notebookName: string
  sourceCollapsed: boolean
  wreadVisible?: boolean
  ocrOriginal?: string
  capturePreview?: string
  className?: string
}

/** NotePaneBody wread 解读 + 原文对照（导航列已外置至工作区左侧）。 */
export default function NotePaneBody({
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
  pageTitle,
  concepts,
  notebookName,
  sourceCollapsed,
  wreadVisible = true,
  ocrOriginal = '',
  capturePreview = '',
  className = 'sidebar-body',
}: Props) {
  const workspaceRef = useRef<HTMLDivElement>(null)
  const { panelStyle: sourcePanelStyle, startWidthDrag: startSourceWidthDrag } = useSourcePanelWidth()
  const containerW = () => workspaceRef.current?.clientWidth || window.innerWidth

  return (
    <div className={`${className} notebook-pane-shell`}>
      <div
        ref={workspaceRef}
        className={`note-workspace note-content-workspace${sourceCollapsed ? ' source-collapsed' : ''}${!wreadVisible ? ' wread-hidden' : ''}`}
      >
        {wreadVisible && (
        <main className="note-wread-column">
          <NotePageBar settings={readerSettings} onChange={onReaderSettingsChange} />
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
          <div className="panel current-panel">
            <InterpretBody
              content={interpretBody}
              emptyHint={emptyHint}
              streaming={interpreting && isStreaming}
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
              <button type="button" onClick={onFollowUp} disabled={!current && !isStreaming}>
                追问
              </button>
            </div>
          </div>
        </main>
        )}

        {!sourceCollapsed && (
          <aside className="note-source-column" style={sourcePanelStyle}>
            <NoteSourcePanel
              ocrOriginal={ocrOriginal}
              capturePreview={capturePreview}
              pageTitle={pageTitle}
            />
            <div
              className="source-panel-resize"
              title="拖动调整原文区宽度"
              onMouseDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
                startSourceWidthDrag(e.clientX, containerW())
              }}
            />
          </aside>
        )}
      </div>
    </div>
  )
}
