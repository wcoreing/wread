package store

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"wread/internal/agent"
	"wread/internal/model"

	"github.com/google/uuid"
	_ "modernc.org/sqlite"
)

// Store 本地持久化。
type Store struct {
	db      *sql.DB
	dataDir string
	mu      sync.Mutex
}

// DataDir 返回应用数据目录。
func DataDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(home, ".wread")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", err
	}
	return dir, nil
}

// New 创建 Store。
func New(dataDir string) (*Store, error) {
	if err := os.MkdirAll(dataDir, 0o700); err != nil {
		return nil, fmt.Errorf("创建数据目录失败: %w", err)
	}
	dbPath := filepath.Join(dataDir, "wread.db")
	db, err := openSQLite(dbPath)
	if err != nil {
		return nil, fmt.Errorf("打开数据库失败: %w", err)
	}
	s := &Store{db: db, dataDir: dataDir}
	if err := s.migrate(); err != nil {
		_ = db.Close()
		return nil, err
	}
	return s, nil
}

// Close 关闭数据库。
func (s *Store) Close() error {
	return s.db.Close()
}

func (s *Store) migrate() error {
	return s.withLock(func(db *sql.DB) error {
		_, err := db.Exec(`
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  book_name TEXT NOT NULL DEFAULT '',
  rolling_summary TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS snaps (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  ocr_text TEXT NOT NULL,
  summary TEXT NOT NULL,
  concepts_json TEXT NOT NULL DEFAULT '[]',
  text_hash TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  FOREIGN KEY(session_id) REFERENCES sessions(id)
);
CREATE INDEX IF NOT EXISTS idx_snaps_session ON snaps(session_id, created_at DESC);
`)
		if err != nil {
			return err
		}
		if err := s.migrateCatalogLocked(db); err != nil {
			return err
		}
		return s.migrateSnapsLocked(db)
	})
}

func (s *Store) migrateSnapsLocked(db *sql.DB) error {
	if s.snapsHasTitleColumn(db) {
		return nil
	}
	_, err := db.Exec(`ALTER TABLE snaps ADD COLUMN title TEXT NOT NULL DEFAULT ''`)
	return err
}

func (s *Store) snapsHasTitleColumn(db *sql.DB) bool {
	rows, err := db.Query(`PRAGMA table_info(snaps)`)
	if err != nil {
		return false
	}
	defer rows.Close()
	for rows.Next() {
		var cid, notnull, pk int
		var name, typ string
		var dflt sql.NullString
		if err := rows.Scan(&cid, &name, &typ, &notnull, &dflt, &pk); err != nil {
			return false
		}
		if name == "title" {
			return true
		}
	}
	return false
}

func (s *Store) getSetting(key string) string {
	var v string
	_ = s.withLock(func(db *sql.DB) error {
		return db.QueryRow(`SELECT value FROM settings WHERE key = ?`, key).Scan(&v)
	})
	return v
}

func (s *Store) setSetting(key, value string) error {
	return s.withLock(func(db *sql.DB) error {
		_, err := db.Exec(`
INSERT INTO settings(key, value) VALUES(?, ?)
ON CONFLICT(key) DO UPDATE SET value = excluded.value
`, key, value)
		return err
	})
}

// GetAISettings 读取 AI 配置。
func (s *Store) GetAISettings() model.AISettingsDO {
	return model.AISettingsDO{
		APIBase:   s.getSetting("ai.api_base"),
		HasAPIKey: strings.TrimSpace(s.getSetting("ai.api_key")) != "",
		Model:     fallback(s.getSetting("ai.model"), "qwen-plus"),
		Provider:  fallback(s.getSetting("ai.provider"), "dashscope"),
	}
}

// SaveAISettings 保存 AI 配置。
func (s *Store) SaveAISettings(in model.AISettingsSaveDO) error {
	if strings.TrimSpace(in.APIBase) != "" {
		if err := s.setSetting("ai.api_base", strings.TrimSpace(in.APIBase)); err != nil {
			return err
		}
	}
	if strings.TrimSpace(in.APIKey) != "" {
		if err := s.setSetting("ai.api_key", strings.TrimSpace(in.APIKey)); err != nil {
			return err
		}
	}
	if strings.TrimSpace(in.Model) != "" {
		if err := s.setSetting("ai.model", strings.TrimSpace(in.Model)); err != nil {
			return err
		}
	}
	if strings.TrimSpace(in.Provider) != "" {
		if err := s.setSetting("ai.provider", strings.TrimSpace(in.Provider)); err != nil {
			return err
		}
	}
	return nil
}

