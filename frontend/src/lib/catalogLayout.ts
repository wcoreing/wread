export type CatalogSide = 'left' | 'right'

const CATALOG_SIDE_KEY = 'wread.catalogSide'
const CATALOG_PANEL_W_KEY = 'wread.catalogPanelW'

/** 目录侧栏默认宽度（px）。 */
export const catalogPanelDefaultW = 280

/** 目录侧栏最小/最大宽度（px）。 */
export const catalogPanelMinW = 200
export const catalogPanelMaxW = 480

/** readCatalogPanelWidth 读取目录侧栏宽度。 */
export function readCatalogPanelWidth(): number {
  const saved = Number(localStorage.getItem(CATALOG_PANEL_W_KEY))
  if (!Number.isFinite(saved)) return catalogPanelDefaultW
  return Math.max(catalogPanelMinW, Math.min(catalogPanelMaxW, Math.round(saved)))
}

/** saveCatalogPanelWidth 保存目录侧栏宽度。 */
export function saveCatalogPanelWidth(width: number) {
  const w = Math.max(catalogPanelMinW, Math.min(catalogPanelMaxW, Math.round(width)))
  localStorage.setItem(CATALOG_PANEL_W_KEY, String(w))
}

/** clampCatalogPanelWidth 按笔记区宽度限制目录侧栏。 */
export function clampCatalogPanelWidth(width: number, containerW: number): number {
  const maxByContainer = Math.max(catalogPanelMinW, Math.floor(containerW * 0.55))
  const max = Math.min(catalogPanelMaxW, maxByContainer)
  return Math.max(catalogPanelMinW, Math.min(max, Math.round(width)))
}

/** readCatalogSide 读取目录侧栏位置。 */
export function readCatalogSide(): CatalogSide {
  return localStorage.getItem(CATALOG_SIDE_KEY) === 'right' ? 'right' : 'left'
}

/** saveCatalogSide 保存目录侧栏位置。 */
export function saveCatalogSide(side: CatalogSide) {
  localStorage.setItem(CATALOG_SIDE_KEY, side)
}

/** catalogSplitterLabel 目录分割条收起/展开文案。 */
export function catalogSplitterLabel(_side: CatalogSide, collapsed: boolean) {
  return collapsed ? '展开目录' : '收起目录'
}

/** notebookRailLabel 分割条笔记本按钮文案（固定，态由 active 样式表达）。 */
export function notebookRailLabel() {
  return '笔记本'
}

/** catalogRailLabel 分割条目录按钮文案（固定，态由 active 样式表达）。 */
export function catalogRailLabel() {
  return '目录'
}

/** catalogSplitterGlyph 根据目录位置与收起态返回分割按钮箭头（已弃用，保留兼容）。 */
export function catalogSplitterGlyph(side: CatalogSide, collapsed: boolean) {
  if (side === 'left') return collapsed ? '›' : '‹'
  return collapsed ? '‹' : '›'
}
