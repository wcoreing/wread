package read

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"
	"unsafe"

	"wread/internal/agent"
	"wread/internal/capture"
	"wread/internal/model"
	"wread/internal/ocr"
	"wread/internal/store"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// Emitter 事件推送。
type Emitter func(event string, payload any)

// Engine 伴读引擎。
type Engine struct {
	store    *store.Store
	overlay  application.Window
	sidebar  application.Window
	mu       sync.Mutex
	cancel   context.CancelFunc
	gen      uint64
	lastOCR  string
	lastSnap *model.SnapDO
	emit     Emitter
}

// NewEngine 创建伴读引擎。
func NewEngine(st *store.Store, emit Emitter) *Engine {
	return &Engine{store: st, emit: emit}
}

// SetEmitter 设置事件推送回调。
func (e *Engine) SetEmitter(emit Emitter) {
	e.emit = emit
}

// SetOverlay 绑定 overlay 窗口。
func (e *Engine) SetOverlay(w application.Window) {
	e.overlay = w
}

// SetSidebar 绑定侧栏窗口（截屏时临时隐藏，避免截到 Wread 自身 UI）。
func (e *Engine) SetSidebar(w application.Window) {
	e.sidebar = w
}

// beginJob 开始新解读任务，取消上一个未完成任务。
func (e *Engine) beginJob(parent context.Context) (context.Context, uint64) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if e.cancel != nil {
		e.cancel()
	}
	ctx, cancel := context.WithTimeout(parent, 3*time.Minute)
	e.gen++
	gen := e.gen
	e.cancel = cancel
	return ctx, gen
}

// endJob 结束解读任务。
func (e *Engine) endJob(gen uint64) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if e.gen != gen {
		return
	}
	if e.cancel != nil {
		e.cancel()
		e.cancel = nil
	}
}

// stale 判断任务是否已被新任务取代。
func (e *Engine) stale(gen uint64) bool {
	e.mu.Lock()
	defer e.mu.Unlock()
	return gen != e.gen
}

func (e *Engine) abortErr(ctx context.Context, gen uint64) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if e.stale(gen) {
		return context.Canceled
	}
	return nil
}

// captureImage 截取 overlay 内阅读区域 PNG。
func (e *Engine) captureImage(ctx context.Context, region model.RegionDO) ([]byte, error) {
	if e.overlay == nil {
		return nil, fmt.Errorf("overlay 窗口未就绪")
	}

	var bounds application.Rect
	var nativeOverlay unsafe.Pointer
	var nativeSidebar unsafe.Pointer
	application.InvokeSync(func() {
		bounds = e.overlay.Bounds()
		nativeOverlay = e.overlay.NativeWindow()
		if e.sidebar != nil {
			nativeSidebar = e.sidebar.NativeWindow()
		}
	})

	content := application.Rect{
		X:      bounds.X + region.X,
		Y:      bounds.Y + region.Y,
		Width:  region.W,
		Height: region.H,
	}
	if content.Width <= 20 || content.Height <= 20 {
		return nil, fmt.Errorf("阅读区域太小")
	}

	screenRect := capture.ScreenRect(content)
	log.Printf("[wread] capture dip=(%d,%d %dx%d) screen=(%d,%d %dx%d)",
		content.X, content.Y, content.Width, content.Height,
		screenRect.X, screenRect.Y, screenRect.Width, screenRect.Height)

	hideOverlay := !capture.SupportsBelowWindowCapture()
	hideSidebar := hideOverlay && e.sidebarOverlaps(content)

	application.InvokeSync(func() {
		if hideOverlay {
			e.overlay.Hide()
		}
		if hideSidebar && e.sidebar != nil {
			e.sidebar.Hide()
		}
	})
	if hideOverlay || hideSidebar {
		time.Sleep(80 * time.Millisecond)
	}
	defer application.InvokeSync(func() {
		if hideSidebar && e.sidebar != nil {
			e.sidebar.Show()
		}
		if hideOverlay {
			e.overlay.Show()
		}
	})

	if err := ctx.Err(); err != nil {
		return nil, err
	}

	var extraExclude []unsafe.Pointer
	if capture.SupportsBelowWindowCapture() && nativeSidebar != nil {
		extraExclude = append(extraExclude, nativeSidebar)
	}

	img, err := capture.CaptureReadingArea(screenRect, nativeOverlay, extraExclude...)
	if err == nil {
		return img, nil
	}
	if !hideOverlay {
		log.Printf("[wread] below-window capture failed, fallback hide: %v", err)
		application.InvokeSync(func() {
			e.overlay.Hide()
		})
		time.Sleep(80 * time.Millisecond)
		defer application.InvokeSync(func() {
			e.overlay.Show()
		})
		if err := ctx.Err(); err != nil {
			return nil, err
		}
	}
	return capture.CaptureRect(screenRect)
}

