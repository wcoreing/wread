const PANEL_VISIBILITY_KEY = 'wread.panelVisibility'

/** PanelId 可独立开关的工作区面板。 */
export type PanelId = 'manager' | 'scope' | 'wread' | 'source'

/** PanelVisibility 各业务区显隐（持久化）。 */
export type PanelVisibility = Record<PanelId, boolean>

export const DEFAULT_PANELS: PanelVisibility = {
  manager: true,
  scope: true,
  wread: true,
  source: false,
}

/** readPanelVisibility 读取持久化面板状态。 */
export function readPanelVisibility(): PanelVisibility {
  const raw = localStorage.getItem(PANEL_VISIBILITY_KEY)
  if (raw) {
    try {
      const v = JSON.parse(raw) as Partial<PanelVisibility>
      return {
        manager: v.manager ?? DEFAULT_PANELS.manager,
        scope: v.scope ?? DEFAULT_PANELS.scope,
        wread: v.wread ?? DEFAULT_PANELS.wread,
        source: v.source ?? DEFAULT_PANELS.source,
      }
    } catch {
      /* fall through */
    }
  }
  return { ...DEFAULT_PANELS }
}

/** savePanelVisibility 保存面板显隐。 */
export function savePanelVisibility(panels: PanelVisibility) {
  localStorage.setItem(PANEL_VISIBILITY_KEY, JSON.stringify(panels))
}

/** businessPanelsOpen 至少一个业务区（阅读/wread/原文）开启。 */
export function businessPanelsOpen(panels: PanelVisibility): boolean {
  return panels.scope || panels.wread || panels.source
}

/** sidebarBusinessOpen 独立笔记窗至少 wread 或原文之一开启。 */
export function sidebarBusinessOpen(panels: PanelVisibility): boolean {
  return panels.wread || panels.source
}

/** togglePanel 切换单面板；业务区不可全部关闭。 */
export function togglePanel(
  panels: PanelVisibility,
  id: PanelId,
  opts?: { hasScope?: boolean },
): PanelVisibility {
  const next = { ...panels, [id]: !panels[id] }
  if (id !== 'manager') {
    const businessOk = opts?.hasScope === false ? sidebarBusinessOpen(next) : businessPanelsOpen(next)
    if (!businessOk) return panels
  }
  return next
}

/** panelToggleDisabled 业务区仅剩一个时不可关闭。 */
export function panelToggleDisabled(
  panels: PanelVisibility,
  id: PanelId,
  opts?: { hasScope?: boolean },
): boolean {
  if (id === 'manager') return false
  const hasScope = opts?.hasScope !== false
  if (hasScope) {
    const open = [panels.scope, panels.wread, panels.source].filter(Boolean).length
    return open === 1 && panels[id]
  }
  const open = [panels.wread, panels.source].filter(Boolean).length
  return open === 1 && panels[id]
}

export const PANEL_DEFS: { id: PanelId; label: string; hint: string }[] = [
  { id: 'manager', label: '管理', hint: '笔记本与目录' },
  { id: 'scope', label: '阅读', hint: '中间穿透阅读区' },
  { id: 'wread', label: 'wread', hint: 'AI 解读与追问' },
  { id: 'source', label: '原文', hint: 'OCR 原文对照' },
]
