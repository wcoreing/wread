package store

import (
	"database/sql"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"wread/internal/model"

	"github.com/google/uuid"
)

// CollectPagesByIDs 按目录顺序收集指定笔记页。
func (s *Store) CollectPagesByIDs(sessionID string, pageIDs []string) ([]model.CatalogNodeDO, error) {
	var out []model.CatalogNodeDO
	err := s.withLock(func(db *sql.DB) error {
		all, err := s.listCatalogNodesLocked(db, sessionID)
		if err != nil {
			return err
		}
		out = collectPagesByIDsOrdered(all, pageIDs)
		if len(out) < 2 {
			return fmt.Errorf("至少选择 2 页笔记")
		}
		want := map[string]struct{}{}
		for _, id := range pageIDs {
			id = strings.TrimSpace(id)
			if id != "" {
				want[id] = struct{}{}
			}
		}
		if len(out) != len(want) {
			return fmt.Errorf("部分笔记页不存在")
		}
		return nil
	})
	return out, err
}

// CollectScopePages 收集分章范围内的笔记页（按目录阅读顺序）。
func (s *Store) CollectScopePages(sessionID, scopeParentID string) ([]model.CatalogNodeDO, error) {
	scopeParentID = strings.TrimSpace(scopeParentID)
	var out []model.CatalogNodeDO
	err := s.withLock(func(db *sql.DB) error {
		all, err := s.listCatalogNodesLocked(db, sessionID)
		if err != nil {
			return err
		}
		if scopeParentID != "" {
			if _, err := s.getChapterNodeLocked(db, sessionID, scopeParentID); err != nil {
				return fmt.Errorf("章节不存在")
			}
		}
		out = collectScopePagesOrdered(all, scopeParentID)
		return nil
	})
	return out, err
}

// ApplyCatalogOrganizePages 对选中的笔记页应用 AI 分章方案。
func (s *Store) ApplyCatalogOrganizePages(sessionID string, pageIDs []string, plan model.CatalogOrganizePlanDO) error {
	return s.withLock(func(db *sql.DB) error {
		all, err := s.listCatalogNodesLocked(db, sessionID)
		if err != nil {
			return err
		}
		scopePages := collectPagesByIDsOrdered(all, pageIDs)
		if len(scopePages) < 2 {
			return fmt.Errorf("至少选择 2 页笔记")
		}
		scopeIDs := make([]string, len(scopePages))
		for i, p := range scopePages {
			scopeIDs[i] = p.ID
		}
		if err := validateOrganizePlan(scopeIDs, plan); err != nil {
			return err
		}
		scopeParent := resolveOrganizeScopeParent(all, scopeIDs)

		flattenParent := scopeParent
		var tempID string
		if scopeParent == "" {
			temp, err := s.createChapterLocked(db, sessionID, "", "…")
			if err != nil {
				return err
			}
			tempID = temp.ID
			flattenParent = tempID
		}

		for i, pageID := range scopeIDs {
			all, err = s.listCatalogNodesLocked(db, sessionID)
			if err != nil {
				return err
			}
			if err := s.moveCatalogNodeLocked(db, sessionID, all, pageID, flattenParent, i); err != nil {
				return err
			}
		}

		if err := cleanupEmptyChaptersLocked(db, sessionID); err != nil {
			return err
		}

		if err := applyOrganizeChapterPlanLocked(db, s, sessionID, scopeParent, plan.Chapters); err != nil {
			return err
		}
		if tempID != "" {
			all, err = s.listCatalogNodesLocked(db, sessionID)
			if err != nil {
				return err
			}
			if err := s.deleteCatalogNodeLocked(db, sessionID, all, tempID); err != nil {
				return err
			}
		}
		return cleanupEmptyChaptersLocked(db, sessionID)
	})
}

