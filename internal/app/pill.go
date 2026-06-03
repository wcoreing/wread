package app

import (
	"log"
	"strings"

	"wread/internal/model"

	"github.com/wailsapp/wails/v3/pkg/application"
)

const pillSize = 52

// MinimizeToPill 收起主窗/弹出窗，显示悬浮 Pill。
func (s *Service) MinimizeToPill(noteMenu string) error {
	if s.pill == nil {
		return errPillUnavailable
	}
	menu := strings.TrimSpace(noteMenu)
	if menu != "settings" {
		menu = "note"
	}
	snap := model.PillRestoreSnapshotDO{
		WorkspaceVisible: s.windowVisible(s.workspace),
		PopoutVisible:    s.windowVisible(s.popout),
		NoteMenu:         menu,
	}
	if err := s.store.SavePillRestoreSnapshot(snap, true); err != nil {
		return err
	}
	s.pillSnapshot = snap

	application.InvokeSync(func() {
		if s.workspace != nil {
			s.workspace.Hide()
		}
		if s.popout != nil {
			s.popout.Hide()
		}
		s.placePillWindow()
		s.pill.Show().Focus()
	})
	log.Printf("pill: minimized workspace=%v popout=%v noteMenu=%s", snap.WorkspaceVisible, snap.PopoutVisible, menu)
	return nil
}

// RestoreFromPill 从 Pill 恢复上次窗口状态。
func (s *Service) RestoreFromPill() error {
	if s.pill == nil {
		return errPillUnavailable
	}
	snap := s.pillSnapshot
	if !snap.WorkspaceVisible && !snap.PopoutVisible {
		if stored, ok := s.store.GetPillRestoreSnapshot(); ok {
			snap = stored
		}
	}
	if !snap.WorkspaceVisible && !snap.PopoutVisible {
		snap.WorkspaceVisible = true
	}

	application.InvokeSync(func() {
		if s.pill != nil {
			s.pill.Hide()
		}
		if snap.WorkspaceVisible && s.workspace != nil {
			s.workspace.Show()
		}
		if snap.PopoutVisible && s.popout != nil {
			s.popout.Show()
		}
		if snap.PopoutVisible && s.popout != nil {
			s.popout.Focus()
		} else if snap.WorkspaceVisible && s.workspace != nil {
			s.workspace.Focus()
		}
	})
	_ = s.store.SavePillRestoreSnapshot(model.PillRestoreSnapshotDO{}, false)
	s.pillSnapshot = model.PillRestoreSnapshotDO{}
	s.applyOverlayMouseMode()
	s.emit("pill:restored", snap.NoteMenu)
	log.Printf("pill: restored workspace=%v popout=%v noteMenu=%s", snap.WorkspaceVisible, snap.PopoutVisible, snap.NoteMenu)
	return nil
}

// SavePillPosition 持久化 Pill 屏幕坐标。
func (s *Service) SavePillPosition(x, y int) error {
	return s.store.SavePillPosition(x, y)
}

// GetPillPosition 读取 Pill 屏幕坐标。
func (s *Service) GetPillPosition() model.PillPositionDO {
	return s.store.GetPillPosition()
}

// IsPillMode 当前是否处于 Pill 收起态。
func (s *Service) IsPillMode() bool {
	return s.pill != nil && s.windowVisible(s.pill)
}

func (s *Service) windowVisible(w application.Window) bool {
	if w == nil {
		return false
	}
	visible := false
	application.InvokeSync(func() {
		visible = w.IsVisible()
	})
	return visible
}

// placePillWindow 将 Pill 放到已保存或默认位置。
func (s *Service) placePillWindow() {
	if s.pill == nil {
		return
	}
	pos := s.store.GetPillPosition()
	x, y := pos.X, pos.Y
	if x <= 0 && y <= 0 {
		x, y = s.defaultPillPosition()
	}
	s.pill.SetPosition(x, y)
}

func (s *Service) defaultPillPosition() (int, int) {
	if s.workspace != nil {
		b := s.workspace.Bounds()
		if b.Width > 0 && b.Height > 0 {
			return b.X + b.Width - pillSize - 20, b.Y + b.Height - pillSize - 20
		}
	}
	return 80, 80
}

// RestorePillModeIfNeeded 启动时若上次为 Pill 模式则恢复收起态。
func (s *Service) RestorePillModeIfNeeded() {
	snap, ok := s.store.GetPillRestoreSnapshot()
	if !ok || s.pill == nil {
		return
	}
	s.pillSnapshot = snap
	application.InvokeSync(func() {
		if s.workspace != nil {
			s.workspace.Hide()
		}
		if s.popout != nil {
			s.popout.Hide()
		}
		s.placePillWindow()
		s.pill.Show()
	})
	log.Printf("pill: restored startup mode workspace=%v popout=%v", snap.WorkspaceVisible, snap.PopoutVisible)
}
