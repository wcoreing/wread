import { useEffect, useRef, useState } from 'react'
import { Events } from '@wailsio/runtime'
import { Service } from '../../bindings/wread/internal/app'
import { resolveNotePlace, type NotePlaceId } from '../components/NotePlaceBar'

/** useNoteLayout 笔记贴靠/方位/宽度布局状态。 */
export function useNoteLayout() {
  const [docked, setDocked] = useState(true)
  const [notePlace, setNotePlace] = useState('right')
  const [sidebarW, setSidebarW] = useState(380)
  const skipSidebarSync = useRef(false)

  useEffect(() => {
    Service.GetLayoutSettings().then((s) => {
      setDocked(s.docked)
      setSidebarW(s.sidebarW || 380)
      setNotePlace(s.notePlace || (s.docked ? 'right' : 'popout'))
    }).catch(console.error)

    Events.On('layout:docked', (ev: { data: boolean }) => setDocked(ev.data))
    Events.On('layout:notePlace', (ev: { data: string }) => setNotePlace(ev.data))
    Events.On('layout:sidebarW', (ev: { data: number }) => {
      if (skipSidebarSync.current) return
      setSidebarW(ev.data)
    })
  }, [])

  const layoutPlace = resolveNotePlace(docked, notePlace)

  /** pickNotePlace 切换笔记位置或独立窗口。 */
  const pickNotePlace = async (place: NotePlaceId) => {
    await Service.SetNotePlace(place)
  }

  return { docked, sidebarW, setSidebarW, layoutPlace, pickNotePlace, skipSidebarSync }
}
