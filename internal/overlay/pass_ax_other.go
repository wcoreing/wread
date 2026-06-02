//go:build !darwin

package overlay

// AccessibilityTrusted 非 macOS 无穿透 Post。
func AccessibilityTrusted() bool {
	return true
}
