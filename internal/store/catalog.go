package store

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"wread/internal/model"

	"github.com/google/uuid"
)

const (
	catalogKindChapter = "chapter"
	catalogKindPage    = "page"
)

func (s *Store) migrateCatalogLocked(db *sql.DB) error {
	if !s.catalogHasKindColumn(db) {
		_, _ = db.Exec(`DROP TABLE IF EXISTS catalog_nodes`)
	}
	_, err := db.Exec(`
CREATE TABLE IF NOT EXISTS catalog_nodes (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  parent_id TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'chapter',
  title TEXT NOT NULL,
  snap_id TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(session_id) REFERENCES sessions(id)
);
CREATE INDEX IF NOT EXISTS idx_catalog_session ON catalog_nodes(session_id, parent_id, sort_order);
`)
	return err
}

func (s *Store) catalogHasKindColumn(db *sql.DB) bool {
	rows, err := db.Query(`PRAGMA table_info(catalog_nodes)`)
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
		if name == "kind" {
			return true
		}
	}
	return false
}

// GetCatalogSettings 读取目录入库方式。
func (s *Store) GetCatalogSettings() model.CatalogSettingsDO {
	v := s.getSetting("catalog.auto_add")
	if v == "" {
		return model.CatalogSettingsDO{AutoAdd: true}
	}
	return model.CatalogSettingsDO{AutoAdd: v == "1"}
}

// SetCatalogAutoAdd 切换自动/手动归入章节。
func (s *Store) SetCatalogAutoAdd(auto bool) error {
	v := "0"
	if auto {
		v = "1"
	}
	return s.setSetting("catalog.auto_add", v)
}

// GetCatalogInsertParent 当前选中章节 ID。
func (s *Store) GetCatalogInsertParent() string {
	return s.getSetting("catalog.insert_parent")
}

// SetCatalogInsertParent 设置当前选中章节。
func (s *Store) SetCatalogInsertParent(chapterID string) error {
	chapterID = strings.TrimSpace(chapterID)
	if chapterID == "" {
		return s.setSetting("catalog.insert_parent", "")
	}
	return s.withLock(func(db *sql.DB) error {
		var sessID string
		_ = db.QueryRow(`SELECT value FROM settings WHERE key = ?`, "session.active_id").Scan(&sessID)
		if sessID == "" {
			return fmt.Errorf("请先选择有效章节")
		}
		if _, err := s.getChapterNodeLocked(db, sessID, chapterID); err != nil {
			return fmt.Errorf("请先选择有效章节")
		}
		_, err := db.Exec(`
INSERT INTO settings(key, value) VALUES(?, ?)
ON CONFLICT(key) DO UPDATE SET value = excluded.value
`, "catalog.insert_parent", chapterID)
		return err
	})
}

// ListCatalogNodes 列出章节树（平铺）。
func (s *Store) ListCatalogNodes(sessionID string) ([]model.CatalogNodeDO, error) {
	var out []model.CatalogNodeDO
	err := s.withLock(func(db *sql.DB) error {
		list, err := s.listCatalogNodesLocked(db, sessionID)
		if err != nil {
			return err
		}
		out = list
		return nil
	})
	return out, err
}

// CreateChapter 新建章节（可嵌套子章节）。
func (s *Store) CreateChapter(sessionID, parentID, title string) (model.CatalogNodeDO, error) {
	parentID = strings.TrimSpace(parentID)
	title = strings.TrimSpace(title)
	if title == "" {
		title = "新章节"
	}
	var out model.CatalogNodeDO
	err := s.withLock(func(db *sql.DB) error {
		if parentID != "" {
			if _, err := s.getChapterNodeLocked(db, sessionID, parentID); err != nil {
				return fmt.Errorf("父级必须是章节")
			}
		}
		sortOrder, err := s.nextCatalogSortLocked(db, sessionID, parentID)
		if err != nil {
			return err
		}
		now := time.Now().Unix()
		id := uuid.NewString()
		if _, err := db.Exec(`
INSERT INTO catalog_nodes(id, session_id, parent_id, kind, title, snap_id, sort_order, created_at)
VALUES(?, ?, ?, ?, ?, '', ?, ?)
`, id, sessionID, parentID, catalogKindChapter, title, sortOrder, now); err != nil {
			return err
		}
		out = model.CatalogNodeDO{
			ID: id, SessionID: sessionID, ParentID: parentID,
			Kind: catalogKindChapter, Title: title, SortOrder: sortOrder,
		}
		return nil
	})
	return out, err
}

