import { useCallback, useEffect, useState } from 'react'
import { Events } from '@wailsio/runtime'
import { readNotebookListOpen, saveNotebookListOpen } from '../lib/drawerLayout'

/** useNotebookListOverlay 笔记本列表侧栏展开态（Esc 收起，持久化）。 */
export function useNotebookListOverlay() {
  const [listOpen, setListOpenState] = useState(readNotebookListOpen)

  /** setListOpen 展开或收起笔记本列表。 */
  const setListOpen = useCallback((open: boolean) => {
    setListOpenState(open)
    saveNotebookListOpen(open)
  }, [])

  /** toggleList 切换笔记本列表浮层。 */
  const toggleList = useCallback(() => {
    setListOpenState((v) => {
      const next = !v
      saveNotebookListOpen(next)
      return next
    })
  }, [])

  useEffect(() => {
    return Events.On('layout:notebookListToggle', () => {
      toggleList()
    })
  }, [toggleList])

  useEffect(() => {
    if (!listOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setListOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [listOpen, setListOpen])

  return { listOpen, setListOpen, toggleList }
}