// ApplyCatalogOrganizePlan 在指定范围内应用 AI 分章方案。
func (s *Store) ApplyCatalogOrganizePlan(sessionID, scopeParentID string, plan model.CatalogOrganizePlanDO) error {
	scopeParentID = strings.TrimSpace(scopeParentID)
	return s.withLock(func(db *sql.DB) error {
		all, err := s.listCatalogNodesLocked(db, sessionID)
		if err != nil {
			return err
		}
		if scopeParentID != "" {
			if _, err := s.getChapterNodeLocked(db, sessionID, scopeParentID); err != nil {
				return fmt.Errorf("章节不存在")
			}
		}
		scopePages := collectScopePagesOrdered(all, scopeParentID)
		if len(scopePages) < 2 {
			return fmt.Errorf("至少需要 2 页笔记")
		}
		scopeIDs := make([]string, len(scopePages))
		for i, p := range scopePages {
			scopeIDs[i] = p.ID
		}
		if err := validateOrganizePlan(scopeIDs, plan); err != nil {
			return err
		}

		flattenParent := scopeParentID
		var tempID string
		if scopeParentID == "" {
			temp, err := s.createChapterLocked(db, sessionID, "", "…")
			if err != nil {
				return err
			}
			tempID = temp.ID
			flattenParent = tempID
		}

		for i, pageID := range scopeIDs {
			all, err = s.listCatalogNodesLocked(db, sessionID)
			if err != nil {
				return err
			}
			if err := s.moveCatalogNodeLocked(db, sessionID, all, pageID, flattenParent, i); err != nil {
				return err
			}
		}

		all, err = s.listCatalogNodesLocked(db, sessionID)
		if err != nil {
			return err
		}
		chapterIDs := collectDescendantChapterIDs(all, scopeParentID)
		if tempID != "" {
			filtered := chapterIDs[:0]
			for _, id := range chapterIDs {
				if id != tempID {
					filtered = append(filtered, id)
				}
			}
			chapterIDs = filtered
		}
		sort.Slice(chapterIDs, func(i, j int) bool {
			return catalogNodeDepth(all, chapterIDs[i]) > catalogNodeDepth(all, chapterIDs[j])
		})
		for _, chID := range chapterIDs {
			if err := s.deleteCatalogNodeLocked(db, sessionID, all, chID); err != nil {
				return err
			}
			all, err = s.listCatalogNodesLocked(db, sessionID)
			if err != nil {
				return err
			}
		}

		if err := applyOrganizeChapterPlanLocked(db, s, sessionID, scopeParentID, plan.Chapters); err != nil {
			return err
		}
		if tempID != "" {
			all, err = s.listCatalogNodesLocked(db, sessionID)
			if err != nil {
				return err
			}
			if err := s.deleteCatalogNodeLocked(db, sessionID, all, tempID); err != nil {
				return err
			}
		}
		return nil
	})
}

// collectPagesByIDsOrdered 按目录 DFS 顺序收集指定 page 节点。
func collectPagesByIDsOrdered(all []model.CatalogNodeDO, pageIDs []string) []model.CatalogNodeDO {
	want := map[string]struct{}{}
	for _, id := range pageIDs {
		id = strings.TrimSpace(id)
		if id != "" {
			want[id] = struct{}{}
		}
	}
	var pages []model.CatalogNodeDO
	byParent := map[string][]model.CatalogNodeDO{}
	for _, n := range all {
		byParent[n.ParentID] = append(byParent[n.ParentID], n)
	}
	for pid := range byParent {
		sort.Slice(byParent[pid], func(i, j int) bool {
			a, b := byParent[pid][i], byParent[pid][j]
			if a.SortOrder != b.SortOrder {
				return a.SortOrder < b.SortOrder
			}
			return a.ID < b.ID
		})
	}
	var walk func(string)
	walk = func(nodeID string) {
		n, ok := findCatalogNode(all, nodeID)
		if !ok {
			return
		}
		if n.Kind == catalogKindPage {
			if _, ok := want[n.ID]; ok {
				pages = append(pages, n)
			}
			return
		}
		for _, child := range byParent[n.ID] {
			walk(child.ID)
		}
	}
	for _, n := range byParent[""] {
		walk(n.ID)
	}
	return pages
}

