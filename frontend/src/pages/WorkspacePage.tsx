import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react'
import { Events, Window as WailsWindow } from '@wailsio/runtime'
import { Service } from '../../bindings/wread/internal/app'
import NoteToolbar, { type NoteMenu } from '../components/NoteToolbar'
import NoteScopeBar from '../components/NoteScopeBar'
import NotebookPane from '../components/NotebookPane'
import SettingsPanel from '../components/SettingsPanel'
import { useActiveNotebook } from '../hooks/useActiveNotebook'
import { useNotebookListOverlay } from '../hooks/useNotebookListOverlay'
import { useInterpretSettings } from '../hooks/useInterpretSettings'
import { useNoteLayout } from '../hooks/useNoteLayout'
import { useCatalogCollapsed } from '../hooks/useCatalogCollapsed'
import { useWorkspaceFrameDrag, type FrameEdge } from '../hooks/useWorkspaceFrameDrag'
import { useWindowLayoutPresets } from '../hooks/useWindowLayoutPresets'
import { ReaderEdgeRail } from '../components/PaneEdgeRail'
import WorkspaceCatalogPane from '../components/WorkspaceCatalogPane'
import ScopeNoteBody from '../components/ScopeNoteBody'
import { useScopeMode } from '../hooks/useScopeMode'
import type { ScopeMode } from '../lib/scopeMode'
import { readCatalogSide, saveCatalogSide, type CatalogSide } from '../lib/catalogLayout'
import { readerStyleVars } from '../lib/readerStyle'
import { sidebarDragLimits, workspaceFrameMinSize, catalogColumnWidth } from '../lib/layoutLimits'
import '../pages/overlay.css'
import '../pages/sidebar.css'
import './workspace.css'

