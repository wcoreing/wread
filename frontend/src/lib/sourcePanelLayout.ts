export type SourceViewMode = 'image' | 'ocr'

const SOURCE_VIEW_KEY = 'wread.sourceViewMode'
const SOURCE_COLLAPSED_KEY = 'wread.sourceCollapsed'
const SOURCE_PANEL_W_KEY = 'wread.sourcePanelW'

/** 原文对照区默认宽度（px）。 */
export const sourcePanelDefaultW = 240

/** 原文对照区最小/最大宽度（px）。 */
export const sourcePanelMinW = 180
export const sourcePanelMaxW = 420

/** readSourceViewMode 读取原文对照显示模式。 */
export function readSourceViewMode(): SourceViewMode {
  const v = localStorage.getItem(SOURCE_VIEW_KEY)
  return v === 'ocr' ? 'ocr' : 'image'
}

/** saveSourceViewMode 保存原文对照显示模式。 */
export function saveSourceViewMode(mode: SourceViewMode) {
  localStorage.setItem(SOURCE_VIEW_KEY, mode)
}

/** readSourceCollapsed 原文对照是否收起（默认展开）。 */
export function readSourceCollapsed(): boolean {
  return localStorage.getItem(SOURCE_COLLAPSED_KEY) === '1'
}

/** saveSourceCollapsed 保存原文对照收起状态。 */
export function saveSourceCollapsed(collapsed: boolean) {
  localStorage.setItem(SOURCE_COLLAPSED_KEY, collapsed ? '1' : '0')
}

/** readSourcePanelWidth 读取原文对照区宽度。 */
export function readSourcePanelWidth(): number {
  const saved = Number(localStorage.getItem(SOURCE_PANEL_W_KEY))
  if (!Number.isFinite(saved)) return sourcePanelDefaultW
  return Math.max(sourcePanelMinW, Math.min(sourcePanelMaxW, Math.round(saved)))
}

/** saveSourcePanelWidth 保存原文对照区宽度。 */
export function saveSourcePanelWidth(width: number) {
  const w = Math.max(sourcePanelMinW, Math.min(sourcePanelMaxW, Math.round(width)))
  localStorage.setItem(SOURCE_PANEL_W_KEY, String(w))
}

/** clampSourcePanelWidth 按容器限制原文对照区宽度。 */
export function clampSourcePanelWidth(width: number, containerW: number): number {
  const maxByContainer = Math.max(sourcePanelMinW, Math.floor(containerW * 0.45))
  const max = Math.min(sourcePanelMaxW, maxByContainer)
  return Math.max(sourcePanelMinW, Math.min(max, Math.round(width)))
}
