//go:build !darwin

package ocr

import (
	"context"
	"fmt"
)

// ExtractText 从 PNG 图片提取文字。
func ExtractText(_ context.Context, _ []byte) (string, error) {
	return "", fmt.Errorf("当前平台暂不支持 OCR，请使用 macOS")
}

// Warmup 预编译 OCR 脚本。
func Warmup() {}
