package app

import (
	"log"
	"strings"
	"sync"
	"time"

	"wread/internal/model"
	"wread/internal/overlay"

	"github.com/wailsapp/wails/v3/pkg/application"
)

const (
	defaultScopeWidth      = 640
	defaultSidebarWidth    = 480
	defaultWorkspaceHeight = 780
	defaultWindowX         = 120
	defaultWindowY         = 120
	minScopeWidth          = 240
	minSidebarWidth        = 420
	minNoteHeight          = 200
)

// Workspace 单窗口开卷+笔记布局与弹出笔记窗管理。
type Workspace struct {
	svc       *Service
	state     model.WorkspaceStateDO
	syncing            bool
	frameLive          bool
	catalogW           int
	scopePanelVisible  bool
	lastW              int
	lastH     int
	saveMu    sync.Mutex
	saveTimer *time.Timer
}

// NewWorkspace 创建工作区控制器。
func NewWorkspace(svc *Service, st model.WorkspaceStateDO) *Workspace {
	st = normalizeWorkspace(st)
	return &Workspace{svc: svc, state: st, scopePanelVisible: true}
}

// State 返回当前持久化状态。
func (w *Workspace) State() model.WorkspaceStateDO {
	return w.state
}

// Settings 返回前端可见布局设置。
func (w *Workspace) Settings() model.LayoutSettingsDO {
	return model.LayoutSettingsDO{
		Docked:    w.state.Docked,
		SidebarW:  w.state.SidebarW,
		NotePlace: w.effectivePlace(),
	}
}

// InitialWorkspaceBounds 创建工作区窗口时的 bounds。
func (w *Workspace) InitialWorkspaceBounds() application.Rect {
	return application.Rect{
		X:      w.state.X,
		Y:      w.state.Y,
		Width:  w.windowWidth(),
		Height: w.state.H,
	}
}

// InitialPopoutBounds 创建弹出笔记窗时的 bounds。
func (w *Workspace) InitialPopoutBounds() application.Rect {
	if w.state.PopoutX != 0 || w.state.PopoutY != 0 {
		return application.Rect{
			X: w.state.PopoutX, Y: w.state.PopoutY,
			Width: w.state.SidebarW, Height: w.popoutHeight(),
		}
	}
	return w.defaultPopoutBounds()
}

// RestoreDefaultLayout 恢复默认窗口尺寸与内部分割（阅读器 640 + 笔记 480，高 780）。
func (w *Workspace) RestoreDefaultLayout() {
	if w.svc.workspace == nil {
		return
	}
	w.withSync(func() {
		w.state.ScopeW = defaultScopeWidth
		w.state.SidebarW = defaultSidebarWidth
		w.state.H = defaultWorkspaceHeight
		w.state.X = defaultWindowX
		w.state.Y = defaultWindowY
		w.state.PopoutX = 0
		w.state.PopoutY = 0
		w.state.PopoutH = 0

		w.svc.workspace.SetBounds(application.Rect{
			X: w.state.X, Y: w.state.Y,
			Width:  w.windowWidth(),
			Height: w.state.H,
		})

		if !w.state.Docked && w.svc.popout != nil {
			def := w.defaultPopoutBounds()
			w.svc.popout.SetBounds(def)
			w.state.PopoutX, w.state.PopoutY = def.X, def.Y
			w.state.PopoutH = def.Height
		}
	})
	w.saveMu.Lock()
	if w.saveTimer != nil {
		w.saveTimer.Stop()
		w.saveTimer = nil
	}
	w.saveMu.Unlock()
	if err := w.svc.store.SaveWorkspaceState(w.state); err != nil {
		log.Printf("[wread] restore layout save: %v", err)
	}
	w.syncPassThroughLayout()
	w.emitLayout()
	log.Printf("[wread] restore default layout docked=%v scope=%d sidebar=%d %dx%d",
		w.state.Docked, w.state.ScopeW, w.state.SidebarW, w.windowWidth(), w.state.H)
}