// AddPageToChapter 将解读页归入指定章节。
func (s *Store) AddPageToChapter(sessionID, chapterID, snapID, title string) (model.CatalogNodeDO, error) {
	chapterID = strings.TrimSpace(chapterID)
	title = strings.TrimSpace(title)
	if chapterID == "" {
		return model.CatalogNodeDO{}, fmt.Errorf("请先选择章节")
	}
	if snapID == "" {
		return model.CatalogNodeDO{}, fmt.Errorf("缺少解读页")
	}
	var out model.CatalogNodeDO
	err := s.withLock(func(db *sql.DB) error {
		if _, err := s.getChapterNodeLocked(db, sessionID, chapterID); err != nil {
			return fmt.Errorf("请先选择有效章节")
		}
		var dup model.CatalogNodeDO
		err := db.QueryRow(`
SELECT id, session_id, parent_id, kind, title, snap_id, sort_order
FROM catalog_nodes WHERE session_id = ? AND snap_id = ? LIMIT 1
`, sessionID, snapID).Scan(&dup.ID, &dup.SessionID, &dup.ParentID, &dup.Kind, &dup.Title, &dup.SnapID, &dup.SortOrder)
		if err == nil {
			out = dup
			return nil
		}
		if err != sql.ErrNoRows {
			return err
		}
		if title == "" {
			title = "未命名"
		}
		sortOrder, err := s.nextCatalogSortLocked(db, sessionID, chapterID)
		if err != nil {
			return err
		}
		now := time.Now().Unix()
		id := uuid.NewString()
		if _, err := db.Exec(`
INSERT INTO catalog_nodes(id, session_id, parent_id, kind, title, snap_id, sort_order, created_at)
VALUES(?, ?, ?, ?, ?, ?, ?, ?)
`, id, sessionID, chapterID, catalogKindPage, title, snapID, sortOrder, now); err != nil {
			return err
		}
		out = model.CatalogNodeDO{
			ID: id, SessionID: sessionID, ParentID: chapterID,
			Kind: catalogKindPage, Title: title, SnapID: snapID, SortOrder: sortOrder,
		}
		return nil
	})
	return out, err
}

// ResolveChapterID 将任意节点 ID 解析为所属章节 ID。
func (s *Store) ResolveChapterID(sessionID, nodeID string) (string, error) {
	nodeID = strings.TrimSpace(nodeID)
	if nodeID == "" {
		return "", fmt.Errorf("请先选择章节")
	}
	var chapterID string
	err := s.withLock(func(db *sql.DB) error {
		all, err := s.listCatalogNodesLocked(db, sessionID)
		if err != nil {
			return err
		}
		byID := map[string]model.CatalogNodeDO{}
		for _, n := range all {
			byID[n.ID] = n
		}
		cur, ok := byID[nodeID]
		if !ok {
			return fmt.Errorf("章节不存在")
		}
		for {
			if cur.Kind == catalogKindChapter {
				chapterID = cur.ID
				return nil
			}
			if cur.ParentID == "" {
				return fmt.Errorf("请先选择章节")
			}
			next, ok := byID[cur.ParentID]
			if !ok {
				return fmt.Errorf("请先选择章节")
			}
			cur = next
		}
	})
	return chapterID, err
}

// FindCatalogBySnap 查找 snap 是否已归入章节。
func (s *Store) FindCatalogBySnap(sessionID, snapID string) (*model.CatalogNodeDO, error) {
	var n model.CatalogNodeDO
	err := s.withLock(func(db *sql.DB) error {
		return db.QueryRow(`
SELECT id, session_id, parent_id, kind, title, snap_id, sort_order
FROM catalog_nodes WHERE session_id = ? AND snap_id = ? LIMIT 1
`, sessionID, snapID).Scan(&n.ID, &n.SessionID, &n.ParentID, &n.Kind, &n.Title, &n.SnapID, &n.SortOrder)
	})
	if err != nil {
		return nil, err
	}
	return &n, nil
}

// UpdateCatalogNode 更新章节或笔记页标题。
func (s *Store) UpdateCatalogNode(in model.CatalogNodeSaveDO) (model.CatalogNodeDO, error) {
	id := strings.TrimSpace(in.ID)
	title := strings.TrimSpace(in.Title)
	parentID := strings.TrimSpace(in.ParentID)
	if id == "" {
		return model.CatalogNodeDO{}, fmt.Errorf("节点不存在")
	}
	if title == "" {
		return model.CatalogNodeDO{}, fmt.Errorf("请填写标题")
	}
	var out model.CatalogNodeDO
	err := s.withLock(func(db *sql.DB) error {
		var kind, snapID string
		err := db.QueryRow(`
SELECT kind, snap_id FROM catalog_nodes WHERE id = ?
`, id).Scan(&kind, &snapID)
		if err != nil {
			return fmt.Errorf("节点不存在")
		}
		if kind == catalogKindPage {
			parentID = strings.TrimSpace(in.ParentID)
		}
		res, err := db.Exec(`
UPDATE catalog_nodes SET title = ?, parent_id = ? WHERE id = ?
`, title, parentID, id)
		if err != nil {
			return err
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			return fmt.Errorf("节点不存在")
		}
		return db.QueryRow(`
SELECT id, session_id, parent_id, kind, title, snap_id, sort_order FROM catalog_nodes WHERE id = ?
`, id).Scan(&out.ID, &out.SessionID, &out.ParentID, &out.Kind, &out.Title, &out.SnapID, &out.SortOrder)
	})
	return out, err
}

