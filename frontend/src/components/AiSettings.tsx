import type { useInterpretSettings } from '../hooks/useInterpretSettings'

type Settings = ReturnType<typeof useInterpretSettings>

type Props = {
  settings: Settings
  className?: string
}

/** AiSettings AI 连接配置页。 */
export default function AiSettings({ settings, className = 'interpret-settings' }: Props) {
  const s = settings
  return (
    <div className={className}>
      <div className="interpret-settings-head template-head-drag">
        <span>配置</span>
        <span className="interpret-settings-sub">AI 连接</span>
      </div>
      {s.status && <div className="interpret-settings-status">{s.status}</div>}

      <label>API Base</label>
      <input value={s.apiBase} onChange={(e) => s.setApiBase(e.target.value)} placeholder="API Base" />
      <label>Model</label>
      <input value={s.modelName} onChange={(e) => s.setModelName(e.target.value)} placeholder="Model" />
      <label>API Key</label>
      <input
        type="password"
        value={s.apiKey}
        onChange={(e) => s.setApiKey(e.target.value)}
        placeholder={s.hasKey ? '已配置 Key' : 'sk-...'}
      />
      <div className="interpret-settings-actions">
        <button type="button" className="note-action-btn primary" onClick={() => s.saveAI().catch((e) => console.error(e))}>
          保存
        </button>
        <button type="button" className="note-action-btn" onClick={() => s.testAI().catch((e) => console.error(e))}>
          测试连接
        </button>
      </div>    </div>
  )
}
