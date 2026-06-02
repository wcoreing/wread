import { useEffect } from 'react'

export type ContextMenuItem = {
  label: string
  onClick: () => void
}

type Props = {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

/** CatalogContextMenu 目录区右键菜单。 */
export default function CatalogContextMenu({ x, y, items, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <button type="button" className="catalog-ctx-backdrop" aria-label="关闭菜单" onClick={onClose} />
      <menu
        className="catalog-ctx-menu"
        style={{ left: x, top: y }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {items.map((item) => (
          <li key={item.label}>
            <button
              type="button"
              onClick={() => {
                item.onClick()
                onClose()
              }}
            >
              {item.label}
            </button>
          </li>
        ))}
      </menu>
    </>
  )
}
