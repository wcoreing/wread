//go:build !darwin

package capture

import "github.com/wailsapp/wails/v3/pkg/application"

// ScreenRect 将 Wails DIP 坐标转为截屏物理像素坐标。
func ScreenRect(dip application.Rect) application.Rect {
	return application.DipToPhysicalRect(dip)
}