// sidebarOverlaps 判断侧栏是否与截屏区域重叠。
func (e *Engine) sidebarOverlaps(content application.Rect) bool {
	if e.sidebar == nil {
		return false
	}
	var sb application.Rect
	application.InvokeSync(func() {
		sb = e.sidebar.Bounds()
	})
	return rectsOverlap(content, sb)
}

func rectsOverlap(a, b application.Rect) bool {
	return a.X < b.X+b.Width && a.X+a.Width > b.X &&
		a.Y < b.Y+b.Height && a.Y+a.Height > b.Y
}

// CaptureRegion 截取 overlay 内阅读区域并 OCR。
func (e *Engine) CaptureRegion(ctx context.Context, region model.RegionDO) ([]byte, string, error) {
	img, err := e.captureImage(ctx, region)
	if err != nil {
		return nil, "", err
	}
	text, err := ocr.ExtractText(ctx, img)
	if err != nil {
		return img, "", err
	}
	return img, text, nil
}

// Interpret 解读当前区域。
func (e *Engine) Interpret(ctx context.Context, region model.RegionDO) (model.SnapDO, error) {
	ctx, gen := e.beginJob(ctx)
	defer e.endJob(gen)

	e.emit("read:status", "截屏识别中…")
	img, err := e.captureImage(ctx, region)
	if err != nil {
		if errors.Is(err, context.Canceled) {
			return model.SnapDO{}, err
		}
		e.emit("read:error", err.Error())
		return model.SnapDO{}, err
	}
	if err := e.abortErr(ctx, gen); err != nil {
		return model.SnapDO{}, err
	}

	if preview, err := capture.PreviewDataURL(img, 480); err == nil {
		e.emit("read:preview", preview)
	} else {
		log.Printf("[wread] preview error: %v", err)
	}

	ocrText, err := ocr.ExtractText(ctx, img)
	if err != nil {
		if errors.Is(err, context.Canceled) {
			return model.SnapDO{}, err
		}
		e.emit("read:error", err.Error())
		return model.SnapDO{}, err
	}
	if err := e.abortErr(ctx, gen); err != nil {
		return model.SnapDO{}, err
	}

	e.lastOCR = ocrText
	e.emit("read:ocr", ocrText)

	if reason := ocr.JunkReason(ocrText); reason != "" {
		log.Printf("[wread] ocr junk rejected: %s", reason)
		e.emit("read:error", reason)
		return model.SnapDO{}, fmt.Errorf("%s", reason)
	}

	hash := hashText(ocrText)
	sess, err := e.store.EnsureActiveSession()
	if err != nil {
		e.emit("read:error", err.Error())
		return model.SnapDO{}, err
	}
	if dup, err := e.store.FindSnapByHash(sess.ID, hash); err == nil && dup != nil {
		e.lastOCR = ocrText
		e.lastSnap = dup
		e.emit("read:done", *dup)
		return *dup, nil
	}

	base, key, modelName := e.store.AIConfig()
	provider := agent.NewProvider(base, key, modelName)
	rolling := e.store.GetRollingSummary(sess.ID)
	book := e.store.GetActiveNotebookName()

	e.emit("read:status", "AI 解读中…")
	promptTpl := e.store.GetActivePromptTemplate()
	summary, concepts, err := provider.CompleteTeacher(ctx, book, rolling, ocrText, promptTpl, func(delta string) {
		if e.stale(gen) {
			return
		}
		e.emit("read:delta", delta)
	})
	if err != nil {
		if errors.Is(err, context.Canceled) {
			return model.SnapDO{}, err
		}
		e.emit("read:error", err.Error())
		return model.SnapDO{}, err
	}
	if err := e.abortErr(ctx, gen); err != nil {
		return model.SnapDO{}, err
	}

	chapterTitle := ""
	if chapterID, err := e.store.ResolveChapterID(sess.ID, e.store.GetCatalogInsertParent()); err == nil {
		if ch, err := e.store.GetChapterNode(sess.ID, chapterID); err == nil {
			chapterTitle = ch.Title
		}
	}
	e.emit("read:status", "生成标题…")
	pageTitle := e.generatePageTitle(ctx, chapterTitle, summary)
	if err := e.abortErr(ctx, gen); err != nil {
		return model.SnapDO{}, err
	}

	snap, err := e.store.InsertSnap(sess.ID, pageTitle, ocrText, summary, concepts, hash)
	if err != nil {
		e.emit("read:error", err.Error())
		return model.SnapDO{}, err
	}
	e.lastOCR = ocrText
	e.lastSnap = &snap
	_ = e.store.UpdateRollingSummary(sess.ID, mergeRollingSummary(rolling, summary))
	if e.store.GetCatalogSettings().AutoAdd {
		chapterID, err := e.store.ResolveChapterID(sess.ID, e.store.GetCatalogInsertParent())
		if err == nil {
			node, err := e.AddPageToChapter(ctx, sess.ID, chapterID, snap.ID, "")
			if err == nil {
				e.emit("catalog:changed", node)
			}
		}
	}
	e.emit("read:done", snap)
	return snap, nil
}

