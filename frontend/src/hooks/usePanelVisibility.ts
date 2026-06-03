import { useCallback, useState } from 'react'
import {
  readPanelVisibility,
  savePanelVisibility,
  sidebarBusinessOpen,
  togglePanel,
  type PanelId,
  type PanelVisibility,
} from '../lib/panelVisibility'

type PanelVisibilityOpts = {
  /** hasScope 主工作区含阅读穿透区；独立笔记窗为 false。 */
  hasScope?: boolean
}

/** usePanelVisibility 各工作区独立显隐。 */
export function usePanelVisibility(opts: PanelVisibilityOpts = {}) {
  const hasScope = opts.hasScope !== false
  const [panels, setPanelsState] = useState<PanelVisibility>(() => {
    const p = readPanelVisibility()
    if (!hasScope && !sidebarBusinessOpen(p)) {
      return { ...p, scope: false, wread: true }
    }
    return hasScope ? p : { ...p, scope: false }
  })

  /** setPanels 更新面板并持久化。 */
  const setPanels = useCallback(
    (next: PanelVisibility) => {
      const normalized = hasScope ? next : { ...next, scope: false }
      setPanelsState(normalized)
      savePanelVisibility(normalized)
    },
    [hasScope],
  )

  /** toggle 切换单个面板。 */
  const toggle = useCallback(
    (id: PanelId) => {
      setPanels(togglePanel(panels, id, { hasScope }))
    },
    [panels, setPanels, hasScope],
  )

  /** setPanel 直接设置单个面板开关。 */
  const setPanel = useCallback(
    (id: PanelId, on: boolean) => {
      if (panels[id] === on) return
      const next = { ...panels, [id]: on }
      if (id !== 'manager') {
        const businessOk = hasScope ? next.scope || next.wread || next.source : next.wread || next.source
        if (!businessOk) return
      }
      setPanels(next)
    },
    [panels, setPanels, hasScope],
  )

  return {
    panels,
    toggle,
    setPanel,
    showManager: panels.manager,
    showScope: panels.scope,
    showWread: panels.wread,
    showSource: panels.source,
    showNotePane: panels.wread || panels.source,
  }
}
