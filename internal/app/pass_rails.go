package app

import (
	"log"

	"wread/internal/overlay"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// RegisterPassThroughRails 注册阅读模式内缘竖条原生点击（解读 / 笔记本 / 目录）。
func RegisterPassThroughRails(s *Service) {
	overlay.SetReaderRailClick(func() {
		_ = s.InterpretNow(s.DefaultRegion())
	})
	overlay.SetNoteRailClick(s.handleNoteRailClick)
}

// handleNoteRailClick 笔记内缘条 → 前端 layout 切换事件。
func (s *Service) handleNoteRailClick(action overlay.NoteRailAction) {
	if s.app == nil {
		return
	}
	application.InvokeSync(func() {
		switch action {
		case overlay.NoteRailNotebook:
			s.emit("layout:notebookListToggle", true)
			log.Printf("[wread] note rail → notebook")
		case overlay.NoteRailCatalog:
			s.emit("layout:catalogToggle", true)
			log.Printf("[wread] note rail → catalog")
		}
	})
}