// AIConfig 返回 LLM 连接参数。
func (s *Store) AIConfig() (baseURL, apiKey, modelName string) {
	cfg := s.GetAISettings()
	return cfg.APIBase, s.getSetting("ai.api_key"), cfg.Model
}

const defaultSidebarWidth = 380

// GetWorkspaceState 读取工作区布局。
func (s *Store) GetWorkspaceState() model.WorkspaceStateDO {
	raw := s.getSetting("workspace.state")
	if raw != "" {
		var st model.WorkspaceStateDO
		_ = json.Unmarshal([]byte(raw), &st)
		return normalizeWorkspace(st)
	}
	// 从旧版 overlay + layout 迁移
	scopeW, x, y, h := 640, 120, 120, 480
	if ovRaw := s.getSetting("overlay.state"); ovRaw != "" {
		var ov struct {
			X int `json:"x"`
			Y int `json:"y"`
			W int `json:"w"`
			H int `json:"h"`
		}
		_ = json.Unmarshal([]byte(ovRaw), &ov)
		if ov.W >= 200 {
			scopeW = ov.W
		}
		if ov.H >= 160 {
			h = ov.H
		}
		x, y = ov.X, ov.Y
	}
	st := model.WorkspaceStateDO{
		X: x, Y: y, H: h, ScopeW: scopeW,
		SidebarW: defaultSidebarWidth, Docked: true,
	}
	if layRaw := s.getSetting("layout.state"); layRaw != "" {
		var lay struct {
			Docked   bool `json:"docked"`
			SidebarW int  `json:"sidebarW"`
			SidebarX int  `json:"sidebarX"`
			SidebarY int  `json:"sidebarY"`
			SidebarH int  `json:"sidebarH"`
		}
		_ = json.Unmarshal([]byte(layRaw), &lay)
		st.Docked = lay.Docked
		if lay.SidebarW >= 280 {
			st.SidebarW = lay.SidebarW
		}
		st.PopoutX, st.PopoutY, st.PopoutH = lay.SidebarX, lay.SidebarY, lay.SidebarH
		if lay.Docked && scopeW > st.SidebarW {
			st.ScopeW = scopeW - st.SidebarW
		}
	}
	return normalizeWorkspace(st)
}

// SaveWorkspaceState 保存工作区布局。
func (s *Store) SaveWorkspaceState(st model.WorkspaceStateDO) error {
	st = normalizeWorkspace(st)
	raw, err := json.Marshal(st)
	if err != nil {
		return err
	}
	return s.setSetting("workspace.state", string(raw))
}

func normalizeWorkspace(st model.WorkspaceStateDO) model.WorkspaceStateDO {
	if st.ScopeW < 240 {
		st.ScopeW = 640
	}
	if st.SidebarW < 280 {
		st.SidebarW = defaultSidebarWidth
	}
	if st.H < 180 {
		st.H = 480
	}
	if st.X == 0 && st.Y == 0 {
		st.X, st.Y = 120, 120
	}
	if st.NotePlace == "" {
		if st.Docked {
			st.NotePlace = "right"
		} else {
			st.NotePlace = "popout"
		}
	}
	if !st.Docked {
		st.NotePlace = "popout"
	}
	return st
}

// GetActiveSessionID 当前会话 ID。
func (s *Store) GetActiveSessionID() string {
	return s.getSetting("session.active_id")
}

// SetActiveSessionID 设置当前会话。
func (s *Store) SetActiveSessionID(id string) error {
	return s.setSetting("session.active_id", id)
}

// GetActiveNotebookName 当前打开的笔记本名称。
func (s *Store) GetActiveNotebookName() string {
	sess, err := s.EnsureActiveSession()
	if err != nil {
		return "未命名笔记本"
	}
	return fallback(sess.NotebookName, "未命名笔记本")
}

// SetActiveNotebookName 设置当前打开的笔记本名称。
func (s *Store) SetActiveNotebookName(name string) error {
	sess, err := s.EnsureActiveSession()
	if err != nil {
		return err
	}
	return s.SetSessionNotebookName(sess.ID, name)
}

