package overlay

import (
	"log"
	"sync"

	"github.com/wailsapp/wails/v3/pkg/application"
)

var (
	layoutMu     sync.Mutex
	layoutScopeW int
	layoutNoteSz int
	layoutPlace  string
)

// SetLayout 更新开卷/笔记区域与停靠方位，供穿透判定使用。
func SetLayout(scopeW, noteSize int, place string) {
	layoutMu.Lock()
	layoutScopeW = scopeW
	layoutNoteSz = noteSize
	layoutPlace = place
	layoutMu.Unlock()
	application.InvokeSync(func() {
		setNativePassThroughLayout(scopeW, noteSize, place)
	})
}

func currentLayout() (scopeW, noteSize int, place string) {
	layoutMu.Lock()
	defer layoutMu.Unlock()
	return layoutScopeW, layoutNoteSz, layoutPlace
}

// ApplyPassThrough 阅读模式保持框选层可见并穿透点击；调整模式恢复交互。
func ApplyPassThrough(w application.Window, readMode bool) {
	if w == nil {
		return
	}
	scopeW, noteSz, place := currentLayout()
	application.InvokeSync(func() {
		applyPassThroughMain(w, readMode, scopeW, noteSz, place)
	})
}

func applyPassThroughMain(w application.Window, readMode bool, scopeW, noteSz int, place string) {
	w.Show()
	setNativePassThroughLayout(scopeW, noteSz, place)
	if readMode {
		w.SetIgnoreMouseEvents(false)
		setNativePassThrough(w.NativeWindow(), true)
		log.Printf("[wread] read mode: scope=%d note=%d place=%s", scopeW, noteSz, place)
		return
	}
	setNativePassThrough(w.NativeWindow(), false)
	w.SetIgnoreMouseEvents(false)
}
