import { useCallback, useState } from 'react'
import { readSourceCollapsed, saveSourceCollapsed } from '../lib/sourcePanelLayout'

/** useSourcePanelCollapsed 原文对照区收起态。 */
export function useSourcePanelCollapsed() {
  const [collapsed, setCollapsedState] = useState(readSourceCollapsed)

  /** setCollapsed 收起或展开原文对照。 */
  const setCollapsed = useCallback((next: boolean) => {
    setCollapsedState(next)
    saveSourceCollapsed(next)
  }, [])

  /** toggleSource 切换原文对照展开。 */
  const toggleSource = useCallback(() => {
    setCollapsedState((v) => {
      const next = !v
      saveSourceCollapsed(next)
      return next
    })
  }, [])

  return [collapsed, setCollapsed, toggleSource] as const
}