// resolveOrganizeScopeParent 求选中页在目录树中的最近公共章节祖先。
func resolveOrganizeScopeParent(all []model.CatalogNodeDO, pageIDs []string) string {
	if len(pageIDs) == 0 {
		return ""
	}
	byID := map[string]model.CatalogNodeDO{}
	for _, n := range all {
		byID[n.ID] = n
	}
	chains := make([][]string, 0, len(pageIDs))
	for _, pageID := range pageIDs {
		cur, ok := byID[pageID]
		if !ok {
			continue
		}
		var chain []string
		for cur.ParentID != "" {
			parent, ok := byID[cur.ParentID]
			if !ok {
				break
			}
			if parent.Kind == catalogKindChapter {
				chain = append([]string{parent.ID}, chain...)
			}
			cur = parent
		}
		chains = append(chains, chain)
	}
	if len(chains) == 0 {
		return ""
	}
	lca := ""
	for depth := 0; ; depth++ {
		var id string
		for _, chain := range chains {
			if depth >= len(chain) {
				return lca
			}
			if id == "" {
				id = chain[depth]
			} else if id != chain[depth] {
				return lca
			}
		}
		lca = id
	}
}

func cleanupEmptyChaptersLocked(db *sql.DB, sessionID string) error {
	for {
		rows, err := db.Query(`
SELECT c.id FROM catalog_nodes c
WHERE c.session_id = ? AND c.kind = ?
AND NOT EXISTS (SELECT 1 FROM catalog_nodes x WHERE x.session_id = c.session_id AND x.parent_id = c.id)
`, sessionID, catalogKindChapter)
		if err != nil {
			return err
		}
		var ids []string
		for rows.Next() {
			var id string
			if err := rows.Scan(&id); err != nil {
				rows.Close()
				return err
			}
			ids = append(ids, id)
		}
		rows.Close()
		if len(ids) == 0 {
			return nil
		}
		for _, id := range ids {
			if _, err := db.Exec(`DELETE FROM catalog_nodes WHERE id = ? AND session_id = ?`, id, sessionID); err != nil {
				return err
			}
		}
	}
}

// DedupeOrganizePlan 去掉方案中重复分配的 page id（保留首次出现）。
func DedupeOrganizePlan(plan model.CatalogOrganizePlanDO) model.CatalogOrganizePlanDO {
	seen := map[string]struct{}{}
	var walk func(*[]model.CatalogOrganizeChapterDO)
	walk = func(chs *[]model.CatalogOrganizeChapterDO) {
		for i := range *chs {
			ch := &(*chs)[i]
			filtered := ch.PageIDs[:0]
			for _, raw := range ch.PageIDs {
				id := strings.TrimSpace(raw)
				if id == "" {
					continue
				}
				if _, dup := seen[id]; dup {
					continue
				}
				seen[id] = struct{}{}
				filtered = append(filtered, id)
			}
			ch.PageIDs = filtered
			walk(&ch.Children)
		}
	}
	walk(&plan.Chapters)
	return plan
}

// collectScopePagesOrdered 按目录 DFS 顺序收集范围内的 page 节点。
func collectScopePagesOrdered(all []model.CatalogNodeDO, scopeParentID string) []model.CatalogNodeDO {
	byParent := map[string][]model.CatalogNodeDO{}
	for _, n := range all {
		byParent[n.ParentID] = append(byParent[n.ParentID], n)
	}
	for pid := range byParent {
		sort.Slice(byParent[pid], func(i, j int) bool {
			a, b := byParent[pid][i], byParent[pid][j]
			if a.SortOrder != b.SortOrder {
				return a.SortOrder < b.SortOrder
			}
			return a.ID < b.ID
		})
	}
	var pages []model.CatalogNodeDO
	var walk func(string)
	walk = func(nodeID string) {
		n, ok := findCatalogNode(all, nodeID)
		if !ok {
			return
		}
		if n.Kind == catalogKindPage {
			pages = append(pages, n)
			return
		}
		for _, child := range byParent[n.ID] {
			walk(child.ID)
		}
	}
	for _, n := range byParent[scopeParentID] {
		walk(n.ID)
	}
	return pages
}

