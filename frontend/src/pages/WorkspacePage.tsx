import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react'
import { Events, Window as WailsWindow } from '@wailsio/runtime'
import { Service } from '../../bindings/wread/internal/app'
import ManagerPane from '../components/ManagerPane'
import NotebookPane from '../components/NotebookPane'
import WorkspaceFrameHandles from '../components/WorkspaceFrameHandles'
import { useSyncNavCatalogWidth } from '../hooks/useSyncNavCatalogWidth'
import { useSyncScopePanelVisible } from '../hooks/useSyncScopePanelVisible'
import { useActiveNotebook } from '../hooks/useActiveNotebook'
import { useInterpretSettings } from '../hooks/useInterpretSettings'
import { useNoteLayout } from '../hooks/useNoteLayout'
import { handleManagerToolbarMouseDown, useWorkspaceFrameDrag, type FrameEdge } from '../hooks/useWorkspaceFrameDrag'
import { useWindowLayoutPresets } from '../hooks/useWindowLayoutPresets'
import { ContinuousControls, InterpretToolbarBtn, ReaderEdgeRail } from '../components/PaneEdgeRail'
import { usePillRestore } from '../hooks/usePillRestore'
import { useScopeMode } from '../hooks/useScopeMode'
import PanelRestoreRail from '../components/PanelRestoreRail'
import { usePanelVisibility } from '../hooks/usePanelVisibility'
import type { NoteMenu } from '../components/NoteToolbar'
import type { ScopeMode } from '../lib/scopeMode'
import { readerStyleVars } from '../lib/readerStyle'
import { sidebarDragLimits, workspaceFrameMinSize } from '../lib/layoutLimits'
import '../pages/overlay.css'
import '../pages/sidebar.css'
import './workspace.css'

