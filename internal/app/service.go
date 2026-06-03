package app

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"

	"wread/internal/agent"
	"wread/internal/model"
	"wread/internal/overlay"
	"wread/internal/read"
	"wread/internal/store"

	"github.com/wailsapp/wails/v3/pkg/application"
)

var errPillUnavailable = errors.New("pill 窗口未就绪")

// Service Wails 绑定服务。
type Service struct {
	store           *store.Store
	engine          *read.Engine
	app             *application.App
	workspace       application.Window
	popout          application.Window
	pill            application.Window
	ws              *Workspace
	version         string
	overlayEditMode bool
	pillSnapshot    model.PillRestoreSnapshotDO
}

// NewService 创建 Service。
func NewService(version string, st *store.Store, engine *read.Engine) *Service {
	return &Service{version: version, store: st, engine: engine}
}

// attach 注入 app 与窗口引用（仅 main 调用，不暴露给前端）。
func (s *Service) attach(app *application.App, workspace, popout, pill application.Window, ws *Workspace) {
	s.app = app
	s.workspace = workspace
	s.popout = popout
	s.pill = pill
	s.ws = ws
	s.engine.SetOverlay(workspace)
	s.engine.SetSidebar(popout)
}

// ServiceStartup Wails 生命周期。
func (s *Service) ServiceStartup(ctx context.Context, _ application.ServiceOptions) error {
	_ = ctx
	s.applyOverlayMouseMode()
	return nil
}

func (s *Service) emit(event string, payload any) {
	if s.app != nil {
		s.app.Event.Emit(event, payload)
	}
}

// GetAppInfo 返回应用信息。
func (s *Service) GetAppInfo() model.AppInfoDO {
	return model.AppInfoDO{Version: s.version, Name: "Wread"}
}

// GetLayoutSettings 读取笔记布局设置。
func (s *Service) GetLayoutSettings() model.LayoutSettingsDO {
	if s.ws == nil {
		return model.LayoutSettingsDO{Docked: true, SidebarW: 380}
	}
	return s.ws.Settings()
}

// SetSidebarWidth 设置内嵌笔记栏宽度。
func (s *Service) SetSidebarWidth(width int) error {
	if s.ws == nil {
		return fmt.Errorf("layout 未就绪")
	}
	s.ws.SetSidebarWidth(width)
	return nil
}

// RestoreDefaultWindowLayout 恢复工作区与弹出笔记窗的默认尺寸。
func (s *Service) RestoreDefaultWindowLayout() error {
	if s.ws == nil {
		return fmt.Errorf("layout 未就绪")
	}
	return s.ApplyWindowLayoutPreset(store.BuiltinDefaultLayoutPresetID())
}

// GetWindowLayoutPresets 读取窗口布局预设列表。
func (s *Service) GetWindowLayoutPresets() model.WindowLayoutPresetsDO {
	return s.store.GetWindowLayoutPresets()
}

// SaveWindowLayoutPreset 新建或更新窗口布局预设。
func (s *Service) SaveWindowLayoutPreset(in model.WindowLayoutPresetSaveDO) (model.WindowLayoutPresetDO, error) {
	if s.ws == nil {
		return model.WindowLayoutPresetDO{}, fmt.Errorf("layout 未就绪")
	}
	snap := s.ws.LayoutSnapshot()
	if !in.FromCurrent && strings.TrimSpace(in.ID) != "" {
		cur, err := s.store.GetWindowLayoutPreset(in.ID)
		if err != nil {
			return model.WindowLayoutPresetDO{}, err
		}
		snap = cur.Layout
	}
	return s.store.SaveWindowLayoutPreset(in, snap)
}

// DeleteWindowLayoutPreset 删除窗口布局预设。
func (s *Service) DeleteWindowLayoutPreset(id string) error {
	return s.store.DeleteWindowLayoutPreset(id)
}