// EnsureActiveSession 确保存在活跃会话。
func (s *Store) EnsureActiveSession() (model.SessionDO, error) {
	var sess model.SessionDO
	err := s.withLock(func(db *sql.DB) error {
		var id string
		_ = db.QueryRow(`SELECT value FROM settings WHERE key = ?`, "session.active_id").Scan(&id)
		if id != "" {
			err := db.QueryRow(`
SELECT id, book_name, created_at, updated_at FROM sessions WHERE id = ?
`, id).Scan(&sess.ID, &sess.NotebookName, &sess.CreatedAt, &sess.UpdatedAt)
			if err == nil {
				return nil
			}
		}
		now := time.Now().Unix()
		id = uuid.NewString()
		if _, err := db.Exec(`
INSERT INTO sessions(id, book_name, rolling_summary, created_at, updated_at)
VALUES(?, '未命名笔记本', '', ?, ?)
`, id, now, now); err != nil {
			return err
		}
		_, err := db.Exec(`
INSERT INTO settings(key, value) VALUES(?, ?)
ON CONFLICT(key) DO UPDATE SET value = excluded.value
`, "session.active_id", id)
		if err != nil {
			return err
		}
		sess = model.SessionDO{ID: id, NotebookName: "未命名笔记本", CreatedAt: now, UpdatedAt: now}
		return nil
	})
	return sess, err
}

// GetSession 读取会话。
func (s *Store) GetSession(id string) (model.SessionDO, error) {
	var sess model.SessionDO
	err := s.withLock(func(db *sql.DB) error {
		return db.QueryRow(`
SELECT id, book_name, created_at, updated_at FROM sessions WHERE id = ?
`, id).Scan(&sess.ID, &sess.NotebookName, &sess.CreatedAt, &sess.UpdatedAt)
	})
	return sess, err
}

// ListSessions 列出会话。
func (s *Store) ListSessions(limit int) ([]model.SessionDO, error) {
	if limit <= 0 {
		limit = 50
	}
	var out []model.SessionDO
	err := s.withLock(func(db *sql.DB) error {
		rows, err := db.Query(`
SELECT id, book_name, created_at, updated_at
FROM sessions ORDER BY updated_at DESC LIMIT ?
`, limit)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var sess model.SessionDO
			if err := rows.Scan(&sess.ID, &sess.NotebookName, &sess.CreatedAt, &sess.UpdatedAt); err != nil {
				return err
			}
			out = append(out, sess)
		}
		return rows.Err()
	})
	return out, err
}

// GetRollingSummary 读取滚动摘要。
func (s *Store) GetRollingSummary(sessionID string) string {
	var summary string
	_ = s.withLock(func(db *sql.DB) error {
		return db.QueryRow(`SELECT rolling_summary FROM sessions WHERE id = ?`, sessionID).Scan(&summary)
	})
	return summary
}

// UpdateRollingSummary 更新滚动摘要。
func (s *Store) UpdateRollingSummary(sessionID, summary string) error {
	return s.withLock(func(db *sql.DB) error {
		_, err := db.Exec(`
UPDATE sessions SET rolling_summary = ?, updated_at = ? WHERE id = ?
`, summary, time.Now().Unix(), sessionID)
		return err
	})
}

// FindSnapByHash 按文本 hash 查重。
func (s *Store) FindSnapByHash(sessionID, hash string) (*model.SnapDO, error) {
	var snap model.SnapDO
	var conceptsRaw string
	err := s.withLock(func(db *sql.DB) error {
		err := db.QueryRow(`
SELECT id, session_id, title, ocr_text, summary, concepts_json, created_at
FROM snaps WHERE session_id = ? AND text_hash = ? ORDER BY created_at DESC LIMIT 1
`, sessionID, hash).Scan(&snap.ID, &snap.SessionID, &snap.Title, &snap.OCRText, &snap.Summary, &conceptsRaw, &snap.CreatedAt)
		if err != nil {
			return err
		}
		return json.Unmarshal([]byte(conceptsRaw), &snap.Concepts)
	})
	if err != nil {
		return nil, err
	}
	return &snap, nil
}

// InsertSnap 写入解读快照。
func (s *Store) InsertSnap(sessionID, title, ocrText, summary string, concepts []string, textHash string) (model.SnapDO, error) {
	now := time.Now().Unix()
	id := uuid.NewString()
	conceptsRaw, _ := json.Marshal(concepts)
	err := s.withLock(func(db *sql.DB) error {
		if _, err := db.Exec(`
INSERT INTO snaps(id, session_id, title, ocr_text, summary, concepts_json, text_hash, created_at)
VALUES(?, ?, ?, ?, ?, ?, ?, ?)
`, id, sessionID, title, ocrText, summary, string(conceptsRaw), textHash, now); err != nil {
			return err
		}
		_, err := db.Exec(`UPDATE sessions SET updated_at = ? WHERE id = ?`, now, sessionID)
		return err
	})
	if err != nil {
		return model.SnapDO{}, err
	}
	return model.SnapDO{
		ID: id, SessionID: sessionID, Title: title, OCRText: ocrText, Summary: summary,
		Concepts: concepts, CreatedAt: now,
	}, nil
}

