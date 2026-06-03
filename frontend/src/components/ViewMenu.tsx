import { useEffect, useRef, useState } from 'react'
import { PANEL_DEFS, panelToggleDisabled, type PanelId, type PanelVisibility } from '../lib/panelVisibility'
import type { WindowLayoutPresetsApi } from '../hooks/useWindowLayoutPresets'

type Props = {
  panels: PanelVisibility
  onSetPanel: (id: PanelId, on: boolean) => void
  layoutPresets?: WindowLayoutPresetsApi
  hidePanels?: PanelId[]
  hasScope?: boolean
  onRestoreWindow?: () => void
  /** compact 贴边恢复条等窄位触发。 */
  compact?: boolean
  className?: string
}

/** ViewMenu 顶栏「视图」：面板多选 + 窗口布局预设。 */
export default function ViewMenu({
  panels,
  onSetPanel,
  layoutPresets,
  hidePanels = [],
  hasScope = true,
  onRestoreWindow,
  compact = false,
  className = '',
}: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelDefs = PANEL_DEFS.filter((p) => !hidePanels.includes(p.id))
  const presetList = layoutPresets?.presets.presets ?? []
  const activePresetId = layoutPresets?.presets.activeId ?? ''

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  /** togglePanel 切换面板显隐。 */
  const togglePanel = (id: PanelId) => {
    onSetPanel(id, !panels[id])
  }

  return (
    <div
      ref={rootRef}
      className={`view-menu${open ? ' open' : ''}${compact ? ' compact' : ''} ${className}`.trim()}
    >
      <button
        type="button"
        className="menu-bar-item view-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        title="显示面板与窗口布局"
        onClick={() => setOpen((v) => !v)}
      >
        视图
      </button>
      {open && (
        <div className="menu-dropdown view-menu-dropdown" role="menu">
          <div className="menu-dropdown-label">显示</div>
          {panelDefs.map((p) => {
            const checked = panels[p.id]
            const disabled = panelToggleDisabled(panels, p.id, { hasScope })
            return (
              <button
                key={p.id}
                type="button"
                role="menuitemcheckbox"
                aria-checked={checked}
                className="menu-dropdown-item menu-check-item"
                title={disabled ? '至少保留一个业务区' : p.hint}
                disabled={disabled}
                onClick={() => togglePanel(p.id)}
              >
                <span className="menu-check-mark" aria-hidden>
                  {checked ? '✓' : ''}
                </span>
                <span className="menu-item-label">{p.label}</span>
              </button>
            )
          })}

          {layoutPresets && (
            <>
              <div className="menu-dropdown-sep" role="separator" />
              <div className="menu-dropdown-label">窗口布局</div>
              {presetList.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={item.id === activePresetId}
                  className="menu-dropdown-item menu-check-item"
                  onClick={() => {
                    void layoutPresets.applyPreset(item.id)
                  }}
                >
                  <span className="menu-check-mark" aria-hidden>
                    {item.id === activePresetId ? '✓' : ''}
                  </span>
                  <span className="menu-item-label">{item.name}</span>
                </button>
              ))}
              {presetList.length === 0 && (
                <div className="menu-dropdown-empty">暂无布局预设</div>
              )}
              <button
                type="button"
                role="menuitem"
                className="menu-dropdown-item menu-action-item"
                onClick={() => void layoutPresets.createPreset()}
              >
                保存当前窗口…
              </button>
              {layoutPresets.status && (
                <div className="menu-dropdown-status">{layoutPresets.status}</div>
              )}
              {onRestoreWindow && (
                <>
                  <div className="menu-dropdown-sep" role="separator" />
                  <button
                    type="button"
                    role="menuitem"
                    className="menu-dropdown-item menu-action-item"
                    onClick={onRestoreWindow}
                  >
                    恢复默认窗口
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
