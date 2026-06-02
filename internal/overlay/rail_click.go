package overlay

import (
	"sync"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// NoteRailAction 笔记内缘竖条按钮。
type NoteRailAction int

const (
	NoteRailNotebook NoteRailAction = 1
	NoteRailCatalog  NoteRailAction = 2
)

var (
	railClickMu   sync.Mutex
	readerRailClick func()
	noteRailClick   func(NoteRailAction)
)

// SetReaderRailClick 注册阅读器内缘「解读」点击（由 pass_darwin 在穿透模式下触发）。
func SetReaderRailClick(fn func()) {
	railClickMu.Lock()
	readerRailClick = fn
	railClickMu.Unlock()
}

// SetNoteRailClick 注册笔记内缘「笔记本 / 目录」点击。
func SetNoteRailClick(fn func(NoteRailAction)) {
	railClickMu.Lock()
	noteRailClick = fn
	railClickMu.Unlock()
}

func invokeReaderRailClick() {
	railClickMu.Lock()
	fn := readerRailClick
	railClickMu.Unlock()
	if fn == nil {
		return
	}
	application.InvokeSync(fn)
}

func invokeNoteRailClick(action NoteRailAction) {
	railClickMu.Lock()
	fn := noteRailClick
	railClickMu.Unlock()
	if fn == nil || (action != NoteRailNotebook && action != NoteRailCatalog) {
		return
	}
	application.InvokeSync(func() {
		fn(action)
	})
}
