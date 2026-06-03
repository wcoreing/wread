import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  clampCatalogPanelWidth,
  readCatalogPanelWidth,
  saveCatalogPanelWidth,
} from '../lib/catalogLayout'
import type { CatalogSide } from '../lib/catalogLayout'

/** useCatalogPanelWidth 管理区宽度（拖右缘调整，持久化）。 */
export function useCatalogPanelWidth(catalogSide: CatalogSide) {
  const [panelW, setPanelW] = useState(readCatalogPanelWidth)
  const panelWRef = useRef(panelW)

  useEffect(() => {
    panelWRef.current = panelW
  }, [panelW])

  const panelStyle = { '--manager-w': `${panelW}px` } as CSSProperties

  /** startWidthDrag 拖动管理区右缘调整宽度。 */
  const startWidthDrag = useCallback(
    (startX: number, containerW: number, onDragEnd?: () => void) => {
      const startW = panelWRef.current
      const onMove = (ev: MouseEvent) => {
        const delta = catalogSide === 'left' ? ev.clientX - startX : startX - ev.clientX
        const next = clampCatalogPanelWidth(startW + delta, containerW)
        setPanelW(next)
      }
      const onUp = () => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
        saveCatalogPanelWidth(panelWRef.current)
        onDragEnd?.()
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [catalogSide],
  )

  return { panelW, panelStyle, startWidthDrag }
}
