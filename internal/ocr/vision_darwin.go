//go:build darwin

package ocr

/*
#cgo darwin CFLAGS: -x objective-c -mmacosx-version-min=12.0
#cgo darwin LDFLAGS: -mmacosx-version-min=12.0 -framework Vision -framework Foundation -framework ImageIO -framework CoreGraphics

#include <stdlib.h>
#include "vision_ocr.h"
*/
import "C"
import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"
	"unsafe"
)

// ExtractText 从 PNG 图片提取文字（macOS Vision）。
func ExtractText(ctx context.Context, img []byte) (string, error) {
	if len(img) == 0 {
		return "", fmt.Errorf("图片为空")
	}
	if ctx == nil {
		ctx = context.Background()
	}

	tmp, err := os.CreateTemp("", "wread-cap-*.png")
	if err != nil {
		return "", err
	}
	tmpPath := tmp.Name()
	defer os.Remove(tmpPath)
	if _, err := tmp.Write(img); err != nil {
		_ = tmp.Close()
		return "", err
	}
	_ = tmp.Close()

	ocrCtx, cancel := context.WithTimeout(ctx, 90*time.Second)
	defer cancel()

	type ocrResult struct {
		text string
		err  error
	}
	done := make(chan ocrResult, 1)
	go func() {
		cPath := C.CString(tmpPath)
		defer C.free(unsafe.Pointer(cPath))

		var cErr *C.char
		cText := C.wread_ocr_from_path(cPath, &cErr)
		if cText == nil {
			msg := "OCR 失败"
			if cErr != nil {
				msg = C.GoString(cErr)
				C.wread_ocr_free(cErr)
			}
			switch msg {
			case "no text":
				done <- ocrResult{err: fmt.Errorf("未识别到文字，请调整框选区域")}
			case "invalid image":
				done <- ocrResult{err: fmt.Errorf("截图无效，请重试")}
			default:
				done <- ocrResult{err: fmt.Errorf("OCR 失败: %s", msg)}
			}
			return
		}
		defer C.wread_ocr_free(cText)
		done <- ocrResult{text: strings.TrimSpace(C.GoString(cText))}
	}()

	select {
	case <-ocrCtx.Done():
		return "", fmt.Errorf("OCR 超时，请重试")
	case res := <-done:
		if res.err != nil {
			return "", res.err
		}
		if res.text == "" {
			return "", fmt.Errorf("未识别到文字，请调整框选区域")
		}
		return res.text, nil
	}
}

// Warmup 预加载 OCR 运行时（CGO 已在进程内链接，无需额外预热）。
func Warmup() {}
