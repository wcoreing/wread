//go:build darwin

package capture

import "github.com/wailsapp/wails/v3/pkg/application"

// ScreenRect 将 Wails 窗口坐标转为截屏库使用的屏幕坐标。
// macOS 上 Wails Bounds 与 kbinani/screenshot 均使用逻辑点，不可再乘 Retina 倍率。
func ScreenRect(dip application.Rect) application.Rect {
	return dip
}
