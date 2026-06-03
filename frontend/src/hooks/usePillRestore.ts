import { useEffect } from 'react'
import { Events } from '@wailsio/runtime'
import type { NoteMenu } from '../components/NoteToolbar'

/** usePillRestore 监听 Pill 恢复事件，同步笔记顶栏 Tab。 */
export function usePillRestore(onRestoreMenu: (menu: NoteMenu) => void) {
  useEffect(() => {
    Events.On('pill:restored', (ev: { data: string }) => {
      const menu = ev.data === 'settings' ? 'settings' : 'note'
      onRestoreMenu(menu)
    })
  }, [onRestoreMenu])
}
