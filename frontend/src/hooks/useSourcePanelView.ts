import { useCallback, useState } from 'react'
import { readSourceViewMode, saveSourceViewMode, type SourceViewMode } from '../lib/sourcePanelLayout'

/** useSourcePanelView 原文对照区截屏 / OCR 互斥显示偏好。 */
export function useSourcePanelView() {
  const [viewMode, setViewModeState] = useState(readSourceViewMode)

  /** setViewMode 切换截屏或 OCR 显示。 */
  const setViewMode = useCallback((mode: SourceViewMode) => {
    setViewModeState(mode)
    saveSourceViewMode(mode)
  }, [])

  return { viewMode, setViewMode }
}