export default function WorkspacePage() {
  const nb = useActiveNotebook()
  const layout = useNoteLayout()
  const interpretSettings = useInterpretSettings()
  const layoutPresets = useWindowLayoutPresets()
  const { listOpen, setListOpen } = useNotebookListOverlay()
  const [catalogCollapsed, setCatalogCollapsed] = useCatalogCollapsed()
  const [catalogSide, setCatalogSide] = useState<CatalogSide>(readCatalogSide)

  /** setCatalogPanelSide 切换目录在笔记区内的左右位置。 */
  const setCatalogPanelSide = (side: CatalogSide) => {
    setCatalogSide(side)
    saveCatalogSide(side)
  }

  const [editable, setEditable] = useState(false)
  const { scopeMode, pickScopeMode, notesInScope, frameAdjustable } = useScopeMode()
  const [passAX, setPassAX] = useState(true)
  const [noteMenu, setNoteMenu] = useState<NoteMenu>('note')

  const notePaneRef = useRef<HTMLElement>(null)
  const frameMin = useMemo(
    () => workspaceFrameMinSize(layout.docked, layout.layoutPlace, layout.sidebarW),
    [layout.docked, layout.layoutPlace, layout.sidebarW],
  )
  const frameDrag = useWorkspaceFrameDrag(frameAdjustable || editable, frameMin)

  useEffect(() => {
    Events.On('overlay:editable', (ev: { data: boolean }) => setEditable(ev.data))
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
    const catalogW = catalogInReaderZone ? catalogColumnWidth(catalogCollapsed) : 0
    const { min, max } = sidebarDragLimits(vertical, catalogW)
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
  const catalogInReaderZone = layout.docked && layout.layoutPlace === 'right'

  useEffect(() => {
    if (catalogInReaderZone) {
      return
    }
    void Service.SetCatalogWidth(0).catch(console.error)
  }, [catalogInReaderZone])

  /** onModePointerDown 失焦后一次点击即可切换阅读器模式。 */
  const onModePointerDown = (mode: ScopeMode) => (e: ReactMouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    void WailsWindow.Focus()
      .then(() => pickScopeMode(mode))
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

  /** onToolbarMouseDown 顶栏空白区拖动移动窗口（不走 wails:drag）。 */
  const onToolbarMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement
    if (t.closest('button, .overlay-mode-radio, .overlay-restore-btn, .overlay-interpret-group')) {
      return
    }
    frameDrag.startMove(e)
  }

  /** onNoteToolbarMouseDown 笔记顶栏空白区拖动移动窗口。 */
  const onNoteToolbarMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement
    if (t.closest('button, .note-layout-select, .note-theme-select, .note-toolbar-spacer')) {
      return
    }
    frameDrag.startMove(e)
  }

  const showFrameResize = frameAdjustable || editable

  /** renderNoteOuterFrame 内嵌时笔记侧窗口外边框（place-right 等为右/左/上/下边）。 */
  const renderNoteOuterFrame = () => {
    if (!layout.docked || !showFrameResize) {
      return null
    }
    const onEdge = (edge: FrameEdge) => (e: ReactMouseEvent) => frameDrag.start(edge, e)
    switch (layout.layoutPlace) {
      case 'right':
        return (
          <>
            <div className="overlay-edge overlay-edge-top" onMouseDown={onEdge('n')} />
            <div className="overlay-edge overlay-edge-bottom" onMouseDown={onEdge('s')} />
            <div className="overlay-edge overlay-edge-right" onMouseDown={onEdge('e')} />
            <div className="overlay-corner overlay-corner-ne" onMouseDown={onEdge('ne')} />
            <div className="overlay-corner overlay-corner-se" onMouseDown={onEdge('se')} />
          </>
        )
      case 'left':
        return (
          <>
            <div className="overlay-edge overlay-edge-top" onMouseDown={onEdge('n')} />
            <div className="overlay-edge overlay-edge-bottom" onMouseDown={onEdge('s')} />
            <div className="overlay-edge overlay-edge-left" onMouseDown={onEdge('w')} />
            <div className="overlay-corner overlay-corner-nw" onMouseDown={onEdge('nw')} />
            <div className="overlay-corner overlay-corner-sw" onMouseDown={onEdge('sw')} />
          </>
        )
      case 'top':
        return (
          <>
            <div className="overlay-edge overlay-edge-top" onMouseDown={onEdge('n')} />
            <div className="overlay-edge overlay-edge-left" onMouseDown={onEdge('w')} />
            <div className="overlay-edge overlay-edge-right" onMouseDown={onEdge('e')} />
            <div className="overlay-corner overlay-corner-nw" onMouseDown={onEdge('nw')} />
            <div className="overlay-corner overlay-corner-ne" onMouseDown={onEdge('ne')} />
          </>
        )
      case 'bottom':
        return (
          <>
            <div className="overlay-edge overlay-edge-bottom" onMouseDown={onEdge('s')} />
            <div className="overlay-edge overlay-edge-left" onMouseDown={onEdge('w')} />
            <div className="overlay-edge overlay-edge-right" onMouseDown={onEdge('e')} />
            <div className="overlay-corner overlay-corner-sw" onMouseDown={onEdge('sw')} />
            <div className="overlay-corner overlay-corner-se" onMouseDown={onEdge('se')} />
          </>
        )
      default:
        return null
    }
  }

  const showReaderEdgeRail = layout.layoutPlace !== 'center'

  useEffect(() => {
    if (nb.catalogEntryScrollId) {
      setCatalogCollapsed(false)
    }
  }, [nb.catalogEntryScrollId, setCatalogCollapsed])

  const toggleCatalog = () => setCatalogCollapsed(!catalogCollapsed)

  useEffect(() => {
    if (!catalogInReaderZone) return
    void Service.SetCatalogWidth(catalogCollapsed ? 0 : catalogColumnWidth(false)).catch(console.error)
  }, [catalogInReaderZone, catalogCollapsed])

  const scopeModeClass = editable ? 'edit-mode' : `${scopeMode}-mode`
  const overlayTip = editable
    ? '拖此栏或四边调整'
    : scopeMode === 'read'
      ? passAX
        ? '中间穿透翻页 · 边框可拖'
        : '中间穿透翻页 · 请在系统设置开启辅助功能'
      : scopeMode === 'note'
        ? '阅读区显示笔记 · 右侧对照原文'
        : '操作模式 · 点击不穿透'

  const overlayHint = editable
    ? '对准正文 · 点内侧「解读」或 ⌘⇧R'
    : scopeMode === 'read'
      ? '拖顶栏移动 · 拖边框缩放 · 中间穿透翻页'
      : scopeMode === 'note'
        ? '在目录选页 · 右侧看 OCR 原文'
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
    catalogExternal: catalogInReaderZone,
    notesInScope,
    hideReaderBar: notesInScope,
    catalogSide,
    onCatalogSideChange: setCatalogPanelSide,
    ocrOriginal: nb.ocrOriginal,
    capturePreview: nb.capturePreview,
  }

  const catalogPaneProps = {
    notebookName: notePaneProps.notebookName,
    onNotebookNameChange: notePaneProps.onNotebookNameChange,
    catalogNodes: notePaneProps.catalogNodes,
    selectedChapterId: notePaneProps.selectedChapterId,
    selectedPageId: notePaneProps.selectedPageId,
    onSelectChapter: notePaneProps.onSelectChapter,
    onSelectPage: notePaneProps.onSelectPage,
    onCreateChapter: notePaneProps.onCreateChapter,
    onRenameNode: notePaneProps.onRenameNode,
    onDeleteNode: notePaneProps.onDeleteNode,
    onBatchDeleteNodes: notePaneProps.onBatchDeleteNodes,
    onMoveNode: notePaneProps.onMoveNode,
    scrollToNodeId: nb.catalogEntryScrollId,
    onScrollToNodeDone: nb.clearCatalogEntryScroll,
  }

  return (
    <div
      className={`workspace ${layout.docked ? 'docked' : 'undocked'} ${placeClass}`}
      style={{ '--sidebar-w': `${layout.sidebarW}px` } as CSSProperties}
    >
      {catalogInReaderZone && !catalogCollapsed && (
        <WorkspaceCatalogPane
          {...catalogPaneProps}
        />
      )}
      <section
        className={`scope-pane reader-pane ${scopeModeClass}`}
        style={notesInScope ? (readerStyleVars(nb.readerSettings) as CSSProperties) : undefined}
      >
          <div className="overlay-toolbar scope-toolbar" onMouseDown={onToolbarMouseDown}>
          <span className="overlay-brand">阅读器</span>
          <div className="overlay-mode-radio" role="radiogroup" aria-label="阅读器模式">
            <button
              type="button"
              role="radio"
              aria-checked={scopeMode === 'op'}
              className={scopeMode === 'op' ? 'active' : ''}
              onMouseDown={onModePointerDown('op')}
            >
              操作
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={scopeMode === 'read'}
              className={scopeMode === 'read' ? 'active' : ''}
              onMouseDown={onModePointerDown('read')}
            >
              阅读
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={scopeMode === 'note'}
              className={scopeMode === 'note' ? 'active' : ''}
              onMouseDown={onModePointerDown('note')}
            >
              笔记
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
          {!showReaderEdgeRail && (
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

        {(frameAdjustable || editable) && (
          <>
            <div className="overlay-edge overlay-edge-top" onMouseDown={(e) => frameDrag.start('n', e)} />
            <div className="overlay-edge overlay-edge-bottom" onMouseDown={(e) => frameDrag.start('s', e)} />
            <div className="overlay-edge overlay-edge-left" onMouseDown={(e) => frameDrag.start('w', e)} />
            <div className="overlay-edge overlay-edge-right" onMouseDown={(e) => frameDrag.start('e', e)} />
            <div className="overlay-corner overlay-corner-nw" onMouseDown={(e) => frameDrag.start('nw', e)} />
            <div className="overlay-corner overlay-corner-ne" onMouseDown={(e) => frameDrag.start('ne', e)} />
            <div className="overlay-corner overlay-corner-sw" onMouseDown={(e) => frameDrag.start('sw', e)} />
            <div className="overlay-corner overlay-corner-se" onMouseDown={(e) => frameDrag.start('se', e)} />
          </>
        )}

        {notesInScope ? (
          <ScopeNoteBody
            content={nb.interpretBody}
            emptyHint={nb.emptyHint}
            streaming={nb.interpreting && Boolean(nb.streaming)}
            pageTitle={nb.pageTitle}
            notebookName={nb.notebookName}
            concepts={nb.concepts}
            readerSettings={nb.readerSettings}
            onReaderSettingsChange={nb.updateReaderSettings}
          />
        ) : (
          <>
            {editable && <div className="overlay-frame" />}
            <span className="overlay-hint">{overlayHint}</span>
          </>
        )}

        {showReaderEdgeRail && (
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
            {renderNoteOuterFrame()}
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
                showWakeReader={layout.layoutPlace === 'popout'}
                className="sidebar-body interpret-settings"
              />
            )}
            {noteMenu === 'note' && (
              <>
                <NoteScopeBar
                  listOpen={listOpen}
                  onToggleList={() => setListOpen(!listOpen)}
                  catalogCollapsed={catalogCollapsed}
                  onToggleCatalog={toggleCatalog}
                  showEntryMode={!notesInScope}
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
        </>
      )}
    </div>
  )
}