// ApplyWindowLayoutPreset 切换并应用窗口布局预设。
func (s *Service) ApplyWindowLayoutPreset(id string) error {
	if s.ws == nil {
		return fmt.Errorf("layout 未就绪")
	}
	preset, err := s.store.GetWindowLayoutPreset(id)
	if err != nil {
		return err
	}
	application.InvokeSync(func() {
		s.ws.ApplyLayoutSnapshot(preset.Layout)
	})
	if err := s.store.SetActiveWindowLayoutPreset(id); err != nil {
		return err
	}
	s.emit("layout:preset", id)
	return nil
}

// SetNotePlace 设置笔记停靠方位：right left top bottom center popout。
func (s *Service) SetNotePlace(place string) error {
	if s.ws == nil {
		return fmt.Errorf("layout 未就绪")
	}
	s.ws.SetNotePlace(place)
	return nil
}

// SyncWorkspaceBounds 将工作区窗口 bounds 写入持久化。
func (s *Service) SyncWorkspaceBounds() {
	if s.ws == nil {
		return
	}
	s.ws.SyncBounds()
}

// BeginWorkspaceFrameDrag 边框/顶栏拖拽开始，暂停穿透同步直至 Finish。
func (s *Service) BeginWorkspaceFrameDrag() error {
	if s.ws == nil {
		return nil
	}
	s.ws.BeginFrameDrag()
	return nil
}

// ResizeWorkspace 拖拽边框缩放工作区窗口（单次 SetBounds，避免 IPC 风暴）。
func (s *Service) ResizeWorkspace(x, y, width, height int) error {
	if s.ws == nil {
		return nil
	}
	s.ws.ResizeWorkspace(x, y, width, height)
	return nil
}

// FinishWorkspaceResize 边框拖拽结束，同步穿透带并持久化。
func (s *Service) FinishWorkspaceResize() error {
	if s.ws == nil {
		return nil
	}
	s.ws.FinishWorkspaceResize()
	return nil
}

// SetCatalogWidth 同步目录侧栏宽度（0 表示收起），供穿透带几何使用。
func (s *Service) SetCatalogWidth(width int) {
	if s.ws == nil {
		return
	}
	s.ws.SetCatalogWidth(width)
}

// SyncPopoutBounds 将弹出笔记窗 bounds 写入持久化。
func (s *Service) SyncPopoutBounds() {
	if s.ws == nil {
		return
	}
	s.ws.SyncPopoutBounds()
}

func (s *Service) onInterpretDone() {
	s.applyOverlayMouseMode()
}

// EnsureOverlayReadMode 布局就绪后同步开卷穿透状态。
func (s *Service) EnsureOverlayReadMode() {
	s.applyOverlayMouseMode()
}

// GetScopeMode 读取阅读器模式：op | read | note。
func (s *Service) GetScopeMode() string {
	return s.store.GetScopeMode()
}

// SetScopeMode 切换阅读器模式。
func (s *Service) SetScopeMode(mode string) error {
	if err := s.store.SetScopeMode(mode); err != nil {
		return err
	}
	s.overlayEditMode = false
	s.applyOverlayMouseMode()
	return nil
}

// applyOverlayMouseMode 根据阅读/调整模式更新穿透与窗口置顶。
func (s *Service) applyOverlayMouseMode() {
	passThrough := s.store.GetScopeMode() == "read" && !s.overlayEditMode
	overlay.ApplyPassThrough(s.workspace, passThrough)
	s.applyWindowAlwaysOnTop()
	s.emit("overlay:editable", s.overlayEditMode)
	s.emit("overlay:scopeMode", s.store.GetScopeMode())
	s.emit("overlay:passAX", overlay.AccessibilityTrusted())
}

// applyWindowAlwaysOnTop 仅阅读模式（非调整态）置顶工作区，弹出笔记窗永不置顶。
func (s *Service) applyWindowAlwaysOnTop() {
	top := s.store.GetScopeMode() == "read" && !s.overlayEditMode
	application.InvokeSync(func() {
		if s.workspace != nil {
			s.workspace.SetAlwaysOnTop(top)
		}
		if s.popout != nil {
			s.popout.SetAlwaysOnTop(false)
		}
	})
	log.Printf("window always-on-top: workspace=%v mode=%s edit=%v", top, s.store.GetScopeMode(), s.overlayEditMode)
}