// collectDescendantChapterIDs 收集范围下所有章节 ID（不含 scope 自身）。
func collectDescendantChapterIDs(all []model.CatalogNodeDO, scopeParentID string) []string {
	byParent := map[string][]model.CatalogNodeDO{}
	for _, n := range all {
		byParent[n.ParentID] = append(byParent[n.ParentID], n)
	}
	var ids []string
	var walk func(string)
	walk = func(parentID string) {
		for _, n := range byParent[parentID] {
			if n.Kind != catalogKindChapter {
				continue
			}
			ids = append(ids, n.ID)
			walk(n.ID)
		}
	}
	walk(scopeParentID)
	return ids
}

func catalogNodeDepth(all []model.CatalogNodeDO, nodeID string) int {
	byID := map[string]model.CatalogNodeDO{}
	for _, n := range all {
		byID[n.ID] = n
	}
	depth := 0
	cur, ok := byID[nodeID]
	for ok && cur.ParentID != "" {
		depth++
		cur, ok = byID[cur.ParentID]
	}
	return depth
}

// BindOrganizePlanPages 按方案结构绑定选中页 id（忽略 AI 返回的 id）。
func BindOrganizePlanPages(pages []model.CatalogOrganizePageDO, plan model.CatalogOrganizePlanDO) (model.CatalogOrganizePlanDO, error) {
	expandOrganizePlanSlots(&plan)
	slots := countOrganizePlanSlots(plan.Chapters)
	if slots == 0 {
		return plan, fmt.Errorf("AI 未分配任何页面")
	}
	if slots != len(pages) {
		resizeOrganizePlanSlots(&plan, len(pages))
	}
	idx := 0
	var bind func([]model.CatalogOrganizeChapterDO) []model.CatalogOrganizeChapterDO
	bind = func(chs []model.CatalogOrganizeChapterDO) []model.CatalogOrganizeChapterDO {
		out := make([]model.CatalogOrganizeChapterDO, len(chs))
		for i, ch := range chs {
			out[i] = ch
			out[i].PageIDs = make([]string, len(ch.PageIDs))
			for j := range ch.PageIDs {
				if idx < len(pages) {
					out[i].PageIDs[j] = pages[idx].ID
					idx++
				}
			}
			out[i].PageIndexes = nil
			out[i].Children = bind(ch.Children)
		}
		return out
	}
	plan.Chapters = bind(plan.Chapters)
	for idx < len(pages) {
		if !appendOrganizePlanPage(&plan, pages[idx].ID) {
			return plan, fmt.Errorf("AI 方案结构无效")
		}
		idx++
	}
	return plan, nil
}

func expandOrganizePlanSlots(plan *model.CatalogOrganizePlanDO) {
	var walk func(*[]model.CatalogOrganizeChapterDO)
	walk = func(chs *[]model.CatalogOrganizeChapterDO) {
		for i := range *chs {
			ch := &(*chs)[i]
			if len(ch.PageIDs) == 0 && len(ch.PageIndexes) > 0 {
				ch.PageIDs = make([]string, len(ch.PageIndexes))
			}
			walk(&ch.Children)
		}
	}
	walk(&plan.Chapters)
}

func countOrganizePlanSlots(chs []model.CatalogOrganizeChapterDO) int {
	n := 0
	for _, ch := range chs {
		n += len(ch.PageIDs)
		n += countOrganizePlanSlots(ch.Children)
	}
	return n
}

func resizeOrganizePlanSlots(plan *model.CatalogOrganizePlanDO, target int) {
	cur := countOrganizePlanSlots(plan.Chapters)
	if cur == target {
		return
	}
	if cur < target {
		addOrganizePlanSlots(&plan.Chapters, target-cur)
		return
	}
	removeOrganizePlanSlots(&plan.Chapters, cur-target)
}