// LayoutSnapshot 读取当前窗口位置与内部分割（含弹出笔记窗）。
func (w *Workspace) LayoutSnapshot() model.WindowLayoutSnapshotDO {
	if w.svc.workspace != nil {
		b := w.svc.workspace.Bounds()
		w.state.X, w.state.Y, w.state.H = b.X, b.Y, b.Height
		if w.state.Docked {
			if w.isVertical() {
				w.state.ScopeW = b.Width
			} else {
				w.state.ScopeW = w.readerWidthFromBounds(b)
			}
		} else {
			w.state.ScopeW = b.Width
		}
		w.lastW, w.lastH = b.Width, b.Height
	}
	if !w.state.Docked && w.svc.popout != nil {
		pb := w.svc.popout.Bounds()
		w.state.PopoutX, w.state.PopoutY = pb.X, pb.Y
		w.state.PopoutH = pb.Height
		w.state.SidebarW = pb.Width
	}
	return model.WindowLayoutSnapshotDO{
		X: w.state.X, Y: w.state.Y, H: w.state.H,
		ScopeW: w.state.ScopeW, SidebarW: w.state.SidebarW,
		Docked: w.state.Docked, NotePlace: w.state.NotePlace,
		PopoutX: w.state.PopoutX, PopoutY: w.state.PopoutY, PopoutH: w.state.PopoutH,
	}
}

// ApplyLayoutSnapshot 应用窗口布局快照。
func (w *Workspace) ApplyLayoutSnapshot(snap model.WindowLayoutSnapshotDO) {
	if w.svc.workspace == nil {
		return
	}
	snap = normalizeLayoutSnapshot(snap)
	w.state.X = snap.X
	w.state.Y = snap.Y
	w.state.H = snap.H
	w.state.ScopeW = snap.ScopeW
	w.state.SidebarW = snap.SidebarW
	w.state.Docked = snap.Docked
	w.state.NotePlace = snap.NotePlace
	w.state.PopoutX = snap.PopoutX
	w.state.PopoutY = snap.PopoutY
	w.state.PopoutH = snap.PopoutH

	winW := layoutSnapshotWindowWidth(snap)
	w.withSync(func() {
		w.svc.workspace.SetBounds(application.Rect{
			X: snap.X, Y: snap.Y, Width: winW, Height: snap.H,
		})
		if w.state.Docked {
			if w.svc.popout != nil {
				w.svc.popout.Hide()
			}
			return
		}
		if w.svc.popout != nil {
			h := snap.PopoutH
			if h < minNoteHeight {
				h = snap.H
			}
			if h < minNoteHeight {
				h = defaultWorkspaceHeight
			}
			x, y := snap.PopoutX, snap.PopoutY
			if x == 0 && y == 0 {
				def := w.defaultPopoutBounds()
				x, y = def.X, def.Y
				w.state.PopoutX, w.state.PopoutY = x, y
			}
			w.svc.popout.SetBounds(application.Rect{
				X: x, Y: y, Width: snap.SidebarW, Height: h,
			})
			w.svc.popout.Show()
		}
	})
	w.lastW, w.lastH = winW, snap.H
	w.saveMu.Lock()
	if w.saveTimer != nil {
		w.saveTimer.Stop()
		w.saveTimer = nil
	}
	w.saveMu.Unlock()
	if err := w.svc.store.SaveWorkspaceState(w.state); err != nil {
		log.Printf("[wread] apply layout save: %v", err)
	}
	w.syncPassThroughLayout()
	w.emitLayout()
	log.Printf("[wread] apply layout preset docked=%v place=%s %dx%d @ (%d,%d)",
		w.state.Docked, w.effectivePlace(), winW, snap.H, snap.X, snap.Y)
}

// SetCatalogWidth 同步目录侧栏宽度（0 表示收起），供穿透带几何使用。
func (w *Workspace) SetCatalogWidth(width int) {
	if width < 0 {
		width = 0
	}
	if width > 480 {
		width = 480
	}
	if w.catalogW == width {
		return
	}
	old := w.catalogW
	w.catalogW = width
	if w.svc.workspace != nil && w.state.Docked && w.effectivePlace() == "right" {
		delta := width - old
		if delta != 0 {
			b := w.svc.workspace.Bounds()
			w.withSync(func() {
				w.svc.workspace.SetBounds(application.Rect{
					X: b.X, Y: b.Y, Width: b.Width + delta, Height: b.Height,
				})
			})
			w.lastW = b.Width + delta
		}
	}
	w.syncPassThroughLayout()
}

