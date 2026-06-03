package store

// GetSnapKeepCapture 解读时是否保留截屏到每一页。
func (s *Store) GetSnapKeepCapture() bool {
	return s.getSetting("snap.keep_capture") == "1"
}

// SetSnapKeepCapture 切换解读截屏保留。
func (s *Store) SetSnapKeepCapture(on bool) error {
	v := "0"
	if on {
		v = "1"
	}
	return s.setSetting("snap.keep_capture", v)
}