// ListSnaps 列出会话快照。
func (s *Store) ListSnaps(sessionID string, limit int) ([]model.SnapDO, error) {
	if limit <= 0 {
		limit = 100
	}
	var out []model.SnapDO
	err := s.withLock(func(db *sql.DB) error {
		rows, err := db.Query(`
SELECT id, session_id, title, ocr_text, summary, concepts_json, created_at
FROM snaps WHERE session_id = ? ORDER BY created_at DESC LIMIT ?
`, sessionID, limit)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var snap model.SnapDO
			var conceptsRaw string
			if err := rows.Scan(&snap.ID, &snap.SessionID, &snap.Title, &snap.OCRText, &snap.Summary, &conceptsRaw, &snap.CreatedAt); err != nil {
				return err
			}
			_ = json.Unmarshal([]byte(conceptsRaw), &snap.Concepts)
			out = append(out, snap)
		}
		return rows.Err()
	})
	return out, err
}

const (
	defaultFontSize      = 15
	defaultLineHeight    = 1.75
	defaultFontFamily    = "system"
	defaultParagraphGap  = 12
)

var fontFamilyMap = map[string]string{
	"system": `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,
	"serif":  `'Songti SC', 'Noto Serif SC', STSong, serif`,
	"kai":    `'Kaiti SC', 'STKaiti', KaiTi, serif`,
	"sans":   `'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif`,
	"mono":   `ui-monospace, SFMono-Regular, Menlo, monospace`,
}

var layoutThemeSet = map[string]struct{}{
	"magazine": {}, "minimal": {}, "academic": {}, "terminal": {}, "card": {}, "brief": {},
}

func isLayoutTheme(v string) bool {
	_, ok := layoutThemeSet[v]
	return ok
}

// GetReaderSettings 读取侧栏阅读样式。
func (s *Store) GetReaderSettings() model.ReaderSettingsDO {
	raw := s.getSetting("reader.settings")
	if raw == "" {
		return model.ReaderSettingsDO{
			FontSize:     defaultFontSize,
			LineHeight:   defaultLineHeight,
			FontFamily:   defaultFontFamily,
			ParagraphGap: defaultParagraphGap,
			LayoutTheme:  "magazine",
		}
	}
	var st model.ReaderSettingsDO
	_ = json.Unmarshal([]byte(raw), &st)
	if st.FontSize < 8 || st.FontSize > 28 {
		st.FontSize = defaultFontSize
	}
	if st.LineHeight < 1.2 || st.LineHeight > 2.5 {
		st.LineHeight = defaultLineHeight
	}
	if _, ok := fontFamilyMap[st.FontFamily]; !ok {
		st.FontFamily = defaultFontFamily
	}
	if st.ParagraphGap < 4 || st.ParagraphGap > 28 {
		st.ParagraphGap = defaultParagraphGap
	}
	if !isLayoutTheme(st.LayoutTheme) {
		st.LayoutTheme = "magazine"
	}
	return st
}

// SaveReaderSettings 保存侧栏阅读样式。
func (s *Store) SaveReaderSettings(in model.ReaderSettingsDO) error {
	st := model.ReaderSettingsDO{
		FontSize:     in.FontSize,
		LineHeight:   in.LineHeight,
		FontFamily:   in.FontFamily,
		ParagraphGap: in.ParagraphGap,
		LayoutTheme:  in.LayoutTheme,
	}
	if st.FontSize < 8 {
		st.FontSize = 8
	}
	if st.FontSize > 28 {
		st.FontSize = 28
	}
	if st.LineHeight < 1.2 {
		st.LineHeight = 1.2
	}
	if st.LineHeight > 2.5 {
		st.LineHeight = 2.5
	}
	if _, ok := fontFamilyMap[st.FontFamily]; !ok {
		st.FontFamily = defaultFontFamily
	}
	if st.ParagraphGap < 4 {
		st.ParagraphGap = 4
	}
	if st.ParagraphGap > 28 {
		st.ParagraphGap = 28
	}
	if !isLayoutTheme(st.LayoutTheme) {
		st.LayoutTheme = "magazine"
	}
	raw, err := json.Marshal(st)
	if err != nil {
		return err
	}
	return s.setSetting("reader.settings", string(raw))
}

// ReaderFontFamilyCSS 将字体 key 转为 CSS font-family。
func ReaderFontFamilyCSS(key string) string {
	if v, ok := fontFamilyMap[key]; ok {
		return v
	}
	return fontFamilyMap[defaultFontFamily]
}

