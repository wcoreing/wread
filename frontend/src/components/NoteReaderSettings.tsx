import type { ReaderSettingsDO } from '../../bindings/wread/internal/model'
import { FONT_FAMILY_OPTIONS } from '../lib/readerStyle'

type Props = {
  settings: ReaderSettingsDO
  onChange: (next: ReaderSettingsDO) => void
}

/** NoteReaderSettings 正文顶栏排版工具条（字号、行高、段间距、字体）。 */
export default function NoteReaderSettings({ settings, onChange }: Props) {
  const paragraphGap = settings.paragraphGap || 12

  return (
    <div className="note-typo-bar" aria-label="排版">
      <label className="note-typo-item">
        <span className="note-typo-label">字号</span>
        <input
          type="range"
          min={8}
          max={28}
          value={settings.fontSize}
          onChange={(e) => onChange({ ...settings, fontSize: Number(e.target.value) })}
        />
        <em>{settings.fontSize}</em>
      </label>
      <label className="note-typo-item">
        <span className="note-typo-label">行高</span>
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
      <label className="note-typo-item">
        <span className="note-typo-label">段距</span>
        <input
          type="range"
          min={4}
          max={28}
          value={paragraphGap}
          onChange={(e) => onChange({ ...settings, paragraphGap: Number(e.target.value) })}
        />
        <em>{paragraphGap}</em>
      </label>
      <label className="note-typo-item note-typo-font">
        <span className="note-typo-label">字体</span>
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
  )
}