// setOverlayEditable 开卷区可拖动调整。
func (s *Service) setOverlayEditable() {
	s.overlayEditMode = true
	s.applyOverlayMouseMode()
}

// wakeWindow 显示窗口并聚焦。
func (s *Service) wakeWindow(w application.Window) {
	if w == nil {
		return
	}
	application.InvokeSync(func() {
		w.Show().Focus()
	})
}

// FocusOverlay 聚焦工作区并进入开卷调整模式。
func (s *Service) FocusOverlay() {
	if s.IsPillMode() {
		_ = s.RestoreFromPill()
	}
	s.setOverlayEditable()
	s.wakeWindow(s.workspace)
}

// FocusSidebar 聚焦笔记（内嵌时同工作区，弹出时聚焦弹出窗）。
func (s *Service) FocusSidebar() {
	if s.IsPillMode() {
		_ = s.RestoreFromPill()
	}
	if s.ws != nil && s.ws.State().Docked {
		s.wakeWindow(s.workspace)
		s.emit("focus:note", true)
		return
	}
	s.wakeWindow(s.popout)
}

// ShowOverlay 显示工作区。
func (s *Service) ShowOverlay() {
	s.FocusOverlay()
}

// HideOverlay 隐藏工作区。
func (s *Service) HideOverlay() {
	if s.workspace != nil {
		s.workspace.Hide()
	}
}

// ShowSidebar 显示笔记。
func (s *Service) ShowSidebar() {
	s.FocusSidebar()
}

// HideSidebar 隐藏弹出笔记窗。
func (s *Service) HideSidebar() {
	if s.popout != nil {
		s.popout.Hide()
	}
}

// DefaultRegion 返回开卷区内默认阅读区域（相对工作区左上角）。
func (s *Service) DefaultRegion() model.RegionDO {
	const toolbarH = 36
	const border = 3
	scopeW := defaultScopeWidth
	catalogW := 0
	if s.ws != nil {
		scopeW = s.ws.ScopeWidth()
		catalogW = s.ws.CatalogWidth()
	}
	w := scopeW - border*2
	h := 400
	if s.workspace != nil {
		b := s.workspace.Bounds()
		h = b.Height - toolbarH - border*2
	}
	if w < 40 {
		w = 40
	}
	if h < 40 {
		h = 40
	}
	return model.RegionDO{X: border + catalogW, Y: toolbarH + border, W: w, H: h}
}

// GetAISettings 读取 AI 配置。
func (s *Service) GetAISettings() model.AISettingsDO {
	return s.store.GetAISettings()
}

// SaveAISettings 保存 AI 配置。
func (s *Service) SaveAISettings(in model.AISettingsSaveDO) error {
	cur := s.store.GetAISettings()
	if in.APIKey == "" && !cur.HasAPIKey {
		return fmt.Errorf("请填写 API Key")
	}
	return s.store.SaveAISettings(in)
}

// TestAIConnection 测试 AI 连接。
func (s *Service) TestAIConnection() error {
	base, key, modelName := s.store.AIConfig()
	return agent.NewProvider(base, key, modelName).TestConnection(context.Background())
}

// GetReaderSettings 读取侧栏阅读样式。
func (s *Service) GetReaderSettings() model.ReaderSettingsDO {
	return s.store.GetReaderSettings()
}

// SaveReaderSettings 保存侧栏阅读样式。
func (s *Service) SaveReaderSettings(in model.ReaderSettingsDO) error {
	if err := s.store.SaveReaderSettings(in); err != nil {
		return err
	}
	s.emit("reader:settings", in)
	return nil
}

