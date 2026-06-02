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
	defaultScopeWidth   = 640
	defaultSidebarWidth = 480
	minScopeWidth       = 240
	minSidebarWidth     = 420
	minNoteHeight       = 200
)

// Workspace 单窗口开卷+笔记布局与弹出笔记窗管理。
type Workspace struct {
	svc       *Service
	state     model.WorkspaceStateDO
	syncing   bool
	saveMu    sync.Mutex
	saveTimer *time.Timer
}

// NewWorkspace 创建工作区控制器。
func NewWorkspace(svc *Service, st model.WorkspaceStateDO) *Workspace {
	st = normalizeWorkspace(st)
	return &Workspace{svc: svc, state: st}
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

// ApplyLayout 启动完成后应用布局与穿透区域。
func (w *Workspace) ApplyLayout() {
	if w.svc.workspace == nil {
		return
	}
	w.applyDockState(false)
	w.syncPassThroughLayout()
}

// SyncBounds 窗口移动或缩放后持久化。
func (w *Workspace) SyncBounds() {
	if w.syncing || w.svc.workspace == nil {
		return
	}
	b := w.svc.workspace.Bounds()
	w.state.X, w.state.Y, w.state.H = b.X, b.Y, b.Height
	if w.state.Docked {
		if w.isVertical() {
			w.state.ScopeW = b.Width
		} else {
			w.state.ScopeW = b.Width - w.state.SidebarW
			if w.state.ScopeW < minScopeWidth {
				w.state.ScopeW = minScopeWidth
			}
		}
	} else {
		w.state.ScopeW = b.Width
	}
	w.save()
	w.syncPassThroughLayout()
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
			max := b.Width - minScopeWidth
			if max < minSidebarWidth {
				max = minSidebarWidth
			}
			if size > max {
				size = max
			}
			w.state.ScopeW = b.Width - size
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
		sw := b.Width - w.state.SidebarW
		if sw >= minScopeWidth {
			return sw
		}
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
				w.svc.workspace.SetBounds(application.Rect{
					X: wb.X, Y: wb.Y,
					Width:  w.windowWidth(),
					Height: wb.Height,
				})
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
	place := w.effectivePlace()
	if w.state.Docked {
		noteSz = w.state.SidebarW
	}
	overlay.SetLayout(w.ScopeWidth(), noteSz, place)
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
		return w.state.ScopeW + w.state.SidebarW
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
		st.H = 480
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
