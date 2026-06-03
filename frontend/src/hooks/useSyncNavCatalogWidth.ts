import { useCallback, useEffect, useRef } from 'react'
import { Service } from '../../bindings/wread/internal/app'
import { readCatalogPanelWidth } from '../lib/catalogLayout'

/** estimateManagerNavWidth 估算管理区导航列宽度。 */
export function estimateManagerNavWidth(): number {
  return readCatalogPanelWidth()
}

/** useSyncNavCatalogWidth 将左侧管理区宽同步至后端穿透几何。 */
export function useSyncNavCatalogWidth(enabled: boolean) {
  const widthRef = useRef(0)

  /** reportManagerWidth 由 ManagerPane 上报当前管理区总宽。 */
  const reportManagerWidth = useCallback(
    (width: number) => {
      widthRef.current = width
      if (!enabled) return
      void Service.SetCatalogWidth(Math.round(width)).catch(console.error)
    },
    [enabled],
  )

  useEffect(() => {
    if (!enabled) {
      void Service.SetCatalogWidth(0).catch(console.error)
      return
    }
    const fallback = estimateManagerNavWidth()
    const w = Math.max(widthRef.current, fallback)
    widthRef.current = w
    void Service.SetCatalogWidth(Math.round(w)).catch(console.error)
  }, [enabled])

  return { reportManagerWidth, managerWidth: widthRef }
}
