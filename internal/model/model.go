package model

// RegionDO 框选区域（相对 overlay 窗口内容区，DIP 像素）。
type RegionDO struct {
	X int `json:"x"`
	Y int `json:"y"`
	W int `json:"w"`
	H int `json:"h"`
}

// AISettingsDO AI 连接配置。
type AISettingsDO struct {
	APIBase   string `json:"apiBase"`
	HasAPIKey bool   `json:"hasApiKey"`
	Model     string `json:"model"`
	Provider  string `json:"provider"`
}

// AISettingsSaveDO 保存 AI 配置。
type AISettingsSaveDO struct {
	APIBase  string `json:"apiBase"`
	APIKey   string `json:"apiKey"`
	Model    string `json:"model"`
	Provider string `json:"provider"`
}

// SessionDO 一本读书笔记（持久化表名仍为 sessions）。
type SessionDO struct {
	ID           string `json:"id"`
	NotebookName string `json:"notebookName"`
	CreatedAt int64  `json:"createdAt"`
	UpdatedAt int64  `json:"updatedAt"`
}

// SnapDO 单次解读快照。
type SnapDO struct {
	ID        string   `json:"id"`
	SessionID string   `json:"sessionId"`
	Title     string   `json:"title"`
	OCRText   string   `json:"ocrText"`
	Summary   string   `json:"summary"`
	Concepts  []string `json:"concepts"`
	CreatedAt int64    `json:"createdAt"`
}

// CatalogNodeDO 章节树节点：chapter 为章节容器，page 为章节下的解读页。
type CatalogNodeDO struct {
	ID        string `json:"id"`
	SessionID string `json:"sessionId"`
	ParentID  string `json:"parentId"`
	Kind      string `json:"kind"` // chapter | page
	Title     string `json:"title"`
	SnapID    string `json:"snapId"`
	SortOrder int    `json:"sortOrder"`
}

// CatalogSettingsDO 目录入库方式。
type CatalogSettingsDO struct {
	AutoAdd bool `json:"autoAdd"`
}

// CatalogNodeSaveDO 新建或更新目录节点。
type CatalogNodeSaveDO struct {
	ID       string `json:"id"`
	ParentID string `json:"parentId"`
	Kind     string `json:"kind"`
	Title    string `json:"title"`
	SnapID   string `json:"snapId"`
}

// WorkspaceStateDO 工作区窗口布局（阅读器+笔记单窗）。
type WorkspaceStateDO struct {
	X         int    `json:"x"`
	Y         int    `json:"y"`
	H         int    `json:"h"`
	ScopeW    int    `json:"scopeW"`
	SidebarW  int    `json:"sidebarW"`
	Docked    bool   `json:"docked"`
	NotePlace string `json:"notePlace"` // right left top bottom center popout
	PopoutX   int    `json:"popoutX"`
	PopoutY   int    `json:"popoutY"`
	PopoutH   int    `json:"popoutH"`
}

// LayoutSettingsDO 笔记窗口布局设置（前端可见）。
type LayoutSettingsDO struct {
	Docked    bool   `json:"docked"`
	SidebarW  int    `json:"sidebarW"`
	NotePlace string `json:"notePlace"`
}

// WindowLayoutSnapshotDO 窗口位置与内部分割快照。
type WindowLayoutSnapshotDO struct {
	X         int    `json:"x"`
	Y         int    `json:"y"`
	H         int    `json:"h"`
	ScopeW    int    `json:"scopeW"`
	SidebarW  int    `json:"sidebarW"`
	Docked    bool   `json:"docked"`
	NotePlace string `json:"notePlace"`
	PopoutX   int    `json:"popoutX"`
	PopoutY   int    `json:"popoutY"`
	PopoutH   int    `json:"popoutH"`
}

// WindowLayoutPresetDO 可切换的窗口布局预设。
type WindowLayoutPresetDO struct {
	ID     string                 `json:"id"`
	Name   string                 `json:"name"`
	Layout WindowLayoutSnapshotDO `json:"layout"`
}

// WindowLayoutPresetsDO 窗口布局预设集合与当前选中项。
type WindowLayoutPresetsDO struct {
	ActiveID string                 `json:"activeId"`
	Presets  []WindowLayoutPresetDO `json:"presets"`
}

// WindowLayoutPresetSaveDO 新建或更新布局预设。
type WindowLayoutPresetSaveDO struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	FromCurrent bool   `json:"fromCurrent"`
}

// AppInfoDO 应用信息。
type AppInfoDO struct {
	Version string `json:"version"`
	Name    string `json:"name"`
}

// ReaderSettingsDO 侧栏阅读样式。
type ReaderSettingsDO struct {
	FontSize     int     `json:"fontSize"`
	LineHeight   float64 `json:"lineHeight"`
	FontFamily   string  `json:"fontFamily"`
	ParagraphGap int     `json:"paragraphGap"`
	LayoutTheme  string  `json:"layoutTheme"` // magazine minimal academic terminal card brief
}

// PromptTemplateDO 解读提示词模板。
type PromptTemplateDO struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	SystemPrompt string `json:"systemPrompt"`
}

// PromptSettingsDO 提示词模板集合与当前选中项。
type PromptSettingsDO struct {
	ActiveID  string             `json:"activeId"`
	Templates []PromptTemplateDO `json:"templates"`
}

// PromptTemplateSaveDO 保存/更新模板。
type PromptTemplateSaveDO struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	SystemPrompt string `json:"systemPrompt"`
}
