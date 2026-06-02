//go:build !darwin

package capture

import (
	"fmt"
	"unsafe"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// SupportsBelowWindowCapture 非 macOS 需隐藏窗口后截屏。
func SupportsBelowWindowCapture() bool {
	return false
}

// CaptureReadingArea 回退为普通全屏截取（调用方需先隐藏 overlay）。
func CaptureReadingArea(rect application.Rect, _ unsafe.Pointer, _ ...unsafe.Pointer) ([]byte, error) {
	if rect.Width <= 0 || rect.Height <= 0 {
		return nil, fmt.Errorf("截屏区域无效")
	}
	return CaptureRect(rect)
}