export default function WorkspacePage() {
  const nb = useActiveNotebook()
  const layout = useNoteLayout()
  const interpretSettings = useInterpretSettings()
  const layoutPresets = useWindowLayoutPresets()
  const { panels, setPanel, showManager, showScope, showWread, showNotePane } = usePanelVisibility()

  const [editable, setEditable] = useState(false)
  const { scopeMode, pickScopeMode, frameAdjustable } = useScopeMode()
  const [passAX, setPassAX] = useState(true)
  const [noteMenu, setNoteMenu] = useState<NoteMenu>('note')

  const notePaneRef = useRef<HTMLElement>(null)
  const shellLayout = layout.docked
  const managerWidthRef = useRef(0)
  const frameMin = useMemo(
    () => workspaceFrameMinSize(layout.docked, layout.layoutPlace, layout.sidebarW, managerWidthRef.current),
    [layout.docked, layout.layoutPlace, layout.sidebarW],
  )
  const frameDragShell = useWorkspaceFrameDrag(shellLayout, frameMin)
  const frameDragScope = useWorkspaceFrameDrag(frameAdjustable || editable, frameMin)
  const { reportManagerWidth, managerWidth } = useSyncNavCatalogWidth(shellLayout && showManager)
  managerWidthRef.current = managerWidth.current

  /** minimizeToPill 收起为悬浮图标并保存当前 Tab。 */
  const minimizeToPill = useCallback(() => {
    void Service.MinimizeToPill(noteMenu).catch(console.error)
  }, [noteMenu])

  usePillRestore(setNoteMenu)

  useSyncScopePanelVisible(shellLayout, showScope)

  useEffect(() => {
    Events.On('overlay:editable', (ev: { data: boolean }) => setEditable(ev.data))
    Events.On('overlay:passAX', (ev: { data: boolean }) => setPassAX(ev.data))
    Events.On('focus:note', () => notePaneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
    Events.On('read:status', () => setNoteMenu('note'))
  }, [])

  useEffect(() => {
    if (scopeMode === 'note') {
      void pickScopeMode('read')
    }
  }, [scopeMode, pickScopeMode])

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

  const startSplitterDrag = (startPos: number, splitterEl?: HTMLElement | null) => {
    layout.skipSidebarSync.current = true
    splitterEl?.classList.add('dragging')
    void Service.BeginWorkspaceFrameDrag().catch(console.error)
    const startW = layout.sidebarW
    const vertical = isVerticalLayout
    const left = layout.layoutPlace === 'left'
    const { min, max } = sidebarDragLimits(vertical, managerWidthRef.current)
    let latest = startW
    let syncTimer = 0
    const syncNative = (w: number) => {
      if (syncTimer) return
      syncTimer = window.setTimeout(() => {
        syncTimer = 0
        void Service.SetSidebarWidth(w).catch(console.error)
      }, 48)
    }
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
      syncNative(latest)
    }
    const onUp = () => {
      if (syncTimer) {
        window.clearTimeout(syncTimer)
        syncTimer = 0
      }
      splitterEl?.classList.remove('dragging')
      layout.skipSidebarSync.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      void Service.SetSidebarWidth(latest).catch(console.error)
      void Service.FinishWorkspaceResize().catch(console.error)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const onModePointerDown = (mode: ScopeMode) => (e: ReactMouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    void WailsWindow.Focus()
      .then(() => pickScopeMode(mode))
      .catch(console.error)
  }

  /** ensureReadModeForContinuous 连续伴读需穿透阅读模式。 */
  const ensureReadModeForContinuous = async () => {
    if (scopeMode === 'read') return
    await pickScopeMode('read')
  }

  const onContinuousReadChange = async (on: boolean) => {
    if (on) await ensureReadModeForContinuous()
    await nb.setContinuousReadMode(on)
  }

  const onInterpretClick = () => {
    if (nb.interpreting) return
    void (async () => {
      if (nb.continuousRead) await ensureReadModeForContinuous()
      await interpret()
    })()
    void WailsWindow.Focus().catch(console.error)
  }

  const onRestoreWindow = () => {
    void Service.RestoreDefaultWindowLayout().catch(console.error)
  }

  /** onManagerMouseDown 管理区顶栏：品牌区拖动/缩放，空白区移动窗口。 */
  const onManagerMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    handleManagerToolbarMouseDown(e, frameDragShell, layout.layoutPlace)
  }

  /** onScopeToolbarMouseDown 阅读区顶栏空白拖动窗口。 */
  const onScopeToolbarMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement
    if (t.closest('button, .overlay-mode-radio, .overlay-interpret-group, .overlay-continuous-group, .toggle-switch, .overlay-continuous-stop-btn')) {
      return
    }
    const drag = shellLayout ? frameDragShell : frameDragScope
    drag.startMove(e)
  }

  const showFrameResize = shellLayout || frameAdjustable || editable
  const effectiveShowScope = shellLayout ? showScope : true
  const effectiveShowNotePane = shellLayout && showNotePane
  const showReaderEdgeRail = layout.layoutPlace !== 'center' && effectiveShowScope
  const onShellEdge = (edge: FrameEdge) => (e: ReactMouseEvent) => frameDragShell.start(edge, e)

  const scopeModeClass = editable ? 'edit-mode' : `${scopeMode}-mode`
  const overlayTip = editable
    ? '拖边框调整阅读框'
    : scopeMode === 'read'
      ? passAX
        ? '穿透翻页 · 左栏管笔记与布局'
        : '穿透翻页 · 请开启辅助功能'
      : '操作模式 · 点击不穿透'

  const overlayHint = editable
    ? '对准正文 · 内侧「解读」或 ⌘⇧R'
    : shellLayout
      ? '拖窗口四边缩放 · 阅读与笔记间分割条调宽度 · ⌘⇧O 微调阅读框'
      : scopeMode === 'read'
        ? '中间穿透翻页 · ⌘⇧O 调整框'
        : '切到「阅读」后穿透翻页'

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

  const workspaceClass = [
    'workspace',
    layout.docked ? 'docked shell-layout' : 'undocked',
    layout.docked ? 'place-right' : layout.layoutPlace === 'popout' ? 'place-right' : `place-${layout.layoutPlace}`,
    showManager ? 'has-manager' : 'manager-hidden',
    !effectiveShowScope ? 'scope-hidden' : '',
    !effectiveShowNotePane ? 'note-hidden' : '',
    !showWread ? 'wread-hidden' : '',
    panels.source ? 'source-open' : 'source-hidden',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={workspaceClass}
      style={{ '--sidebar-w': `${layout.sidebarW}px` } as CSSProperties}
    >
      {shellLayout && showManager && (
        <ManagerPane
          version={nb.appInfo?.version}
          activeMenu={noteMenu}
          onPickMenu={setNoteMenu}
          onMinimizeToPill={minimizeToPill}
          onRestoreWindow={onRestoreWindow}
          onMouseDown={onManagerMouseDown}
          panels={panels}
          onSetPanel={setPanel}
          onWidthChange={reportManagerWidth}
          layoutPlace={layout.layoutPlace}
          onPickPlace={(place) => pickNotePlace(place).catch(console.error)}
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

      {shellLayout && !showManager && (
        <PanelRestoreRail panels={panels} onSetPanel={setPanel} layoutPresets={layoutPresets} />
      )}

      {effectiveShowScope && (
        <section className={`scope-pane reader-pane focus-canvas-scope ${scopeModeClass}`}>
          <div className="overlay-toolbar scope-toolbar scope-toolbar-lite" onMouseDown={onScopeToolbarMouseDown}>
            <span className="overlay-brand">阅读</span>
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
            </div>
            <ContinuousControls
              continuousRead={nb.continuousRead}
              continuousRunning={nb.continuousRunning}
              onContinuousReadChange={(on) => onContinuousReadChange(on).catch(console.error)}
              onStopContinuous={() => nb.stopContinuousRead().catch(console.error)}
            />
            <span className="overlay-tip">{overlayTip}</span>
            {!showReaderEdgeRail && (
              <InterpretToolbarBtn interpreting={nb.interpreting} onInterpret={onInterpretClick} />
            )}
          </div>

          {!shellLayout && (frameAdjustable || editable) && (
            <>
              <div className="overlay-edge overlay-edge-top" onMouseDown={(e) => frameDragScope.start('n', e)} />
              <div className="overlay-edge overlay-edge-bottom" onMouseDown={(e) => frameDragScope.start('s', e)} />
              <div className="overlay-edge overlay-edge-left" onMouseDown={(e) => frameDragScope.start('w', e)} />
              <div className="overlay-edge overlay-edge-right" onMouseDown={(e) => frameDragScope.start('e', e)} />
              <div className="overlay-corner overlay-corner-nw" onMouseDown={(e) => frameDragScope.start('nw', e)} />
              <div className="overlay-corner overlay-corner-ne" onMouseDown={(e) => frameDragScope.start('ne', e)} />
              <div className="overlay-corner overlay-corner-sw" onMouseDown={(e) => frameDragScope.start('sw', e)} />
              <div className="overlay-corner overlay-corner-se" onMouseDown={(e) => frameDragScope.start('se', e)} />
            </>
          )}

          {editable && <div className="overlay-frame" />}
          <span className="overlay-hint">{overlayHint}</span>

          {showReaderEdgeRail && (
            <ReaderEdgeRail interpreting={nb.interpreting} onInterpret={onInterpretClick} />
          )}
        </section>
      )}

      {effectiveShowScope && effectiveShowNotePane && (
        <>
          <div className="workspace-splitter scope-note-splitter">
            <div
              className="workspace-splitter-drag"
              title="拖动调整阅读区与笔记区宽度"
              onMouseDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const splitter = (e.currentTarget as HTMLElement).closest('.scope-note-splitter') as HTMLElement | null
                startSplitterDrag(isVerticalLayout ? e.clientY : e.clientX, splitter)
              }}
            />
          </div>
          <aside ref={notePaneRef} className="note-pane focus-canvas-note" style={readerStyleVars(nb.readerSettings)}>
            <NotebookPane {...notePaneProps} />
          </aside>
        </>
      )}

      {effectiveShowNotePane && !effectiveShowScope && (
        <aside ref={notePaneRef} className="note-pane focus-canvas-note note-only-right" style={readerStyleVars(nb.readerSettings)}>
          <NotebookPane {...notePaneProps} />
        </aside>
      )}

      {shellLayout && showFrameResize && (
        <WorkspaceFrameHandles onEdge={onShellEdge} hasNotePane={effectiveShowNotePane} />
      )}
    </div>
  )
}