// AddPageToChapter 将解读页归入章节，空标题时使用解读时已生成的 snap 标题。
func (e *Engine) AddPageToChapter(ctx context.Context, sessionID, chapterID, snapID, title string) (model.CatalogNodeDO, error) {
	title = strings.TrimSpace(title)
	if title == "" {
		snap, err := e.store.GetSnap(snapID)
		if err != nil {
			return model.CatalogNodeDO{}, err
		}
		title = strings.TrimSpace(snap.Title)
		if title == "" {
			return model.CatalogNodeDO{}, fmt.Errorf("解读页缺少标题，请重新解读")
		}
	}
	return e.store.AddPageToChapter(sessionID, chapterID, snapID, title)
}

// generatePageTitle 调用 AI 生成目录页标题。
func (e *Engine) generatePageTitle(ctx context.Context, chapterTitle, summary string) string {
	base, key, modelName := e.store.AIConfig()
	provider := agent.NewProvider(base, key, modelName)
	book := e.store.GetActiveNotebookName()
	title, err := provider.GeneratePageTitle(ctx, book, chapterTitle, summary)
	if err != nil {
		log.Printf("[wread] generate page title: %v", err)
		return "未命名"
	}
	return title
}

// FollowUp 追问当前段落，结果合并到同一解读页。
func (e *Engine) FollowUp(ctx context.Context, question string) (string, error) {
	question = strings.TrimSpace(question)
	if question == "" {
		return "", fmt.Errorf("请输入问题")
	}
	if e.lastOCR == "" {
		return "", fmt.Errorf("请先解读当前页")
	}
	sess, err := e.store.EnsureActiveSession()
	if err != nil {
		return "", err
	}
	base, key, modelName := e.store.AIConfig()
	provider := agent.NewProvider(base, key, modelName)
	rolling := e.store.GetRollingSummary(sess.ID)
	book := e.store.GetActiveNotebookName()

	ctx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()

	var answer strings.Builder
	promptTpl := e.store.GetActivePromptTemplate()
	out, err := provider.AskFollowUp(ctx, book, rolling, e.lastOCR, question, promptTpl, func(delta string) {
		answer.WriteString(delta)
		e.emit("read:delta", delta)
	})
	if err != nil {
		e.emit("read:error", err.Error())
		return "", err
	}
	merged := out
	if e.lastSnap != nil {
		merged = e.lastSnap.Summary + "\n\n---\n问：" + question + "\n\n" + out
		if err := e.store.UpdateSnapSummary(e.lastSnap.ID, merged); err != nil {
			e.emit("read:error", err.Error())
			return "", err
		}
		e.lastSnap.Summary = merged
	}
	e.emit("read:followup", merged)
	return merged, nil
}

// SetActiveSnap 切换当前解读页上下文（目录选中时）。
func (e *Engine) SetActiveSnap(snap *model.SnapDO) {
	if snap == nil {
		e.lastSnap = nil
		e.lastOCR = ""
		return
	}
	e.lastSnap = snap
	e.lastOCR = snap.OCRText
}

// ClearSnapIf 若当前上下文为该解读页则清空。
func (e *Engine) ClearSnapIf(snapID string) {
	if snapID == "" || e.lastSnap == nil || e.lastSnap.ID != snapID {
		return
	}
	e.SetActiveSnap(nil)
}

func hashText(text string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(text)))
	return hex.EncodeToString(sum[:16])
}

func mergeRollingSummary(old, latest string) string {
	merged := strings.TrimSpace(old)
	if merged == "" {
		return truncateRunes(latest, 1200)
	}
	merged += "\n---\n" + truncateRunes(latest, 600)
	return truncateRunes(merged, 2000)
}

func truncateRunes(s string, max int) string {
	r := []rune(s)
	if len(r) <= max {
		return s
	}
	return string(r[:max]) + "…"
}
