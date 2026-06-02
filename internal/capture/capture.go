package capture

import (
	"bytes"
	"fmt"
	"image"
	"image/png"

	"github.com/kbinani/screenshot"
	"github.com/wailsapp/wails/v3/pkg/application"
)

// CaptureRect 截取屏幕物理像素区域。
func CaptureRect(rect application.Rect) ([]byte, error) {
	if rect.Width <= 0 || rect.Height <= 0 {
		return nil, fmt.Errorf("截屏区域无效")
	}
	n := screenshot.NumActiveDisplays()
	if n <= 0 {
		return nil, fmt.Errorf("未检测到可用显示器")
	}

	bounds := screenshot.GetDisplayBounds(0)
	for i := 0; i < n; i++ {
		b := screenshot.GetDisplayBounds(i)
		if rect.X >= b.Min.X && rect.Y >= b.Min.Y &&
			rect.X+rect.Width <= b.Max.X && rect.Y+rect.Height <= b.Max.Y {
			bounds = b
			break
		}
	}

	x := rect.X - bounds.Min.X
	y := rect.Y - bounds.Min.Y
	if x < 0 || y < 0 {
		return nil, fmt.Errorf("截屏坐标超出显示器范围")
	}

	img, err := screenshot.CaptureRect(image.Rect(x, y, x+rect.Width, y+rect.Height))
	if err != nil {
		return nil, fmt.Errorf("截屏失败: %w", err)
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return nil, fmt.Errorf("编码 PNG 失败: %w", err)
	}
	return buf.Bytes(), nil
}