// MoveCatalogNode 移动节点到指定父级下的排序位置（index 为同级序号，从 0 起）。
func (s *Store) MoveCatalogNode(sessionID, nodeID, parentID string, index int) error {
	nodeID = strings.TrimSpace(nodeID)
	parentID = strings.TrimSpace(parentID)
	if nodeID == "" {
		return fmt.Errorf("节点不存在")
	}
	if index < 0 {
		index = 0
	}
	return s.withLock(func(db *sql.DB) error {
		all, err := s.listCatalogNodesLocked(db, sessionID)
		if err != nil {
			return err
		}
		node, ok := findCatalogNode(all, nodeID)
		if !ok {
			return fmt.Errorf("节点不存在")
		}
		if node.Kind == catalogKindChapter {
			if parentID == nodeID {
				return fmt.Errorf("不能移动到自身")
			}
			if parentID != "" {
				if _, err := s.getChapterNodeLocked(db, sessionID, parentID); err != nil {
					return fmt.Errorf("父级必须是章节")
				}
				if catalogIsDescendant(all, nodeID, parentID) {
					return fmt.Errorf("不能移动到子章节下")
				}
			}
		} else {
			if parentID == "" {
				return fmt.Errorf("笔记页必须归入章节")
			}
			if _, err := s.getChapterNodeLocked(db, sessionID, parentID); err != nil {
				return fmt.Errorf("请先选择有效章节")
			}
		}
		siblings := catalogSiblingIDs(all, parentID, nodeID)
		if index > len(siblings) {
			index = len(siblings)
		}
		order := append([]string{}, siblings[:index]...)
		order = append(order, nodeID)
		order = append(order, siblings[index:]...)
		for i, id := range order {
			if id == nodeID {
				if _, err := db.Exec(`
UPDATE catalog_nodes SET sort_order = ?, parent_id = ? WHERE id = ? AND session_id = ?
`, i, parentID, id, sessionID); err != nil {
					return err
				}
				continue
			}
			if _, err := db.Exec(`
UPDATE catalog_nodes SET sort_order = ? WHERE id = ? AND session_id = ?
`, i, id, sessionID); err != nil {
				return err
			}
		}
		return nil
	})
}

func catalogSiblingIDs(all []model.CatalogNodeDO, parentID, excludeID string) []string {
	var list []model.CatalogNodeDO
	for _, n := range all {
		if n.ParentID == parentID && n.ID != excludeID {
			list = append(list, n)
		}
	}
	sort.Slice(list, func(i, j int) bool {
		if list[i].SortOrder != list[j].SortOrder {
			return list[i].SortOrder < list[j].SortOrder
		}
		return list[i].ID < list[j].ID
	})
	ids := make([]string, len(list))
	for i, n := range list {
		ids[i] = n.ID
	}
	return ids
}

func catalogIsDescendant(all []model.CatalogNodeDO, ancestorID, nodeID string) bool {
	if ancestorID == "" || nodeID == "" {
		return false
	}
	byID := map[string]model.CatalogNodeDO{}
	for _, n := range all {
		byID[n.ID] = n
	}
	cur, ok := byID[nodeID]
	for ok {
		if cur.ParentID == ancestorID {
			return true
		}
		if cur.ParentID == "" {
			return false
		}
		cur, ok = byID[cur.ParentID]
	}
	return false
}