// GetPromptSettings 读取解读提示词模板。
func (s *Service) GetPromptSettings() model.PromptSettingsDO {
	return s.store.GetPromptSettings()
}

// SavePromptTemplate 新建或更新解读模板。
func (s *Service) SavePromptTemplate(in model.PromptTemplateSaveDO) (model.PromptTemplateDO, error) {
	return s.store.SavePromptTemplate(in)
}

// DeletePromptTemplate 删除解读模板。
func (s *Service) DeletePromptTemplate(id string) error {
	return s.store.DeletePromptTemplate(id)
}

// SetActivePromptTemplate 切换当前解读模板。
func (s *Service) SetActivePromptTemplate(id string) error {
	return s.store.SetActivePromptTemplate(id)
}

// ResetPromptTemplates 恢复默认解读模板。
func (s *Service) ResetPromptTemplates() model.PromptSettingsDO {
	return s.store.ResetPromptTemplates()
}

// GetActiveNotebookName 当前笔记本名称。
func (s *Service) GetActiveNotebookName() string {
	return s.store.GetActiveNotebookName()
}

// SetActiveNotebookName 设置当前笔记本名称。
func (s *Service) SetActiveNotebookName(name string) error {
	return s.store.SetActiveNotebookName(name)
}

// ListSessions 列出读书会话。
func (s *Service) ListSessions() ([]model.SessionDO, error) {
	return s.store.ListSessions(50)
}

// ListNotebooks 列出全部笔记本。
func (s *Service) ListNotebooks() ([]model.SessionDO, error) {
	return s.store.ListSessions(50)
}

// GetActiveNotebook 返回当前打开的笔记本。
func (s *Service) GetActiveNotebook() (model.SessionDO, error) {
	return s.store.EnsureActiveSession()
}

// OpenNotebook 打开笔记本。
func (s *Service) OpenNotebook(id string) (model.SessionDO, error) {
	sess, err := s.store.OpenNotebook(id)
	if err != nil {
		return model.SessionDO{}, err
	}
	s.engine.SetActiveSnap(nil)
	s.emit("notebook:opened", sess)
	return sess, nil
}

// CreateNotebook 新建笔记本并打开。
func (s *Service) CreateNotebook(title string) (model.SessionDO, error) {
	sess, err := s.store.CreateNotebook(title)
	if err != nil {
		return model.SessionDO{}, err
	}
	s.engine.SetActiveSnap(nil)
	s.emit("notebook:opened", sess)
	return sess, nil
}

// DeleteNotebook 删除笔记本；若删的是当前本则返回新的当前本。
func (s *Service) DeleteNotebook(id string) (model.SessionDO, error) {
	sess, err := s.store.DeleteNotebook(id)
	if err != nil {
		return model.SessionDO{}, err
	}
	s.engine.SetActiveSnap(nil)
	s.emit("notebook:opened", sess)
	return sess, nil
}

// ListSnaps 列出当前会话解读记录。
func (s *Service) ListSnaps() ([]model.SnapDO, error) {
	sess, err := s.store.EnsureActiveSession()
	if err != nil {
		return nil, err
	}
	return s.store.ListSnaps(sess.ID, 100)
}

// GetCatalogSettings 读取目录入库方式。
func (s *Service) GetCatalogSettings() model.CatalogSettingsDO {
	return s.store.GetCatalogSettings()
}

// GetCatalogInsertParent 读取当前归入目标章节 ID。
func (s *Service) GetCatalogInsertParent() string {
	return s.store.GetCatalogInsertParent()
}

// SetCatalogAutoAdd 切换自动/手动入目录。
func (s *Service) SetCatalogAutoAdd(auto bool) error {
	return s.store.SetCatalogAutoAdd(auto)
}

// GetSnapCaptureSettings 读取解读截屏保留设置。
func (s *Service) GetSnapCaptureSettings() model.SnapCaptureSettingsDO {
	return model.SnapCaptureSettingsDO{KeepCapture: s.store.GetSnapKeepCapture()}
}

