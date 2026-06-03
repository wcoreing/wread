package store

import (
	"encoding/json"
	"strconv"
	"strings"

	"wread/internal/model"
)

const (
	pillPosXKey = "pill.x"
	pillPosYKey = "pill.y"
)

// GetPillPosition 读取 Pill 上次屏幕位置；未保存时返回 0,0。
func (s *Store) GetPillPosition() model.PillPositionDO {
	x, _ := strconv.Atoi(strings.TrimSpace(s.getSetting(pillPosXKey)))
	y, _ := strconv.Atoi(strings.TrimSpace(s.getSetting(pillPosYKey)))
	return model.PillPositionDO{X: x, Y: y}
}

// SavePillPosition 持久化 Pill 屏幕位置。
func (s *Store) SavePillPosition(x, y int) error {
	if err := s.setSetting(pillPosXKey, strconv.Itoa(x)); err != nil {
		return err
	}
	return s.setSetting(pillPosYKey, strconv.Itoa(y))
}

// GetPillRestoreSnapshot 读取上次收起时的窗口快照（跨重启恢复 Pill 模式用）。
func (s *Store) GetPillRestoreSnapshot() (model.PillRestoreSnapshotDO, bool) {
	raw := strings.TrimSpace(s.getSetting("pill.restore"))
	if raw == "" {
		return model.PillRestoreSnapshotDO{}, false
	}
	var snap model.PillRestoreSnapshotDO
	if err := json.Unmarshal([]byte(raw), &snap); err != nil {
		return model.PillRestoreSnapshotDO{}, false
	}
	return snap, true
}

// SavePillRestoreSnapshot 保存收起快照；active 为 false 时清除。
func (s *Store) SavePillRestoreSnapshot(snap model.PillRestoreSnapshotDO, active bool) error {
	if !active {
		return s.setSetting("pill.restore", "")
	}
	raw, err := json.Marshal(snap)
	if err != nil {
		return err
	}
	return s.setSetting("pill.restore", string(raw))
}