func (s *Store) defaultPromptSettings() model.PromptSettingsDO {
	id := uuid.NewString()
	return model.PromptSettingsDO{
		ActiveID: id,
		Templates: []model.PromptTemplateDO{{
			ID:           id,
			Name:         "默认伴读老师",
			SystemPrompt: agent.DefaultTeacherTemplate(),
		}},
	}
}

// GetPromptSettings 读取提示词模板配置。
func (s *Store) GetPromptSettings() model.PromptSettingsDO {
	raw := s.getSetting("prompt.settings")
	if raw == "" {
		def := s.defaultPromptSettings()
		_ = s.savePromptSettings(def)
		return def
	}
	var st model.PromptSettingsDO
	if err := json.Unmarshal([]byte(raw), &st); err != nil || len(st.Templates) == 0 {
		def := s.defaultPromptSettings()
		_ = s.savePromptSettings(def)
		return def
	}
	if !promptHasID(st.Templates, st.ActiveID) {
		st.ActiveID = st.Templates[0].ID
		_ = s.savePromptSettings(st)
	}
	return st
}

// GetActivePromptTemplate 返回当前选中模板的 system 提示词。
func (s *Store) GetActivePromptTemplate() string {
	st := s.GetPromptSettings()
	for _, tpl := range st.Templates {
		if tpl.ID == st.ActiveID {
			return tpl.SystemPrompt
		}
	}
	return st.Templates[0].SystemPrompt
}

// SavePromptTemplate 新建或更新模板。
func (s *Store) SavePromptTemplate(in model.PromptTemplateSaveDO) (model.PromptTemplateDO, error) {
	name := strings.TrimSpace(in.Name)
	body := strings.TrimSpace(in.SystemPrompt)
	if name == "" {
		return model.PromptTemplateDO{}, fmt.Errorf("请填写模板名称")
	}
	if body == "" {
		return model.PromptTemplateDO{}, fmt.Errorf("请填写提示词内容")
	}
	st := s.GetPromptSettings()
	id := strings.TrimSpace(in.ID)
	if id == "" {
		id = uuid.NewString()
		st.Templates = append(st.Templates, model.PromptTemplateDO{
			ID: id, Name: name, SystemPrompt: body,
		})
		st.ActiveID = id
	} else {
		found := false
		for i, tpl := range st.Templates {
			if tpl.ID == id {
				st.Templates[i].Name = name
				st.Templates[i].SystemPrompt = body
				found = true
				break
			}
		}
		if !found {
			return model.PromptTemplateDO{}, fmt.Errorf("模板不存在")
		}
	}
	if err := s.savePromptSettings(st); err != nil {
		return model.PromptTemplateDO{}, err
	}
	for _, tpl := range st.Templates {
		if tpl.ID == id {
			return tpl, nil
		}
	}
	return model.PromptTemplateDO{}, fmt.Errorf("保存失败")
}

// DeletePromptTemplate 删除模板。
func (s *Store) DeletePromptTemplate(id string) error {
	id = strings.TrimSpace(id)
	if id == "" {
		return fmt.Errorf("模板不存在")
	}
	st := s.GetPromptSettings()
	if len(st.Templates) <= 1 {
		return fmt.Errorf("至少保留一个模板")
	}
	next := make([]model.PromptTemplateDO, 0, len(st.Templates)-1)
	for _, tpl := range st.Templates {
		if tpl.ID != id {
			next = append(next, tpl)
		}
	}
	if len(next) == len(st.Templates) {
		return fmt.Errorf("模板不存在")
	}
	st.Templates = next
	if st.ActiveID == id {
		st.ActiveID = st.Templates[0].ID
	}
	return s.savePromptSettings(st)
}

// SetActivePromptTemplate 切换当前模板。
func (s *Store) SetActivePromptTemplate(id string) error {
	id = strings.TrimSpace(id)
	st := s.GetPromptSettings()
	if !promptHasID(st.Templates, id) {
		return fmt.Errorf("模板不存在")
	}
	st.ActiveID = id
	return s.savePromptSettings(st)
}

// ResetPromptTemplates 恢复默认模板。
func (s *Store) ResetPromptTemplates() model.PromptSettingsDO {
	def := s.defaultPromptSettings()
	_ = s.savePromptSettings(def)
	return def
}

func (s *Store) savePromptSettings(st model.PromptSettingsDO) error {
	raw, err := json.Marshal(st)
	if err != nil {
		return err
	}
	return s.setSetting("prompt.settings", string(raw))
}

func promptHasID(templates []model.PromptTemplateDO, id string) bool {
	for _, tpl := range templates {
		if tpl.ID == id {
			return true
		}
	}
	return false
}

func fallback(v, def string) string {
	if strings.TrimSpace(v) == "" {
		return def
	}
	return v
}
