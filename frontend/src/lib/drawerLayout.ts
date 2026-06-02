const NOTEBOOK_LIST_OPEN_KEY = 'wread.notebookListOpen'
const NOTEBOOK_LIST_W_KEY = 'wread.notebookListW'
const LEGACY_SHELF_OPEN_KEY = 'wread.shelfOpen'

/** 笔记本浮层默认宽度（px）。 */
export const notebookListDefaultW = 300

/** 笔记本浮层最小/最大宽度（px）。 */
export const notebookListMinW = 220
export const notebookListMaxW = 520

/** readNotebookListOpen 笔记本列表浮层是否展开（默认收起）。 */
export function readNotebookListOpen(): boolean {
  const v = localStorage.getItem(NOTEBOOK_LIST_OPEN_KEY)
  if (v !== null) return v === '1'
  return localStorage.getItem(LEGACY_SHELF_OPEN_KEY) === '1'
}

/** saveNotebookListOpen 保存笔记本列表浮层展开状态。 */
export function saveNotebookListOpen(open: boolean) {
  localStorage.setItem(NOTEBOOK_LIST_OPEN_KEY, open ? '1' : '0')
}

/** readNotebookListWidth 读取笔记本浮层宽度。 */
export function readNotebookListWidth(): number {
  const saved = Number(localStorage.getItem(NOTEBOOK_LIST_W_KEY))
  if (!Number.isFinite(saved)) return notebookListDefaultW
  return Math.max(notebookListMinW, Math.min(notebookListMaxW, Math.round(saved)))
}

/** saveNotebookListWidth 保存笔记本浮层宽度。 */
export function saveNotebookListWidth(width: number) {
  const w = Math.max(notebookListMinW, Math.min(notebookListMaxW, Math.round(width)))
  localStorage.setItem(NOTEBOOK_LIST_W_KEY, String(w))
}

/** clampNotebookListWidth 按容器或视口限制笔记本侧栏宽度。 */
export function clampNotebookListWidth(width: number, containerW?: number): number {
  const base = containerW ?? window.innerWidth
  const maxByContainer = Math.max(notebookListMinW, Math.floor(base * 0.55))
  const max = Math.min(notebookListMaxW, maxByContainer)
  return Math.max(notebookListMinW, Math.min(max, Math.round(width)))
}
