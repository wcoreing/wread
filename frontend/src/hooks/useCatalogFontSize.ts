import { useCallback, useState, type CSSProperties } from 'react'
import {
  catalogFontSizeMax,
  catalogFontSizeMin,
  readCatalogFontSize,
  saveCatalogFontSize,
} from '../lib/catalogLayout'

/** useCatalogFontSize 目录树字号（持久化，独立于解读正文）。 */
export function useCatalogFontSize() {
  const [fontSize, setFontSize] = useState(readCatalogFontSize)
  const panelStyle = { '--catalog-font-size': `${fontSize}px` } as CSSProperties

  /** changeFontSize 更新目录树字号并写入本地。 */
  const changeFontSize = useCallback((size: number) => {
    const next = Math.max(catalogFontSizeMin, Math.min(catalogFontSizeMax, Math.round(size)))
    setFontSize(next)
    saveCatalogFontSize(next)
  }, [])

  return { fontSize, panelStyle, changeFontSize }
}
