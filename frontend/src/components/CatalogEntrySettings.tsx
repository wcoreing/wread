import ChoiceSelect from './ChoiceSelect'

type Props = {
  autoAdd: boolean
  onChange: (autoAdd: boolean) => void
  className?: string
}

/** CatalogEntrySettings 目录入库方式：解读后自动或手动录入。 */
export default function CatalogEntrySettings({ autoAdd, onChange, className = '' }: Props) {
  return (
    <div className={`settings-form settings-reading-form ${className}`.trim()}>
      <div className="settings-form-row">
        <label className="settings-form-label">目录入库</label>
        <ChoiceSelect
          className="settings-form-control catalog-entry-select"
          value={autoAdd ? 'auto' : 'manual'}
          title="解读完成后如何写入目录"
          options={[
            { value: 'auto', label: '自动', hint: '解读完成后自动写入当前章节' },
            { value: 'manual', label: '手动', hint: '解读完成后在 wread 区确认录入' },
          ]}
          onChange={(v) => onChange(v === 'auto')}
        />
      </div>
      <p className="settings-field-hint">
        {autoAdd ? '解读结果将自动追加到当前选中章节' : '手动模式下，解读完成后在 wread 区点击「录入」'}
      </p>
    </div>
  )
}