// SetScopePanelVisible 同步阅读区显隐；隐藏时收拢窗口宽度并扩大穿透笔记区。
func (w *Workspace) SetScopePanelVisible(visible bool) {
	if w.scopePanelVisible == visible {
		return
	}
	wasVisible := w.scopePanelVisible
	w.scopePanelVisible = visible
	if w.svc.workspace != nil && w.state.Docked && !w.isVertical() {
		b := w.svc.workspace.Bounds()
		if !visible && wasVisible {
			scopeW := w.readerWidthFromBounds(b)
			if scopeW > 0 {
				w.state.ScopeW = scopeW
				newW := b.Width - scopeW
				minW := w.catalogColumnW() + minSidebarWidth
				if newW < minW {
					newW = minW
				}
				w.withSync(func() {
					w.svc.workspace.SetBounds(application.Rect{
						X: b.X, Y: b.Y, Width: newW, Height: b.Height,
					})
				})
				w.lastW = newW
			}
		} else if visible && !wasVisible {
			scopeW := w.state.ScopeW
			if scopeW < minScopeWidth {
				scopeW = minScopeWidth
			}
			w.withSync(func() {
				w.svc.workspace.SetBounds(application.Rect{
					X: b.X, Y: b.Y, Width: b.Width + scopeW, Height: b.Height,
				})
			})
			w.lastW = b.Width + scopeW
		}
		w.save()
	}
	w.syncPassThroughLayout()
}

// CatalogWidth 返回当前目录侧栏宽度（DIP）。
func (w *Workspace) CatalogWidth() int {
	return w.catalogW
}

// ApplyLayout 启动完成后应用布局与穿透区域。
func (w *Workspace) ApplyLayout() {
	if w.svc.workspace == nil {
		return
	}
	w.applyDockState(false)
	w.syncPassThroughLayout()
}

// BeginFrameDrag 窗口框/顶栏拖拽开始，暂停 SyncBounds 与穿透带刷新。
func (w *Workspace) BeginFrameDrag() {
	if w.svc.workspace == nil || w.frameLive {
		return
	}
	w.frameLive = true
	overlay.SetFrameDragging(true)
}

// ResizeWorkspace 拖拽边框缩放工作区窗口（单次 SetBounds，避免 IPC 风暴）。
func (w *Workspace) ResizeWorkspace(x, y, width, height int) {
	if w.svc.workspace == nil {
		return
	}
	if !w.frameLive {
		w.BeginFrameDrag()
	}
	w.withSync(func() {
		w.svc.workspace.SetBounds(application.Rect{
			X: x, Y: y, Width: width, Height: height,
		})
	})
}

// FinishWorkspaceResize 边框拖拽结束，同步穿透带并持久化。
func (w *Workspace) FinishWorkspaceResize() {
	w.frameLive = false
	overlay.SetFrameDragging(false)
	if w.svc.workspace == nil {
		return
	}
	w.SyncBounds()
	w.syncPassThroughLayout()
}

// SyncBounds 窗口移动或缩放后持久化。
func (w *Workspace) SyncBounds() {
	if w.syncing || w.frameLive || w.svc.workspace == nil {
		return
	}
	b := w.svc.workspace.Bounds()
	resized := b.Width != w.lastW || b.Height != w.lastH
	w.state.X, w.state.Y, w.state.H = b.X, b.Y, b.Height
	if w.state.Docked {
		if w.isVertical() {
			w.state.ScopeW = b.Width
		} else {
			sw := b.Width - w.state.SidebarW
			if w.effectivePlace() == "right" && w.catalogW > 0 {
				sw -= w.catalogW
			}
			if sw < 0 {
				sw = 0
			}
			w.state.ScopeW = sw
		}
	} else {
		w.state.ScopeW = b.Width
	}
	w.lastW, w.lastH = b.Width, b.Height
	w.save()
	if resized {
		w.syncPassThroughLayout()
	}
}

// SyncPopoutBounds 弹出笔记窗移动/缩放后持久化。
func (w *Workspace) SyncPopoutBounds() {
	if w.syncing || w.svc.popout == nil || w.state.Docked {
		return
	}
	b := w.svc.popout.Bounds()
	w.state.PopoutX, w.state.PopoutY = b.X, b.Y
	w.state.PopoutH = b.Height
	w.state.SidebarW = b.Width
	w.save()
}

// SetNotePlace 设置笔记停靠方位；popout 为独立窗口。
func (w *Workspace) SetNotePlace(place string) {
	place = normalizePlace(place)
	if place == "popout" {
		w.state.NotePlace = "popout"
		w.setDocked(false)
		return
	}
	if w.state.NotePlace == place && w.state.Docked {
		return
	}
	w.state.NotePlace = place
	if !w.state.Docked {
		w.state.Docked = true
	}
	w.save()
	w.applyDockState(true)
	w.emitLayout()
}

// setDocked 切换笔记内嵌或弹出。
func (w *Workspace) setDocked(docked bool) {
	if w.state.Docked == docked {
		return
	}
	if docked {
		if w.state.NotePlace == "popout" || w.state.NotePlace == "" {
			w.state.NotePlace = "right"
		}
	} else {
		w.state.NotePlace = "popout"
	}
	w.state.Docked = docked
	w.save()
	w.applyDockState(true)
	w.emitLayout()
}

