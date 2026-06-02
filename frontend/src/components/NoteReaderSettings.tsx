import { useEffect, useRef, useState } from 'react'
import type { PromptTemplateDO, ReaderSettingsDO } from '../../bindings/wread/internal/model'
import { FONT_FAMILY_OPTIONS } from '../lib/readerStyle'
import { INTERPRET_THEME_OPTIONS, normalizeLayoutTheme } from '../lib/interpretThemes'
import type { CatalogSide } from '../lib/catalogLayout'

type Props = {
  settings: ReaderSettingsDO
  onChange: (next: ReaderSettingsDO) => void
  templates: PromptTemplateDO[]
  activeTemplateId: string
  onPickTemplate: (id: string) => void
  catalogSide: CatalogSide
  onCatalogSideChange: (side: CatalogSide) => void
}

/** NoteReaderSettings 可收起的阅读样式与解读模板选择。 */
export default function NoteReaderSettings({
  settings,
  onChange,
  templates,
  activeTemplateId,
  onPickTemplate,
  catalogSide,
  onCatalogSideChange,
}: Props) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDetailsElement>(null)
  const templateLabel = templates.find((t) => t.id === activeTemplateId)?.name || '默认'
  const sideLabel = catalogSide === 'right' ? '右侧' : '左侧'
  const themeLabel = INTERPRET_THEME_OPTIONS.find((t) => t.id === normalizeLayoutTheme(settings.layoutTheme))?.label || '杂志'

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  return (
    <details
      ref={panelRef}
      className="reader-settings"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="reader-settings-summary">
        <span className="reader-settings-title">阅读样式</span>
        <span className="reader-settings-hint">
          {themeLabel} · {templateLabel} · {sideLabel} · {settings.fontSize}px
        </span>
      </summary>
      <div className="reader-settings-body">
        <label className="reader-settings-row reader-settings-font">
          <span>排版风格</span>
          <select
            value={normalizeLayoutTheme(settings.layoutTheme)}
            onChange={(e) => onChange({ ...settings, layoutTheme: e.target.value })}
          >
            {INTERPRET_THEME_OPTIONS.map((t) => (
              <option key={t.id} value={t.id}>{t.label} — {t.desc}</option>
            ))}
          </select>
        </label>
        <label className="reader-settings-row reader-settings-font">
          <span>解读模板</span>
          <select
            value={activeTemplateId}
            onChange={(e) => onPickTemplate(e.target.value)}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>
        <label className="reader-settings-row reader-settings-font">
          <span>目录位置</span>
          <select
            value={catalogSide}
            onChange={(e) => onCatalogSideChange(e.target.value as CatalogSide)}
          >
            <option value="left">左侧</option>
            <option value="right">右侧</option>
          </select>
        </label>
        <label className="reader-settings-row">
          <span>字号</span>
          <input
            type="range"
            min={8}
            max={28}
            value={settings.fontSize}
            onChange={(e) => onChange({ ...settings, fontSize: Number(e.target.value) })}
          />
          <em>{settings.fontSize}</em>
        </label>
        <label className="reader-settings-row">
          <span>行高</span>
          <input
            type="range"
            min={1.2}
            max={2.5}
            step={0.05}
            value={settings.lineHeight}
            onChange={(e) => onChange({ ...settings, lineHeight: Number(e.target.value) })}
          />
          <em>{settings.lineHeight.toFixed(1)}</em>
        </label>
        <label className="reader-settings-row">
          <span>段间距</span>
          <input
            type="range"
            min={4}
            max={28}
            value={settings.paragraphGap || 12}
            onChange={(e) => onChange({ ...settings, paragraphGap: Number(e.target.value) })}
          />
          <em>{settings.paragraphGap || 12}</em>
        </label>
        <label className="reader-settings-row reader-settings-font">
          <span>字体</span>
          <select
            value={settings.fontFamily}
            onChange={(e) => onChange({ ...settings, fontFamily: e.target.value })}
          >
            {FONT_FAMILY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
      </div>
    </details>
  )
}
