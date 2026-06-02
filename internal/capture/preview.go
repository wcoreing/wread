package capture

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"image"
	_ "image/png"
	"image/png"
)

// PreviewDataURL 生成截屏预览 data URL，宽度超过 maxWidth 时等比缩小。
func PreviewDataURL(img []byte, maxWidth int) (string, error) {
	if len(img) == 0 {
		return "", fmt.Errorf("截屏为空")
	}
	if maxWidth <= 0 {
		maxWidth = 480
	}

	src, _, err := image.Decode(bytes.NewReader(img))
	if err != nil {
		return "", fmt.Errorf("解码截屏失败: %w", err)
	}
	bounds := src.Bounds()
	w, h := bounds.Dx(), bounds.Dy()
	if w <= 0 || h <= 0 {
		return "", fmt.Errorf("截屏尺寸无效")
	}
	if w > maxWidth {
		h = h * maxWidth / w
		w = maxWidth
		src = resizeNearest(src, w, h)
	}

	var buf bytes.Buffer
	if err := png.Encode(&buf, src); err != nil {
		return "", fmt.Errorf("编码预览失败: %w", err)
	}
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(buf.Bytes()), nil
}

func resizeNearest(src image.Image, w, h int) image.Image {
	dst := image.NewRGBA(image.Rect(0, 0, w, h))
	sb := src.Bounds()
	sw, sh := sb.Dx(), sb.Dy()
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			sx := sb.Min.X + x*sw/w
			sy := sb.Min.Y + y*sh/h
			dst.Set(x, y, src.At(sx, sy))
		}
	}
	return dst
}
