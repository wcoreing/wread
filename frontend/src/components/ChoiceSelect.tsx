import { useEffect, useRef, useState } from 'react'

export type ChoiceOption<T extends string = string> = {
  value: T
  label: string
  hint?: string
}

type Props<T extends string> = {
  value: T
  options: ChoiceOption<T>[]
  onChange: (value: T) => void
  className?: string
  title?: string
  placeholder?: string
  disabled?: boolean
}

/** ChoiceSelect 统一样式自定义下拉选择（非原生 select）。 */
export default function ChoiceSelect<T extends string>({
  value,
  options,
  onChange,
  className = '',
  title,
  placeholder = '请选择',
  disabled = false,
}: Props<T>) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const active = options.find((o) => o.value === value)

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

  return (
    <div
      ref={rootRef}
      className={`choice-select${open ? ' open' : ''}${disabled ? ' disabled' : ''} ${className}`.trim()}
    >
      <button
        type="button"
        className="choice-select-trigger"
        title={title || active?.hint || active?.label}
        disabled={disabled || options.length === 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="choice-select-value">{active?.label || placeholder}</span>
        <span className="choice-select-chevron" aria-hidden />
      </button>
      {open && (
        <ul className="choice-select-menu" role="listbox">
          {options.map((opt) => (
            <li key={opt.value} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={opt.value === value}
                className={opt.value === value ? 'active' : ''}
                title={opt.hint}
                onClick={() => {
                  onChange(opt.value)
                  setOpen(false)
                }}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
