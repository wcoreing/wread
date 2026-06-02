package store

import (
	"encoding/json"
	"fmt"
	"strings"

	"wread/internal/model"

	"github.com/google/uuid"
)

const builtinDefaultLayoutPresetID = "builtin-default"

// BuiltinDefaultLayoutPresetID 返回内置默认布局预设 ID。
func BuiltinDefaultLayoutPresetID() string {
	return builtinDefaultLayoutPresetID
}

// GetWindowLayoutPresets 读取窗口布局预设。
func (s *Store) GetWindowLayoutPresets() model.WindowLayoutPresetsDO {
	raw := s.getSetting("window.layoutPresets")
	if raw == "" {
		def := defaultWindowLayoutPresets()
		_ = s.saveWindowLayoutPresets(def)
		return def
	}
	var st model.WindowLayoutPresetsDO
	if err := json.Unmarshal([]byte(raw), &st); err != nil || len(st.Presets) == 0 {
		def := defaultWindowLayoutPresets()
		_ = s.saveWindowLayoutPresets(def)
		return def
	}
	if !layoutPresetHasID(st.Presets, st.ActiveID) {
		st.ActiveID = st.Presets[0].ID
		_ = s.saveWindowLayoutPresets(st)
	}
	return st
}

// SaveWindowLayoutPreset 新建或更新布局预设；FromCurrent 为 true 时用当前窗口快照覆盖 layout。
func (s *Store) SaveWindowLayoutPreset(in model.WindowLayoutPresetSaveDO, snap model.WindowLayoutSnapshotDO) (model.WindowLayoutPresetDO, error) {
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return model.WindowLayoutPresetDO{}, fmt.Errorf("请填写预设名称")
	}
	st := s.GetWindowLayoutPresets()
	id := strings.TrimSpace(in.ID)
	if id == "" {
		id = uuid.NewString()
		preset := model.WindowLayoutPresetDO{ID: id, Name: name, Layout: snap}
		st.Presets = append(st.Presets, preset)
		st.ActiveID = id
		if err := s.saveWindowLayoutPresets(st); err != nil {
			return model.WindowLayoutPresetDO{}, err
		}
		return preset, nil
	}
	for i, preset := range st.Presets {
		if preset.ID != id {
			continue
		}
		st.Presets[i].Name = name
		if in.FromCurrent {
			st.Presets[i].Layout = snap
		}
		if err := s.saveWindowLayoutPresets(st); err != nil {
			return model.WindowLayoutPresetDO{}, err
		}
		return st.Presets[i], nil
	}
	return model.WindowLayoutPresetDO{}, fmt.Errorf("布局预设不存在")
}

// DeleteWindowLayoutPreset 删除布局预设。
func (s *Store) DeleteWindowLayoutPreset(id string) error {
	id = strings.TrimSpace(id)
	if id == builtinDefaultLayoutPresetID {
		return fmt.Errorf("默认预设不可删除")
	}
	st := s.GetWindowLayoutPresets()
	next := make([]model.WindowLayoutPresetDO, 0, len(st.Presets)-1)
	found := false
	for _, preset := range st.Presets {
		if preset.ID == id {
			found = true
			continue
		}
		next = append(next, preset)
	}
	if !found {
		return fmt.Errorf("布局预设不存在")
	}
	if len(next) == 0 {
		return fmt.Errorf("至少保留一个布局预设")
	}
	st.Presets = next
	if st.ActiveID == id {
		st.ActiveID = next[0].ID
	}
	return s.saveWindowLayoutPresets(st)
}

// SetActiveWindowLayoutPreset 记录当前选中的布局预设。
func (s *Store) SetActiveWindowLayoutPreset(id string) error {
	id = strings.TrimSpace(id)
	st := s.GetWindowLayoutPresets()
	if !layoutPresetHasID(st.Presets, id) {
		return fmt.Errorf("布局预设不存在")
	}
	st.ActiveID = id
	return s.saveWindowLayoutPresets(st)
}

// GetWindowLayoutPreset 按 ID 读取布局预设。
func (s *Store) GetWindowLayoutPreset(id string) (model.WindowLayoutPresetDO, error) {
	id = strings.TrimSpace(id)
	st := s.GetWindowLayoutPresets()
	for _, preset := range st.Presets {
		if preset.ID == id {
			return preset, nil
		}
	}
	return model.WindowLayoutPresetDO{}, fmt.Errorf("布局预设不存在")
}

func defaultWindowLayoutPresets() model.WindowLayoutPresetsDO {
	return model.WindowLayoutPresetsDO{
		ActiveID: builtinDefaultLayoutPresetID,
		Presets: []model.WindowLayoutPresetDO{{
			ID:     builtinDefaultLayoutPresetID,
			Name:   "默认",
			Layout: DefaultWindowLayoutSnapshot(),
		}},
	}
}

// DefaultWindowLayoutSnapshot 返回默认窗口布局快照。
func DefaultWindowLayoutSnapshot() model.WindowLayoutSnapshotDO {
	return model.WindowLayoutSnapshotDO{
		X: 120, Y: 120, H: 780,
		ScopeW: 640, SidebarW: 480,
		Docked: true, NotePlace: "right",
	}
}

func (s *Store) saveWindowLayoutPresets(st model.WindowLayoutPresetsDO) error {
	raw, err := json.Marshal(st)
	if err != nil {
		return err
	}
	return s.setSetting("window.layoutPresets", string(raw))
}

func layoutPresetHasID(presets []model.WindowLayoutPresetDO, id string) bool {
	for _, preset := range presets {
		if preset.ID == id {
			return true
		}
	}
	return false
}