// SetSidebarWidth 调整内嵌笔记栏宽度或高度（仅改内部分割，不缩放窗口）。
func (w *Workspace) SetSidebarWidth(size int) {
	if w.state.Docked && w.svc.workspace != nil {
		b := w.svc.workspace.Bounds()
		if w.isVertical() {
			if size < minNoteHeight {
				size = minNoteHeight
			}
			max := b.Height - minScopeWidth
			if max < minNoteHeight {
				max = minNoteHeight
			}
			if size > max {
				size = max
			}
		} else {
			if size < minSidebarWidth {
				size = minSidebarWidth
			}
			catW := w.catalogColumnW()
			max := b.Width - minScopeWidth - catW
			if max < minSidebarWidth {
				max = minSidebarWidth
			}
			if size > max {
				size = max
			}
			w.state.ScopeW = b.Width - size - catW
			if w.state.ScopeW < 0 {
				w.state.ScopeW = 0
			}
		}
	} else {
		if size < minSidebarWidth {
			size = minSidebarWidth
		}
	}
	if w.state.SidebarW == size {
		return
	}
	w.state.SidebarW = size
	w.save()
	w.syncPassThroughLayout()
	w.svc.emit("layout:sidebarW", size)
}

// readerWidthFromBounds 水平内嵌时开卷区宽度（扣除笔记栏与目录栏）。
func (w *Workspace) readerWidthFromBounds(b application.Rect) int {
	sw := b.Width - w.state.SidebarW - w.catalogColumnW()
	if sw < 0 {
		sw = 0
	}
	return sw
}

// catalogColumnW 内嵌 place-right 时目录栏占用宽度。
func (w *Workspace) catalogColumnW() int {
	if !w.state.Docked || w.effectivePlace() != "right" {
		return 0
	}
	return w.catalogW
}

// ScopeWidth 返回开卷区域宽度（DIP）。
func (w *Workspace) ScopeWidth() int {
	if w.svc.workspace == nil {
		if w.state.ScopeW > 0 {
			return w.state.ScopeW
		}
		return defaultScopeWidth
	}
	b := w.svc.workspace.Bounds()
	if w.isVertical() {
		return b.Width
	}
	if w.state.Docked {
		return w.readerWidthFromBounds(b)
	}
	return b.Width
}

func (w *Workspace) applyDockState(resizeWorkspace bool) {
	if w.svc.workspace == nil {
		return
	}
	w.withSync(func() {
		wb := w.svc.workspace.Bounds()
		if w.state.Docked {
			if resizeWorkspace {
				if w.isVertical() {
					w.svc.workspace.SetBounds(application.Rect{
						X: wb.X, Y: wb.Y,
						Width:  wb.Width,
						Height: w.windowWidth(),
					})
				} else {
					catW := w.catalogColumnW()
					scopeW := wb.Width
					// 从独立窗切回：当前窗宽即阅读区，需向右扩展笔记栏与目录栏。
					if wb.Width < w.state.SidebarW+catW+minScopeWidth {
						scopeW = wb.Width
					} else {
						scopeW = w.readerWidthFromBounds(wb)
					}
					if scopeW < minScopeWidth {
						scopeW = minScopeWidth
					}
					w.state.ScopeW = scopeW
					totalW := scopeW + w.state.SidebarW + catW
					w.svc.workspace.SetBounds(application.Rect{
						X: wb.X, Y: wb.Y, Width: totalW, Height: wb.Height,
					})
					w.lastW, w.lastH = totalW, wb.Height
				}
			}
			if w.svc.popout != nil {
				w.svc.popout.Hide()
			}
			return
		}
		w.state.ScopeW = wb.Width
		w.svc.workspace.SetBounds(application.Rect{
			X: wb.X, Y: wb.Y, Width: w.state.ScopeW, Height: wb.Height,
		})
		if w.svc.popout != nil {
			w.svc.popout.SetBounds(w.popoutBoundsFromState(wb))
			w.svc.popout.Show()
		}
	})
	w.save()
	w.syncPassThroughLayout()
}

func (w *Workspace) popoutBoundsFromState(wb application.Rect) application.Rect {
	h := w.popoutHeight()
	if h <= 0 {
		h = wb.Height
	}
	x, y := w.state.PopoutX, w.state.PopoutY
	if x == 0 && y == 0 {
		def := w.defaultPopoutBounds()
		x, y = def.X, def.Y
	}
	return application.Rect{
		X: x, Y: y, Width: w.state.SidebarW, Height: h,
	}
}

