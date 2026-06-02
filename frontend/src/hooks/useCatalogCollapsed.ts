import { useCallback, useEffect, useState } from 'react'
import { Events } from '@wailsio/runtime'

const CATALOG_COLLAPSED_KEY = 'wread.catalogCollapsed'

/** readCatalogCollapsed 目录是否收起（默认收起）。 */
function readCatalogCollapsed(): boolean {
  const v = localStorage.getItem(CATALOG_COLLAPSED_KEY)
  if (v === null) return true
  return v === '1'
}

/** useCatalogCollapsed 目录侧栏收起态（localStorage 持久化）。 */
export function useCatalogCollapsed() {
  const [collapsed, setCollapsedState] = useState(readCatalogCollapsed)

  /** setCollapsed 收起或展开目录。 */
  const setCollapsed = useCallback((next: boolean) => {
    setCollapsedState(next)
    localStorage.setItem(CATALOG_COLLAPSED_KEY, next ? '1' : '0')
  }, [])

  /** toggleCatalog 切换目录侧栏展开。 */
  const toggleCatalog = useCallback(() => {
    setCollapsedState((v) => {
      const next = !v
      localStorage.setItem(CATALOG_COLLAPSED_KEY, next ? '1' : '0')
      return next
    })
  }, [])

  useEffect(() => {
    return Events.On('layout:catalogToggle', () => {
      toggleCatalog()
    })
  }, [toggleCatalog])

  return [collapsed, setCollapsed, toggleCatalog] as const
}
