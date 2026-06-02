//go:build !darwin

package ocr

// JunkReason 非 macOS 平台暂不校验。
func JunkReason(_ string) string {
	return ""
}