func (w *Workspace) defaultPopoutBounds() application.Rect {
	if w.svc.app == nil || w.svc.workspace == nil {
		return application.Rect{X: 120, Y: 120, Width: w.state.SidebarW, Height: 780}
	}
	wb := w.svc.workspace.Bounds()
	return application.Rect{
		X:      wb.X + wb.Width,
		Y:      wb.Y,
		Width:  w.state.SidebarW,
		Height: wb.Height,
	}
}

func (w *Workspace) syncPassThroughLayout() {
	if w.svc.workspace == nil {
		return
	}
	noteSz := 0
	catalogW := w.catalogColumnW()
	place := w.effectivePlace()
	scopeW := w.ScopeWidth()
	if w.state.Docked {
		if w.scopePanelVisible {
			noteSz = w.state.SidebarW
		} else {
			scopeW = 0
			b := w.svc.workspace.Bounds()
			noteSz = b.Width - catalogW
			if noteSz < 0 {
				noteSz = 0
			}
		}
	}
	overlay.SetLayout(scopeW, noteSz, catalogW, place)
}

func (w *Workspace) effectivePlace() string {
	if !w.state.Docked || w.state.NotePlace == "popout" {
		return "right"
	}
	p := w.state.NotePlace
	if p == "" {
		return "right"
	}
	return p
}

func (w *Workspace) isVertical() bool {
	if !w.state.Docked {
		return false
	}
	p := w.effectivePlace()
	return p == "top" || p == "bottom"
}

func (w *Workspace) windowWidth() int {
	if w.state.Docked && !w.isVertical() {
		return w.state.ScopeW + w.state.SidebarW + w.catalogColumnW()
	}
	return w.state.ScopeW
}

func (w *Workspace) popoutHeight() int {
	if w.state.PopoutH >= 480 {
		return w.state.PopoutH
	}
	if w.state.H >= 480 {
		return w.state.H
	}
	return 780
}

func (w *Workspace) emitLayout() {
	w.svc.emit("layout:docked", w.state.Docked)
	w.svc.emit("layout:sidebarW", w.state.SidebarW)
	w.svc.emit("layout:notePlace", w.effectivePlace())
}

func (w *Workspace) withSync(fn func()) {
	w.syncing = true
	defer func() { w.syncing = false }()
	application.InvokeSync(fn)
}

func (w *Workspace) save() {
	w.saveMu.Lock()
	defer w.saveMu.Unlock()
	if w.saveTimer != nil {
		w.saveTimer.Stop()
	}
	w.saveTimer = time.AfterFunc(400*time.Millisecond, func() {
		if err := w.svc.store.SaveWorkspaceState(w.state); err != nil {
			log.Printf("[wread] save workspace: %v", err)
		}
	})
}

func normalizePlace(place string) string {
	switch strings.ToLower(strings.TrimSpace(place)) {
	case "left", "top", "bottom", "center", "popout":
		return strings.ToLower(strings.TrimSpace(place))
	default:
		return "right"
	}
}

func normalizeWorkspace(st model.WorkspaceStateDO) model.WorkspaceStateDO {
	if st.ScopeW < minScopeWidth {
		st.ScopeW = defaultScopeWidth
	}
	if st.SidebarW < minSidebarWidth {
		st.SidebarW = defaultSidebarWidth
	}
	if st.H < 180 {
		st.H = defaultWorkspaceHeight
	}
	if st.X == 0 && st.Y == 0 {
		st.X, st.Y = 120, 120
	}
	if st.NotePlace == "" {
		if st.Docked {
			st.NotePlace = "right"
		} else {
			st.NotePlace = "popout"
		}
	}
	if !st.Docked {
		st.NotePlace = "popout"
	}
	return st
}

func normalizeLayoutSnapshot(snap model.WindowLayoutSnapshotDO) model.WindowLayoutSnapshotDO {
	if snap.ScopeW < minScopeWidth {
		snap.ScopeW = defaultScopeWidth
	}
	if snap.SidebarW < minSidebarWidth {
		snap.SidebarW = defaultSidebarWidth
	}
	if snap.H < 180 {
		snap.H = defaultWorkspaceHeight
	}
	snap.NotePlace = normalizePlace(snap.NotePlace)
	if snap.Docked && snap.NotePlace == "popout" {
		snap.NotePlace = "right"
	}
	if !snap.Docked {
		snap.NotePlace = "popout"
	}
	return snap
}

func layoutSnapshotWindowWidth(snap model.WindowLayoutSnapshotDO) int {
	if snap.Docked && snap.NotePlace != "top" && snap.NotePlace != "bottom" {
		return snap.ScopeW + snap.SidebarW
	}
	return snap.ScopeW
}