func addOrganizePlanSlots(chs *[]model.CatalogOrganizeChapterDO, n int) {
	if len(*chs) == 0 {
		*chs = []model.CatalogOrganizeChapterDO{{Title: "新章节", PageIDs: make([]string, n)}}
		return
	}
	last := &(*chs)[len(*chs)-1]
	last.PageIDs = append(last.PageIDs, make([]string, n)...)
}

func removeOrganizePlanSlots(chs *[]model.CatalogOrganizeChapterDO, n int) {
	for n > 0 && len(*chs) > 0 {
		last := &(*chs)[len(*chs)-1]
		if len(last.PageIDs) > n {
			last.PageIDs = last.PageIDs[:len(last.PageIDs)-n]
			return
		}
		n -= len(last.PageIDs)
		last.PageIDs = nil
		if len(last.Children) > 0 {
			removeOrganizePlanSlots(&last.Children, n)
			return
		}
		*chs = (*chs)[:len(*chs)-1]
	}
}

func appendOrganizePlanPage(plan *model.CatalogOrganizePlanDO, pageID string) bool {
	if len(plan.Chapters) == 0 {
		plan.Chapters = []model.CatalogOrganizeChapterDO{{Title: "新章节", PageIDs: []string{pageID}}}
		return true
	}
	last := &plan.Chapters[len(plan.Chapters)-1]
	last.PageIDs = append(last.PageIDs, pageID)
	return true
}

// NormalizeOrganizePlan 修正 AI 返回的 page id（支持 index 或按顺序映射）。
func NormalizeOrganizePlan(pages []model.CatalogOrganizePageDO, plan model.CatalogOrganizePlanDO) model.CatalogOrganizePlanDO {
	valid := map[string]struct{}{}
	indexToID := map[int]string{}
	for _, p := range pages {
		valid[p.ID] = struct{}{}
		indexToID[p.Index] = p.ID
	}
	var fix func([]model.CatalogOrganizeChapterDO) []model.CatalogOrganizeChapterDO
	fix = func(chs []model.CatalogOrganizeChapterDO) []model.CatalogOrganizeChapterDO {
		out := make([]model.CatalogOrganizeChapterDO, len(chs))
		for i, ch := range chs {
			out[i] = ch
			ids := make([]string, 0, len(ch.PageIDs))
			for _, raw := range ch.PageIDs {
				id := strings.TrimSpace(raw)
				if _, ok := valid[id]; ok {
					ids = append(ids, id)
					continue
				}
				if n, err := strconv.Atoi(id); err == nil {
					if real, ok := indexToID[n]; ok {
						ids = append(ids, real)
						continue
					}
				}
				ids = append(ids, id)
			}
			out[i].PageIDs = ids
			out[i].Children = fix(ch.Children)
		}
		return out
	}
	plan.Chapters = fix(plan.Chapters)
	return remapOrganizePlanByOrder(pages, plan)
}

// remapOrganizePlanByOrder 当 id 仍无效且数量一致时，按 DFS 顺序映射到真实 page id。
func remapOrganizePlanByOrder(pages []model.CatalogOrganizePageDO, plan model.CatalogOrganizePlanDO) model.CatalogOrganizePlanDO {
	valid := map[string]struct{}{}
	for _, p := range pages {
		valid[p.ID] = struct{}{}
	}
	var flat []string
	var walkFlat func([]model.CatalogOrganizeChapterDO)
	walkFlat = func(chs []model.CatalogOrganizeChapterDO) {
		for _, ch := range chs {
			for _, id := range ch.PageIDs {
				flat = append(flat, strings.TrimSpace(id))
			}
			walkFlat(ch.Children)
		}
	}
	walkFlat(plan.Chapters)
	if len(flat) != len(pages) {
		return plan
	}
	needRemap := false
	for _, id := range flat {
		if id == "" {
			continue
		}
		if _, ok := valid[id]; !ok {
			needRemap = true
			break
		}
	}
	if !needRemap {
		return plan
	}
	idx := 0
	var remap func([]model.CatalogOrganizeChapterDO) []model.CatalogOrganizeChapterDO
	remap = func(chs []model.CatalogOrganizeChapterDO) []model.CatalogOrganizeChapterDO {
		out := make([]model.CatalogOrganizeChapterDO, len(chs))
		for i, ch := range chs {
			out[i] = ch
			out[i].PageIDs = make([]string, len(ch.PageIDs))
			for j := range ch.PageIDs {
				out[i].PageIDs[j] = pages[idx].ID
				idx++
			}
			out[i].Children = remap(ch.Children)
		}
		return out
	}
	plan.Chapters = remap(plan.Chapters)
	return plan
}

