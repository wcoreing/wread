import { useState } from 'react'
import type { useInterpretSettings } from '../hooks/useInterpretSettings'

type Settings = ReturnType<typeof useInterpretSettings>

type Props = {
  settings: Settings
  className?: string
  /** embedded 嵌入配置 Tab，隐藏页头。 */
  embedded?: boolean
}

/** templatePreview 截取模板提示词预览。 */
function templatePreview(body: string) {
  const line = body.replace(/\s+/g, ' ').trim()
  if (!line) return '暂无提示词'
  return line.length > 48 ? `${line.slice(0, 48)}…` : line
}

/** TemplateManager 解读模板：列表 → 全宽详情（方案 A）。 */
export default function TemplateManager({ settings, className = 'interpret-settings', embedded = false }: Props) {
  const s = settings
  const canDelete = s.promptSettings.templates.length > 1
  const [detailId, setDetailId] = useState<string | null>(null)

  /** openTemplate 选中模板并进入详情。 */
  const openTemplate = async (id: string) => {
    await s.selectTemplateForEdit(id)
    setDetailId(id)
  }

  /** backToList 返回模板列表。 */
  const backToList = () => setDetailId(null)

  /** createAndOpen 新建模板并打开详情。 */
  const createAndOpen = async () => {
    const id = await s.createTemplate()
    if (id) setDetailId(id)
  }

  const inDetail = detailId !== null && s.tplId === detailId

  return (
    <div className={`${className} template-manager settings-stack${embedded ? ' settings-tab-pane' : ''}`}>
      {!inDetail ? (
        <>
          {embedded ? (
            <div className="settings-tab-toolbar">
              <button
                type="button"
                className="template-reset-btn"
                onClick={() => s.resetTemplates().catch((e) => console.error(e))}
              >
                恢复默认
              </button>
            </div>
          ) : (
            <div className="interpret-settings-head template-head-drag">
              <span>模板管理</span>
              <button
                type="button"
                className="template-reset-btn"
                onClick={() => s.resetTemplates().catch((e) => console.error(e))}
              >
                恢复默认
              </button>
            </div>
          )}
          {s.status && <div className="interpret-settings-status">{s.status}</div>}

          <div className="settings-stack-list">
            {s.promptSettings.templates.map((t) => {
              const active = t.id === s.promptSettings.activeId
              return (
                <button
                  key={t.id}
                  type="button"
                  className="settings-stack-row"
                  onClick={() => openTemplate(t.id).catch((e) => console.error(e))}
                >
                  <span className="settings-stack-row-main">
                    <span className="settings-stack-row-title">{t.name}</span>
                    <span className="settings-stack-row-desc">{templatePreview(t.systemPrompt)}</span>
                  </span>
                  <span className="settings-stack-row-meta">
                    {active && <span className="template-list-badge">使用中</span>}
                    <span className="settings-stack-chevron" aria-hidden>›</span>
                  </span>
                </button>
              )
            })}
            <button type="button" className="template-list-add" onClick={() => createAndOpen().catch((e) => console.error(e))}>
              + 新建模板
            </button>
          </div>
        </>
      ) : (
        <div className="settings-stack-detail">
          <div className="settings-stack-detail-head">
            <button type="button" className="settings-stack-back" onClick={backToList}>
              ← 返回
            </button>
            <div className="settings-stack-detail-actions">
              {s.tplId !== s.promptSettings.activeId && (
                <button
                  type="button"
                  className="note-action-btn primary"
                  onClick={() => s.pickTemplate(s.tplId).catch((e) => console.error(e))}
                >
                  设为当前
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  className="template-op-btn danger"
                  onClick={() => {
                    const id = s.tplId
                    s.deleteTemplate(id)
                      .then(() => setDetailId(null))
                      .catch((e) => console.error(e))
                  }}
                >
                  删除
                </button>
              )}
            </div>
          </div>
          {s.status && <div className="interpret-settings-status">{s.status}</div>}
          {s.tplId === s.promptSettings.activeId && (
            <div className="settings-stack-active-hint">当前解读使用此模板</div>
          )}

          <div className="settings-form settings-stack-form">
            <div className="settings-form-row">
              <label className="settings-form-label">模板名称</label>
              <input
                className="settings-form-control"
                value={s.tplName}
                onChange={(e) => s.updateTplName(e.target.value)}
              />
            </div>
            <div className="settings-form-row settings-form-row-top">
              <label className="settings-form-label">System</label>
              <textarea
                className="interpret-settings-editor template-editor-body settings-stack-editor settings-form-control"
                value={s.tplBody}
                onChange={(e) => s.updateTplBody(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
