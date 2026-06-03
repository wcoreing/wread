import { useSystemTheme } from '../hooks/useSystemTheme'

type Props = {
  /** embedded 嵌入配置 Tab。 */
  embedded?: boolean
}

/** ThemeManager 系统外观主题卡片选择。 */
export default function ThemeManager({ embedded = false }: Props) {
  const { themeId, setThemeId, options } = useSystemTheme()

  return (
    <div className={`theme-manager${embedded ? ' settings-tab-pane' : ''}`}>
      <div className="theme-grid">
        {options.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`theme-card${themeId === t.id ? ' active' : ''}`}
            onClick={() => setThemeId(t.id)}
            title={t.desc}
          >
            <span className="theme-swatch" style={{ background: t.preview }} />
            <span className="theme-card-body">
              <span className="theme-card-label">{t.label}</span>
              <span className="theme-card-desc">{t.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
