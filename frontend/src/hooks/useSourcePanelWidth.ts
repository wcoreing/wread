import { useCallback, useState, type CSSProperties } from 'react'
import {
  clampSourcePanelWidth,
  readSourcePanelWidth,
  saveSourcePanelWidth,
} from '../lib/sourcePanelLayout'

/** useSourcePanelWidth 原文对照区宽度与拖拽。 */
export function useSourcePanelWidth() {
  const [panelW, setPanelW] = useState(readSourcePanelWidth)

  const panelStyle = {
    '--source-panel-w': `${panelW}px`,
    width: panelW,
  } as CSSProperties

  /** startWidthDrag 拖动调整原文对照区宽度。 */
  const startWidthDrag = useCallback((startX: number, containerW: number) => {
    const startW = panelW
    const onMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX
      const next = clampSourcePanelWidth(startW + delta, containerW)
      setPanelW(next)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      setPanelW((w) => {
        saveSourcePanelWidth(w)
        return w
      })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [panelW])

  return { panelW, panelStyle, startWidthDrag }
}
