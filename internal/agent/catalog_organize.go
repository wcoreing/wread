package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"wread/internal/model"
)

// OrganizeCatalog 根据页标题与摘要生成章节分组方案。
func (p *Provider) OrganizeCatalog(ctx context.Context, scopeTitle string, pages []model.CatalogOrganizePageDO) (model.CatalogOrganizePlanDO, error) {
	if strings.TrimSpace(p.apiKey) == "" {
		return model.CatalogOrganizePlanDO{}, fmt.Errorf("请先在开卷模板中配置 AI API Key")
	}
	if len(pages) < 2 {
		return model.CatalogOrganizePlanDO{}, fmt.Errorf("至少需要 2 页笔记")
	}
	system := `你是书籍目录编辑。根据读者笔记页标题与摘要，将同一主题或阅读顺序相近的页归入章节。
要求：
1. 用 pageIndexes 引用页序号（输入里的 index），每页恰好出现一次
2. 同一章节内保持 index 升序
3. 章节 title 不超过 16 个汉字，不要序号、引号
4. 可嵌套子章节（children）
5. 只输出 JSON：{"chapters":[{"title":"章节名","pageIndexes":[1,2],"children":[]}]}
不要 markdown 代码块或其它说明。`
	var b strings.Builder
	b.WriteString("范围：")
	b.WriteString(strings.TrimSpace(scopeTitle))
	b.WriteString("\n\n笔记页：\n")
	for _, pg := range pages {
		b.WriteString(fmt.Sprintf("- id=%s index=%d title=%s", pg.ID, pg.Index, pg.Title))
		if s := strings.TrimSpace(pg.Summary); s != "" {
			b.WriteString(" summary=")
			b.WriteString(truncateSummary(s, 300))
		}
		b.WriteByte('\n')
	}
	msgs := []chatMessage{
		{Role: "system", Content: strPtr(system)},
		{Role: "user", Content: strPtr(b.String())},
	}
	raw, err := p.completeStream(ctx, msgs, nil)
	if err != nil {
		return model.CatalogOrganizePlanDO{}, err
	}
	return parseOrganizePlan(raw)
}

// parseOrganizePlan 从 LLM 响应解析分章 JSON。
func parseOrganizePlan(raw string) (model.CatalogOrganizePlanDO, error) {
	raw = strings.TrimSpace(raw)
	raw = strings.TrimPrefix(raw, "```json")
	raw = strings.TrimPrefix(raw, "```")
	raw = strings.TrimSuffix(raw, "```")
	raw = strings.TrimSpace(raw)
	var plan model.CatalogOrganizePlanDO
	if err := json.Unmarshal([]byte(raw), &plan); err != nil {
		return model.CatalogOrganizePlanDO{}, fmt.Errorf("AI 返回格式无效: %w", err)
	}
	if len(plan.Chapters) == 0 {
		return model.CatalogOrganizePlanDO{}, fmt.Errorf("AI 未生成任何章节")
	}
	return plan, nil
}
