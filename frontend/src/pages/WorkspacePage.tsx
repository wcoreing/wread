import { useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react'
import { Events, Window as WailsWindow } from '@wailsio/runtime'
import { Service } from '../../bindings/wread/internal/app'
import AiSettings from '../components/AiSettings'
import NoteToolbar, { type NoteMenu } from '../components/NoteToolbar'
import NotebookPane from '../components/NotebookPane'
import TemplateManager from '../components/TemplateManager'
import { useActiveNotebook } from '../hooks/useActiveNotebook'
import { useNotebookListOverlay } from '../hooks/useNotebookListOverlay'
import { useInterpretSettings } from '../hooks/useInterpretSettings'
import { useNoteLayout } from '../hooks/useNoteLayout'
import { useCatalogCollapsed } from '../hooks/useCatalogCollapsed'
import { ReaderEdgeRail } from '../components/PaneEdgeRail'
import { readerStyleVars } from '../lib/readerStyle'
import { sidebarDragLimits } from '../lib/layoutLimits'
import '../pages/overlay.css'
import '../pages/sidebar.css'
import './workspace.css'

export default function WorkspacePage() {
  const nb = useActiveNotebook()
  const layout = useNoteLayout()
  const interpretSettings = useInterpretSettings()
  const { listOpen, setListOpen } = useNotebookListOverlay()
  const [catalogCollapsed, setCatalogCollapsed] = useCatalogCollapsed()

  const [editable, setEditable] = useState(false)
  const [readingMode, setReadingMode] = useState(false)
  const [passAX, setPassAX] = useState(true)
  const [noteMenu, setNoteMenu] = useState<NoteMenu>('note')

  const notePaneRef = useRef<HTMLElement>(null)

  useEffect(() => {
    Service.GetReadingMode().then(setReadingMode).catch(console.error)
    Events.On('overlay:editable', (ev: { data: boolean }) => setEditable(ev.data))
    Events.On('overlay:readingMode', (ev: { data: boolean }) => setReadingMode(ev.data))
    Events.On('overlay:passAX', (ev: { data: boolean }) => setPassAX(ev.data))
    Events.On('focus:note', () => notePaneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
    Events.On('read:status', () => setNoteMenu('note'))
  }, [])

  useEffect(() => {
    if (noteMenu !== 'note') setListOpen(false)
  }, [noteMenu, setListOpen])

  /** interpret 解读阅读器框内正文。 */
  const interpret = async () => {
    if (nb.interpreting) return
    try {
      await Service.InterpretNow(await Service.DefaultRegion())
    } catch (e: unknown) {
      console.error(e)
    }
  }

  const pickNotePlace = async (place: Parameters<typeof layout.pickNotePlace>[0]) => {
    try {
      await layout.pickNotePlace(place)
    } catch (e: unknown) {
      nb.setStatus(String(e))
    }
  }

  const isVerticalLayout = layout.layoutPlace === 'top' || layout.layoutPlace === 'bottom'

  const startSplitterDrag = (startPos: number) => {
    layout.skipSidebarSync.current = true
    const startW = layout.sidebarW
    const vertical = isVerticalLayout
    const left = layout.layoutPlace === 'left'
    const { min, max } = sidebarDragLimits(vertical)
    let latest = startW
    const onMove = (ev: MouseEvent) => {
      let delta: number
      if (vertical) {
        delta = ev.clientY - startPos
      } else if (left) {
        delta = ev.clientX - startPos
      } else {
        delta = startPos - ev.clientX
      }
      latest = Math.max(min, Math.min(max, Math.round(startW + delta)))
      layout.setSidebarW(latest)
    }
    const onUp = () => {
      layout.skipSidebarSync.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      Service.SetSidebarWidth(latest).catch(console.error)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const placeClass = layout.layoutPlace === 'popout' ? 'place-right' : `place-${layout.layoutPlace}`

  const pickReadingMode = async (on: boolean) => {
    try {
      await Service.SetReadingMode(on)
      setReadingMode(on)
      if (on) setEditable(false)
    } catch (e: unknown) {
      console.error(e)
    }
  }

  /** onModePointerDown 失焦后一次点击即可切换阅读器模式。 */
  const onModePointerDown = (on: boolean) => (e: ReactMouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    void WailsWindow.Focus()
      .then(() => pickReadingMode(on))
      .catch(console.error)
  }

  /** onInterpretClick 顶栏解读（未内嵌时）。 */
  const onInterpretClick = () => {
    if (nb.interpreting) return
    void interpret()
    void WailsWindow.Focus().catch(console.error)
  }

  const onRestoreWindow = () => {
    void Service.RestoreDefaultWindowLayout().catch(console.error)
  }

  const showEdgeRails = layout.docked && layout.layoutPlace !== 'center'
  const showNoteEdgeRail = showEdgeRails && noteMenu === 'note'

  const scopeModeClass = editable ? 'edit-mode' : readingMode ? 'read-mode' : 'op-mode'
  const overlayTip = editable
    ? '拖此栏或四边调整'
    : readingMode
      ? passAX
        ? '中间穿透翻页 · 边框可拖'
        : '中间穿透翻页 · 请在系统设置开启辅助功能'
      : '操作模式 · 点击不穿透'

  const overlayHint = editable
    ? '对准正文 · 点内侧「解读」或 ⌘⇧R'
    : readingMode
      ? '拖顶栏移动 · 拖边框缩放 · 中间穿透翻页'
      : '切到「阅读」后穿透翻页 · ⌘⇧O 调整框'

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
      className={`workspace ${layout.docked ? 'docked' : 'undocked'} ${placeClass}`}
      style={{ '--sidebar-w': `${layout.sidebarW}px` } as CSSProperties}
    >
      <section className={`scope-pane reader-pane ${scopeModeClass}`}>
        <div className="overlay-toolbar scope-toolbar">
          <span className="overlay-brand">阅读器</span>
          <div className="overlay-mode-radio" role="radiogroup" aria-label="阅读器模式">
            <button
              type="button"
              role="radio"
              aria-checked={!readingMode}
              className={!readingMode ? 'active' : ''}
              onMouseDown={onModePointerDown(false)}
            >
              操作
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={readingMode}
              className={readingMode ? 'active' : ''}
              onMouseDown={onModePointerDown(true)}
            >
              阅读
            </button>
          </div>
          <span className="overlay-tip">{overlayTip}</span>
          <button
            type="button"
            className="overlay-restore-btn"
            title="恢复默认窗口：阅读区 640、笔记 480、高 780"
            onClick={onRestoreWindow}
          >
            恢复窗口
          </button>
          {!showEdgeRails && (
            <div className="overlay-interpret-group">
              <button
                type="button"
                className="overlay-interpret-btn"
                disabled={nb.interpreting}
                onClick={onInterpretClick}
              >
                {nb.interpreting ? '解读中…' : '解读'}
              </button>
            </div>
          )}
        </div>

        {(readingMode || editable) && (
          <>
            <div className="overlay-edge overlay-edge-top" />
            <div className="overlay-edge overlay-edge-bottom" />
            <div className="overlay-edge overlay-edge-left" />
            <div className="overlay-edge overlay-edge-right" />
            <div className="overlay-corner overlay-corner-nw" />
            <div className="overlay-corner overlay-corner-ne" />
            <div className="overlay-corner overlay-corner-sw" />
            <div className="overlay-corner overlay-corner-se" />
          </>
        )}

        <div className="overlay-frame">
          <span className="overlay-hint">{overlayHint}</span>
        </div>

        {showEdgeRails && (
          <ReaderEdgeRail interpreting={nb.interpreting} onInterpret={() => void interpret()} />
        )}
      </section>

      {layout.docked && (
        <>
          {layout.layoutPlace !== 'center' && (
            <div className="workspace-splitter">
              <div
                className="workspace-splitter-drag"
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  startSplitterDrag(isVerticalLayout ? e.clientY : e.clientX)
                }}
              />
            </div>
          )}
          <aside ref={notePaneRef} className="note-pane" style={readerStyleVars(nb.readerSettings)}>
            <NoteToolbar
              className="sidebar-toolbar note-toolbar"
              version={nb.appInfo?.version}
              layoutPlace={layout.layoutPlace}
              activeMenu={noteMenu}
              onPickMenu={setNoteMenu}
              onPickPlace={(place) => pickNotePlace(place).catch(console.error)}
            />
            {noteMenu === 'templates' && (
              <TemplateManager settings={interpretSettings} className="sidebar-body interpret-settings" />
            )}
            {noteMenu === 'ai' && (
              <AiSettings settings={interpretSettings} className="sidebar-body interpret-settings" />
            )}
            {noteMenu === 'note' && (
              <NotebookPane
                showEdgeRail={showNoteEdgeRail}
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
          </aside>
        </>
      )}
    </div>
  )
}
