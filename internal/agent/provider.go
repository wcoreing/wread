package agent

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type chatMessage struct {
	Role    string  `json:"role"`
	Content *string `json:"content"`
}

type chatRequest struct {
	Model    string        `json:"model"`
	Messages []chatMessage `json:"messages"`
	Stream   bool          `json:"stream"`
}

type streamDelta struct {
	Choices []struct {
		Delta struct {
			Content *string `json:"content"`
		} `json:"delta"`
	} `json:"choices"`
}

// Provider OpenAI 兼容 LLM 客户端。
type Provider struct {
	baseURL string
	apiKey  string
	model   string
	client  *http.Client
}

// NewProvider 创建 Provider。
func NewProvider(baseURL, apiKey, model string) *Provider {
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	baseURL = strings.TrimSuffix(baseURL, "/chat/completions")
	baseURL = strings.TrimSuffix(baseURL, "/")
	if baseURL == "" {
		baseURL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
	}
	if strings.TrimSpace(model) == "" {
		model = "qwen-plus"
	}
	return &Provider{
		baseURL: baseURL,
		apiKey:  strings.TrimSpace(apiKey),
		model:   strings.TrimSpace(model),
		client:  &http.Client{Timeout: 120 * time.Second},
	}
}

// StreamHandler 流式文本增量回调。
type StreamHandler func(delta string)

// TeacherPrompt 构建伴读老师 system prompt。
func TeacherPrompt(bookName, rollingSummary, template string) string {
	return RenderTeacherPrompt(template, bookName, rollingSummary)
}

// CompleteTeacher 流式完成老师解读。
func (p *Provider) CompleteTeacher(ctx context.Context, bookName, rollingSummary, ocrText, template string, onDelta StreamHandler) (string, []string, error) {
	if strings.TrimSpace(p.apiKey) == "" {
		return "", nil, fmt.Errorf("请先在开卷模板中配置 AI API Key")
	}
	user := fmt.Sprintf("当前识别到的原文：\n\n%s", strings.TrimSpace(ocrText))
	msgs := []chatMessage{
		{Role: "system", Content: strPtr(TeacherPrompt(bookName, rollingSummary, template))},
		{Role: "user", Content: strPtr(user)},
	}
	summary, err := p.completeStream(ctx, msgs, onDelta)
	if err != nil {
		return "", nil, err
	}
	return summary, extractConcepts(summary), nil
}

// AskFollowUp 追问。
func (p *Provider) AskFollowUp(ctx context.Context, bookName, rollingSummary, ocrText, question, template string, onDelta StreamHandler) (string, error) {
	if strings.TrimSpace(p.apiKey) == "" {
		return "", fmt.Errorf("请先在开卷模板中配置 AI API Key")
	}
	system := TeacherPrompt(bookName, rollingSummary, template) + "\n\n读者正在追问，请结合当前段落简洁回答。"
	user := fmt.Sprintf("当前段落：\n%s\n\n读者问题：%s", ocrText, question)
	msgs := []chatMessage{
		{Role: "system", Content: strPtr(system)},
		{Role: "user", Content: strPtr(user)},
	}
	return p.completeStream(ctx, msgs, onDelta)
}

// GeneratePageTitle 为章节目录页生成短标题。
func (p *Provider) GeneratePageTitle(ctx context.Context, bookName, chapterTitle, summary string) (string, error) {
	if strings.TrimSpace(p.apiKey) == "" {
		return "", fmt.Errorf("请先在开卷模板中配置 AI API Key")
	}
	system := "你是书籍目录编辑。根据解读内容生成一条目录标题。只输出标题本身，不超过16个汉字，不要序号、引号、markdown 或换行。"
	user := fmt.Sprintf("书名：%s\n章节：%s\n解读内容：\n%s", bookName, chapterTitle, truncateSummary(summary, 600))
	msgs := []chatMessage{
		{Role: "system", Content: strPtr(system)},
		{Role: "user", Content: strPtr(user)},
	}
	out, err := p.completeStream(ctx, msgs, nil)
	if err != nil {
		return "", err
	}
	return cleanPageTitle(out), nil
}

// TestConnection 测试 API 连接。
func (p *Provider) TestConnection(ctx context.Context) error {
	if strings.TrimSpace(p.apiKey) == "" {
		return fmt.Errorf("API Key 未配置")
	}
	msgs := []chatMessage{{Role: "user", Content: strPtr("回复 OK 两个字母即可")}}
	_, err := p.completeStream(ctx, msgs, nil)
	return err
}

func (p *Provider) completeStream(ctx context.Context, messages []chatMessage, onDelta StreamHandler) (string, error) {
	payload := chatRequest{Model: p.model, Messages: messages, Stream: true}
	body, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+p.apiKey)

	resp, err := p.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("网络请求失败: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		raw, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("LLM HTTP %d: %s", resp.StatusCode, truncate(string(raw), 300))
	}

	var full strings.Builder
	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		if err := ctx.Err(); err != nil {
			return full.String(), err
		}
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			break
		}
		var chunk streamDelta
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue
		}
		if len(chunk.Choices) == 0 || chunk.Choices[0].Delta.Content == nil {
			continue
		}
		delta := *chunk.Choices[0].Delta.Content
		if delta == "" {
			continue
		}
		full.WriteString(delta)
		if onDelta != nil {
			onDelta(delta)
		}
	}
	if err := scanner.Err(); err != nil {
		return full.String(), err
	}
	out := strings.TrimSpace(full.String())
	if out == "" {
		return "", fmt.Errorf("LLM 无有效响应")
	}
	return out, nil
}

func extractConcepts(summary string) []string {
	var concepts []string
	for _, line := range strings.Split(summary, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "- ") || strings.HasPrefix(line, "* ") {
			concepts = append(concepts, strings.TrimPrefix(strings.TrimPrefix(line, "- "), "* "))
		}
	}
	if len(concepts) > 5 {
		concepts = concepts[:5]
	}
	return concepts
}

func strPtr(s string) *string { return &s }

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}

func truncateSummary(s string, max int) string {
	r := []rune(strings.TrimSpace(s))
	if len(r) <= max {
		return string(r)
	}
	return string(r[:max]) + "…"
}

func cleanPageTitle(s string) string {
	s = strings.TrimSpace(s)
	s = strings.Trim(s, `"'""''`)
	for strings.HasPrefix(s, "#") {
		s = strings.TrimSpace(strings.TrimPrefix(s, "#"))
	}
	r := []rune(s)
	if len(r) > 16 {
		s = string(r[:16])
	}
	if s == "" {
		return "未命名"
	}
	return s
}