// validateOrganizePlan 校验方案覆盖全部范围页且无重复。
func validateOrganizePlan(scopePageIDs []string, plan model.CatalogOrganizePlanDO) error {
	want := map[string]struct{}{}
	for _, id := range scopePageIDs {
		want[id] = struct{}{}
	}
	got := map[string]struct{}{}
	var walk func([]model.CatalogOrganizeChapterDO) error
	walk = func(chapters []model.CatalogOrganizeChapterDO) error {
		for _, ch := range chapters {
			title := strings.TrimSpace(ch.Title)
			if title == "" {
				return fmt.Errorf("章节标题不能为空")
			}
			for _, pageID := range ch.PageIDs {
				pageID = strings.TrimSpace(pageID)
				if pageID == "" {
					continue
				}
				if _, dup := got[pageID]; dup {
					return fmt.Errorf("页面 %s 被重复分配", pageID)
				}
				got[pageID] = struct{}{}
				if _, ok := want[pageID]; !ok {
					return fmt.Errorf("页面 %s 不在当前分章范围", pageID)
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

func applyOrganizeChapterPlanLocked(db *sql.DB, s *Store, sessionID, parentID string, chapters []model.CatalogOrganizeChapterDO) error {
	for _, ch := range chapters {
		node, err := s.createChapterLocked(db, sessionID, parentID, strings.TrimSpace(ch.Title))
		if err != nil {
			return err
		}
		for i, pageID := range ch.PageIDs {
			pageID = strings.TrimSpace(pageID)
			if pageID == "" {
				continue
			}
			all, err := s.listCatalogNodesLocked(db, sessionID)
			if err != nil {
				return err
			}
			if err := s.moveCatalogNodeLocked(db, sessionID, all, pageID, node.ID, i); err != nil {
				return err
			}
		}
		if len(ch.Children) > 0 {
			if err := applyOrganizeChapterPlanLocked(db, s, sessionID, node.ID, ch.Children); err != nil {
				return err
			}
		}
	}
	return nil
}

func (s *Store) createChapterLocked(db *sql.DB, sessionID, parentID, title string) (model.CatalogNodeDO, error) {
	if title == "" {
		title = "新章节"
	}
	sortOrder, err := s.nextCatalogSortLocked(db, sessionID, parentID)
	if err != nil {
		return model.CatalogNodeDO{}, err
	}
	id := uuid.NewString()
	now := time.Now().Unix()
	if _, err := db.Exec(`
INSERT INTO catalog_nodes(id, session_id, parent_id, kind, title, snap_id, sort_order, created_at)
VALUES(?, ?, ?, ?, ?, '', ?, ?)
`, id, sessionID, parentID, catalogKindChapter, title, sortOrder, now); err != nil {
		return model.CatalogNodeDO{}, err
	}
	return model.CatalogNodeDO{
		ID: id, SessionID: sessionID, ParentID: parentID,
		Kind: catalogKindChapter, Title: title, SortOrder: sortOrder,
	}, nil
}

func (s *Store) moveCatalogNodeLocked(db *sql.DB, sessionID string, all []model.CatalogNodeDO, nodeID, parentID string, index int) error {
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
}

func (s *Store) deleteCatalogNodeLocked(db *sql.DB, sessionID string, all []model.CatalogNodeDO, id string) error {
	node, ok := findCatalogNode(all, id)
	if !ok {
		return nil
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
}
