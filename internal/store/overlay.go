package store

// GetReadingMode 开卷是否处于阅读穿透模式。
func (s *Store) GetReadingMode() bool {
	return s.getSetting("overlay.reading_mode") == "1"
}

// SetReadingMode 保存阅读穿透模式。
func (s *Store) SetReadingMode(on bool) error {
	v := "0"
	if on {
		v = "1"
	}
	return s.setSetting("overlay.reading_mode", v)
}