// SetSnapKeepCapture 切换是否在每页笔记中保留截屏。
func (s *Service) SetSnapKeepCapture(on bool) error {
	return s.store.SetSnapKeepCapture(on)
}

// ListCatalog 列出当前会话目录树。
func (s *Service) ListCatalog() ([]model.CatalogNodeDO, error) {
	sess, err := s.store.EnsureActiveSession()
	if err != nil {
		return nil, err
	}
	return s.store.ListCatalogNodes(sess.ID)
}

// CreateChapter 新建章节。
func (s *Service) CreateChapter(parentID, title string) (model.CatalogNodeDO, error) {
	sess, err := s.store.EnsureActiveSession()
	if err != nil {
		return model.CatalogNodeDO{}, err
	}
	node, err := s.store.CreateChapter(sess.ID, parentID, title)
	if err != nil {
		return model.CatalogNodeDO{}, err
	}
	s.emit("catalog:changed", node)
	return node, nil
}

// SetCatalogInsertParent 设置当前选中章节。
func (s *Service) SetCatalogInsertParent(chapterID string) error {
	return s.store.SetCatalogInsertParent(chapterID)
}

// AddToCatalog 手动将解读页归入章节。
func (s *Service) AddToCatalog(chapterID, snapID, title string) (model.CatalogNodeDO, error) {
	sess, err := s.store.EnsureActiveSession()
	if err != nil {
		return model.CatalogNodeDO{}, err
	}
	resolved, err := s.store.ResolveChapterID(sess.ID, chapterID)
	if err != nil {
		return model.CatalogNodeDO{}, err
	}
	node, err := s.engine.AddPageToChapter(context.Background(), sess.ID, resolved, snapID, title)
	if err != nil {
		return model.CatalogNodeDO{}, err
	}
	s.emit("catalog:changed", node)
	return node, nil
}

// UpdateCatalogNode 更新目录节点。
func (s *Service) UpdateCatalogNode(in model.CatalogNodeSaveDO) (model.CatalogNodeDO, error) {
	node, err := s.store.UpdateCatalogNode(in)
	if err != nil {
		return model.CatalogNodeDO{}, err
	}
	s.emit("catalog:changed", node)
	return node, nil
}

// MoveCatalogNode 拖动调整目录节点父级与排序。
func (s *Service) MoveCatalogNode(nodeID, parentID string, index int) error {
	sess, err := s.store.EnsureActiveSession()
	if err != nil {
		return err
	}
	if err := s.store.MoveCatalogNode(sess.ID, nodeID, parentID, index); err != nil {
		return err
	}
	s.emit("catalog:changed", model.CatalogNodeDO{})
	return nil
}

// OrganizeCatalogPages 对选中的笔记页 AI 分章并直接应用。
func (s *Service) OrganizeCatalogPages(pageIDs []string) error {
	pageIDs = dedupeStrings(pageIDs)
	if len(pageIDs) < 2 {
		return fmt.Errorf("至少选择 2 页笔记")
	}
	sess, err := s.store.EnsureActiveSession()
	if err != nil {
		return err
	}
	pages, err := s.store.CollectPagesByIDs(sess.ID, pageIDs)
	if err != nil {
		return err
	}
	inputs := make([]model.CatalogOrganizePageDO, 0, len(pages))
	for i, p := range pages {
		item := model.CatalogOrganizePageDO{
			ID:    p.ID,
			Title: p.Title,
			Index: i + 1,
		}
		if p.SnapID != "" {
			if snap, err := s.store.GetSnap(p.SnapID); err == nil {
				item.Summary = strings.TrimSpace(snap.Summary)
			}
		}
		inputs = append(inputs, item)
	}
	scopeTitle := s.store.GetActiveNotebookName()
	if scopeTitle == "" {
		scopeTitle = "未命名笔记本"
	}
	base, key, modelName := s.store.AIConfig()
	provider := agent.NewProvider(base, key, modelName)
	plan, err := provider.OrganizeCatalog(context.Background(), scopeTitle, inputs)
	if err != nil {
		return err
	}
	plan, err = store.BindOrganizePlanPages(inputs, plan)
	if err != nil {
		return err
	}
	scopeIDs := make([]string, len(pages))
	for i, p := range pages {
		scopeIDs[i] = p.ID
	}
	if err := validateOrganizePlanPublic(scopeIDs, plan); err != nil {
		return err
	}
	if err := s.store.ApplyCatalogOrganizePages(sess.ID, scopeIDs, plan); err != nil {
		return err
	}
	s.emit("catalog:changed", model.CatalogNodeDO{})
	return nil
}

