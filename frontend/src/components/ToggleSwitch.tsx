type Props = {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  label?: string
  title?: string
  className?: string
}

/** ToggleSwitch 统一样式开关（非原生 checkbox）。 */
export default function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  label,
  title,
  className = '',
}: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={title}
      disabled={disabled}
      className={`toggle-switch${checked ? ' on' : ''}${disabled ? ' disabled' : ''} ${className}`.trim()}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-switch-track">
        <span className="toggle-switch-thumb" />
      </span>
    </button>
  )
}
