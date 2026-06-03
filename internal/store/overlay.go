package store

import "strings"

const (
	scopeModeOp   = "op"
	scopeModeRead = "read"
	scopeModeNote = "note"
)

// NormalizeScopeMode 规范化阅读器模式：op | read | note。
func NormalizeScopeMode(mode string) string {
	switch strings.TrimSpace(mode) {
	case scopeModeRead, scopeModeNote:
		return strings.TrimSpace(mode)
	default:
		return scopeModeOp
	}
}

// GetScopeMode 读取阅读器模式。
func (s *Store) GetScopeMode() string {
	if v := s.getSetting("overlay.scope_mode"); v != "" {
		return NormalizeScopeMode(v)
	}
	if s.getSetting("overlay.reading_mode") == "1" {
		return scopeModeRead
	}
	return scopeModeOp
}

// SetScopeMode 保存阅读器模式。
func (s *Store) SetScopeMode(mode string) error {
	mode = NormalizeScopeMode(mode)
	return s.setSetting("overlay.scope_mode", mode)
}
