package store

import "wread/internal/model"

// GetReadSettings 读取伴读行为设置。
func (s *Store) GetReadSettings() model.ReadSettingsDO {
	v := s.getSetting("read.continuous")
	if v == "" {
		return model.ReadSettingsDO{ContinuousRead: false}
	}
	return model.ReadSettingsDO{ContinuousRead: v == "1"}
}

// SetContinuousRead 切换连续伴读。
func (s *Store) SetContinuousRead(on bool) error {
	v := "0"
	if on {
		v = "1"
	}
	return s.setSetting("read.continuous", v)
}
