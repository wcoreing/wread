import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  clampNotebookListWidth,
  readNotebookListWidth,
  saveNotebookListWidth,
} from '../lib/drawerLayout'

/** useNotebookListWidth 笔记本侧栏宽度（拖内缘调整，持久化）。 */
export function useNotebookListWidth() {
  const [listW, setListW] = useState(readNotebookListWidth)
  const listWRef = useRef(listW)

  useEffect(() => {
    listWRef.current = listW
  }, [listW])

  useEffect(() => {
    const onResize = () => {
      setListW((w) => {
        const next = clampNotebookListWidth(w)
        if (next !== w) saveNotebookListWidth(next)
        return next
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  /** startWidthDrag 拖动侧栏内缘调整宽度。 */
  const startWidthDrag = useCallback((startX: number, containerW: number) => {
    const startW = listWRef.current
    const onMove = (ev: MouseEvent) => {
      const next = clampNotebookListWidth(startW + ev.clientX - startX, containerW)
      setListW(next)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      saveNotebookListWidth(listWRef.current)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  const panelStyle = { '--notebook-list-w': `${listW}px` } as CSSProperties

  return { listW, panelStyle, startWidthDrag }
}