func dedupeStrings(in []string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(in))
	for _, s := range in {
		s = strings.TrimSpace(s)
		if s == "" {
			continue
		}
		if _, ok := seen[s]; ok {
			continue
		}
		seen[s] = struct{}{}
		out = append(out, s)
	}
	return out
}

func validateOrganizePlanPublic(scopePageIDs []string, plan model.CatalogOrganizePlanDO) error {
	want := map[string]struct{}{}
	for _, id := range scopePageIDs {
		want[id] = struct{}{}
	}
	got := map[string]struct{}{}
	var walk func([]model.CatalogOrganizeChapterDO) error
	walk = func(chapters []model.CatalogOrganizeChapterDO) error {
		for _, ch := range chapters {
			if strings.TrimSpace(ch.Title) == "" {
				return fmt.Errorf("章节标题不能为空")
			}
			for _, pageID := range ch.PageIDs {
				pageID = strings.TrimSpace(pageID)
				if pageID == "" {
					continue
				}
				if _, dup := got[pageID]; dup {
					return fmt.Errorf("页面被重复分配")
				}
				got[pageID] = struct{}{}
				if _, ok := want[pageID]; !ok {
					return fmt.Errorf("页面不在当前分章范围")
				}
			}
			if err := walk(ch.Children); err != nil {
				return err
			}
		}
		return nil
	}
	if err := walk(plan.Chapters); err != nil {
		return err
	}
	if len(got) != len(want) {
		return fmt.Errorf("AI 方案未覆盖全部 %d 页笔记", len(want))
	}
	return nil
}

// DeleteCatalogNode 删除目录节点及子树。
func (s *Service) DeleteCatalogNode(id string) error {
	sess, err := s.store.EnsureActiveSession()
	if err != nil {
		return err
	}
	snapID := ""
	nodes, _ := s.store.ListCatalogNodes(sess.ID)
	for _, n := range nodes {
		if n.ID == id && n.Kind == "page" {
			snapID = n.SnapID
			break
		}
	}
	if err := s.store.DeleteCatalogNode(sess.ID, id); err != nil {
		return err
	}
	s.engine.ClearSnapIf(snapID)
	s.emit("catalog:changed", model.CatalogNodeDO{})
	return nil
}

// SelectSnap 选中目录页并设为追问上下文。
func (s *Service) SelectSnap(snapID string) (model.SnapDO, error) {
	snap, err := s.store.GetSnap(snapID)
	if err != nil {
		return model.SnapDO{}, fmt.Errorf("解读页不存在")
	}
	s.engine.SetActiveSnap(&snap)
	return snap, nil
}

// InterpretNow 解读开卷区内区域。
func (s *Service) InterpretNow(region model.RegionDO) error {
	go func() {
		r := region
		if r.W <= 0 || r.H <= 0 {
			r = s.DefaultRegion()
		}
		snap, err := s.engine.Interpret(context.Background(), r)
		if err != nil {
			if !errors.Is(err, context.Canceled) {
				log.Printf("[wread] interpret error: %v", err)
			}
			return
		}
		_ = snap
		s.onInterpretDone()
	}()
	return nil
}

// AskFollowUp 追问。
func (s *Service) AskFollowUp(question string) (string, error) {
	return s.engine.FollowUp(context.Background(), question)
}
