package overlay

import (
	"log"
	"sync"

	"github.com/wailsapp/wails/v3/pkg/application"
)

var (
	layoutMu      sync.Mutex
	layoutScopeW  int
	layoutNoteSz  int
	layoutCatalog int
	layoutPlace   string
)

// SetLayout 更新开卷/笔记/目录区域与停靠方位，供穿透带几何使用。
func SetLayout(scopeW, noteSize, catalogW int, place string) {
	layoutMu.Lock()
	if layoutScopeW == scopeW && layoutNoteSz == noteSize && layoutCatalog == catalogW && layoutPlace == place {
		layoutMu.Unlock()
		return
	}
	layoutScopeW = scopeW
	layoutNoteSz = noteSize
	layoutCatalog = catalogW
	layoutPlace = place
	layoutMu.Unlock()
	application.InvokeSync(func() {
		syncNativePassMetrics()
		setNativePassThroughLayout(scopeW, noteSize, catalogW, place)
	})
}

// SetFrameDragging 边框缩放过程中暂停穿透带刷新，避免抖动。
func SetFrameDragging(dragging bool) {
	application.InvokeSync(func() {
		setNativeFrameDragging(dragging)
	})
}

func currentLayout() (scopeW, noteSize, catalogW int, place string) {
	layoutMu.Lock()
	defer layoutMu.Unlock()
	return layoutScopeW, layoutNoteSz, layoutCatalog, layoutPlace
}

// ApplyPassThrough 阅读模式保持框选层可见并穿透点击；调整模式恢复交互。
func ApplyPassThrough(w application.Window, readMode bool) {
	if w == nil {
		return
	}
	scopeW, noteSz, catalogW, place := currentLayout()
	application.InvokeSync(func() {
		applyPassThroughMain(w, readMode, scopeW, noteSz, catalogW, place)
	})
}

func applyPassThroughMain(w application.Window, readMode bool, scopeW, noteSz, catalogW int, place string) {
	w.Show()
	syncNativePassMetrics()
	setNativePassThroughLayout(scopeW, noteSz, catalogW, place)
	if readMode {
		w.SetIgnoreMouseEvents(false)
		setNativePassThrough(w.NativeWindow(), true)
		if !AccessibilityTrusted() {
			log.Printf("[wread] 阅读穿透: 请在 系统设置→隐私与安全性→辅助功能 中允许 Wread")
		}
		log.Printf("[wread] read mode band-only: scope=%d note=%d catalog=%d place=%s ax=%v",
			scopeW, noteSz, catalogW, place, AccessibilityTrusted())
		return
	}
	setNativePassThrough(w.NativeWindow(), false)
	w.SetIgnoreMouseEvents(false)
}

// TurnPage 在阅读穿透带翻页侧 Post 左键，模拟用户点击下层阅读器翻页。
func TurnPage(w application.Window) bool {
	if w == nil {
		return false
	}
	var ok bool
	application.InvokeSync(func() {
		ok = turnPageNative(w.NativeWindow())
	})
	return ok
}
