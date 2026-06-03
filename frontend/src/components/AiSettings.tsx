import type { useInterpretSettings } from '../hooks/useInterpretSettings'
import CatalogEntrySettings from './CatalogEntrySettings'

type Settings = ReturnType<typeof useInterpretSettings>

type Props = {
  settings: Settings
  catalogAutoAdd?: boolean
  onCatalogAutoAddChange?: (auto: boolean) => void
  className?: string
  /** embedded 嵌入配置 Tab，隐藏页头。 */
  embedded?: boolean
}

/** AiSettings AI 连接与解读相关配置。 */
export default function AiSettings({
  settings,
  catalogAutoAdd,
  onCatalogAutoAddChange,
  className = 'interpret-settings',
  embedded = false,
}: Props) {
  const s = settings

  return (
    <div className={embedded ? `${className} settings-tab-pane ai-settings` : `${className} ai-settings`}>
      {!embedded && (
        <div className="interpret-settings-head template-head-drag">
          <span>AI 连接</span>
        </div>
      )}
      {s.status && <div className="interpret-settings-status">{s.status}</div>}

      <div className="settings-form ai-settings-form">
        <div className="settings-form-row">
          <label className="settings-form-label">API Base</label>
          <input
            className="settings-form-control"
            value={s.apiBase}
            onChange={(e) => s.setApiBase(e.target.value)}
            placeholder="API Base"
          />
        </div>
        <div className="settings-form-row">
          <label className="settings-form-label">Model</label>
          <input
            className="settings-form-control"
            value={s.modelName}
            onChange={(e) => s.setModelName(e.target.value)}
            placeholder="Model"
          />
        </div>
        <div className="settings-form-row">
          <label className="settings-form-label">API Key</label>
          <input
            className="settings-form-control"
            type="password"
            value={s.apiKey}
            onChange={(e) => s.setApiKey(e.target.value)}
            placeholder={s.hasKey ? '已配置 Key' : 'sk-...'}
          />
        </div>
        <div className="settings-form-actions">
          <button type="button" className="note-action-btn primary" onClick={() => s.saveAI().catch((e) => console.error(e))}>
            保存
          </button>
          <button type="button" className="note-action-btn" onClick={() => s.testAI().catch((e) => console.error(e))}>
            测试连接
          </button>
        </div>
      </div>

      {onCatalogAutoAddChange && catalogAutoAdd !== undefined && (
        <CatalogEntrySettings autoAdd={catalogAutoAdd} onChange={onCatalogAutoAddChange} />
      )}
    </div>
  )
}
