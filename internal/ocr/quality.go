//go:build darwin

package ocr

import (
	"strings"
	"unicode"
)

// junkMarkers 常见于 IDE / 终端 / 构建日志的片段。
var junkMarkers = []string{
	"vite", "wails3", "wails v", "task:", "npm run", "npm fund",
	"problems", "go build", "gcflags", "build info", "buildvcs",
	"frontend dev server", "connected to frontend", "darwin:run",
	"codesign", "exit code", "package-lock", "node_modules",
	"readme.md", "taskfile.yml", "version.go", "replacing existing signature",
	"local: http://", "strictport", "dev server", "compiler=gc",
	"new agent", "maximize chat", "open browser",
}

// JunkReason 判断 OCR 是否像截到了开发环境；非空表示应中止 AI 解读。
func JunkReason(text string) string {
	trimmed := strings.TrimSpace(text)
	if trimmed == "" {
		return "未识别到文字，请调整框选区域"
	}

	lower := strings.ToLower(trimmed)
	hits := 0
	var samples []string
	for _, marker := range junkMarkers {
		if strings.Contains(lower, marker) {
			hits++
			if len(samples) < 3 {
				samples = append(samples, marker)
			}
		}
	}
	if hits >= 2 {
		return "识别内容像 IDE/终端日志（" + strings.Join(samples, "、") + "），请调整框选对准书籍正文"
	}
	if hits == 1 && cjkRatio(trimmed) < 0.08 {
		return "识别内容不像书籍正文，可能截到了编辑器或终端，请重新框选"
	}
	if cjkRatio(trimmed) < 0.03 && letterRatio(trimmed) > 0.5 {
		return "识别内容几乎全是英文符号/日志，请调整框选对准中文正文"
	}
	return ""
}

func cjkRatio(text string) float64 {
	var cjk, total float64
	for _, r := range text {
		if unicode.IsSpace(r) {
			continue
		}
		total++
		if unicode.Is(unicode.Han, r) {
			cjk++
		}
	}
	if total == 0 {
		return 0
	}
	return cjk / total
}

func letterRatio(text string) float64 {
	var letters, total float64
	for _, r := range text {
		if unicode.IsSpace(r) {
			continue
		}
		total++
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') {
			letters++
		}
	}
	if total == 0 {
		return 0
	}
	return letters / total
}
