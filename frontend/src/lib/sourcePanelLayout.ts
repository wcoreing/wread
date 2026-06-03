export type SourceViewMode = 'image' | 'ocr'

const VIEW_MODE_KEY = 'wread.sourceViewMode'

/** readSourceViewMode 读取原文对照显示模式（截屏 / OCR 互斥）。 */
export function readSourceViewMode(): SourceViewMode {
  return localStorage.getItem(VIEW_MODE_KEY) === 'ocr' ? 'ocr' : 'image'
}

/** saveSourceViewMode 保存原文对照显示模式。 */
export function saveSourceViewMode(mode: SourceViewMode) {
  localStorage.setItem(VIEW_MODE_KEY, mode)
}