// DeleteCatalogNode 删除章节或笔记页（章节含子树）。
func (s *Store) DeleteCatalogNode(sessionID, id string) error {
	id = strings.TrimSpace(id)
	if id == "" {
		return fmt.Errorf("节点不存在")
	}
	return s.withLock(func(db *sql.DB) error {
		all, err := s.listCatalogNodesLocked(db, sessionID)
		if err != nil {
			return err
		}
		node, ok := findCatalogNode(all, id)
		if !ok {
			return fmt.Errorf("节点不存在")
		}
		byID := map[string]model.CatalogNodeDO{}
		for _, n := range all {
			byID[n.ID] = n
		}
		ids := []string{id}
		if node.Kind == catalogKindChapter {
			ids = collectCatalogSubtree(all, id)
		}
		for _, nodeID := range ids {
			if n, ok := byID[nodeID]; ok && n.Kind == catalogKindPage && n.SnapID != "" {
				if _, err := db.Exec(`DELETE FROM snaps WHERE id = ? AND session_id = ?`, n.SnapID, sessionID); err != nil {
					return err
				}
			}
			if _, err := db.Exec(`DELETE FROM catalog_nodes WHERE id = ? AND session_id = ?`, nodeID, sessionID); err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *Store) GetChapterNode(sessionID, id string) (model.CatalogNodeDO, error) {
	var out model.CatalogNodeDO
	err := s.withLock(func(db *sql.DB) error {
		node, err := s.getChapterNodeLocked(db, sessionID, id)
		if err != nil {
			return err
		}
		out = node
		return nil
	})
	return out, err
}

func (s *Store) getChapterNodeLocked(db *sql.DB, sessionID, id string) (model.CatalogNodeDO, error) {
	var n model.CatalogNodeDO
	err := db.QueryRow(`
SELECT id, session_id, parent_id, kind, title, snap_id, sort_order
FROM catalog_nodes WHERE id = ? AND session_id = ?
`, id, sessionID).Scan(&n.ID, &n.SessionID, &n.ParentID, &n.Kind, &n.Title, &n.SnapID, &n.SortOrder)
	if err != nil {
		return model.CatalogNodeDO{}, err
	}
	if n.Kind != catalogKindChapter {
		return model.CatalogNodeDO{}, fmt.Errorf("不是章节")
	}
	return n, nil
}

func (s *Store) nextCatalogSortLocked(db *sql.DB, sessionID, parentID string) (int, error) {
	var maxSort sql.NullInt64
	err := db.QueryRow(`
SELECT MAX(sort_order) FROM catalog_nodes WHERE session_id = ? AND parent_id = ?
`, sessionID, parentID).Scan(&maxSort)
	if err != nil {
		return 0, err
	}
	if maxSort.Valid {
		return int(maxSort.Int64) + 1, nil
	}
	return 0, nil
}

func (s *Store) listCatalogNodesLocked(db *sql.DB, sessionID string) ([]model.CatalogNodeDO, error) {
	rows, err := db.Query(`
SELECT id, session_id, parent_id, kind, title, snap_id, sort_order
FROM catalog_nodes WHERE session_id = ? ORDER BY sort_order ASC, created_at ASC
`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []model.CatalogNodeDO
	for rows.Next() {
		var n model.CatalogNodeDO
		if err := rows.Scan(&n.ID, &n.SessionID, &n.ParentID, &n.Kind, &n.Title, &n.SnapID, &n.SortOrder); err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, rows.Err()
}

func findCatalogNode(all []model.CatalogNodeDO, id string) (model.CatalogNodeDO, bool) {
	for _, n := range all {
		if n.ID == id {
			return n, true
		}
	}
	return model.CatalogNodeDO{}, false
}

func collectCatalogSubtree(all []model.CatalogNodeDO, rootID string) []string {
	byParent := map[string][]string{}
	found := false
	for _, n := range all {
		if n.ID == rootID {
			found = true
		}
		byParent[n.ParentID] = append(byParent[n.ParentID], n.ID)
	}
	if !found {
		return nil
	}
	var out []string
	var walk func(string)
	walk = func(nodeID string) {
		out = append(out, nodeID)
		for _, child := range byParent[nodeID] {
			walk(child)
		}
	}
	walk(rootID)
	return out
}

// GetSnap 读取解读快照。
func (s *Store) GetSnap(id string) (model.SnapDO, error) {
	var snap model.SnapDO
	var conceptsRaw string
	err := s.withLock(func(db *sql.DB) error {
		err := db.QueryRow(`
SELECT id, session_id, title, ocr_text, summary, concepts_json, capture_preview, created_at
FROM snaps WHERE id = ?
`, id).Scan(&snap.ID, &snap.SessionID, &snap.Title, &snap.OCRText, &snap.Summary, &conceptsRaw, &snap.CapturePreview, &snap.CreatedAt)
		if err != nil {
			return err
		}
		return json.Unmarshal([]byte(conceptsRaw), &snap.Concepts)
	})
	return snap, err
}

// UpdateSnapSummary 更新解读正文（追问合并到同一页）。
func (s *Store) UpdateSnapSummary(id, summary string) error {
	return s.withLock(func(db *sql.DB) error {
		_, err := db.Exec(`UPDATE snaps SET summary = ? WHERE id = ?`, summary, id)
		return err
	})
}
