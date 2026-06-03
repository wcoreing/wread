import { useCallback, useRef, type MouseEvent as ReactMouseEvent } from 'react'
import { Window as WailsWindow } from '@wailsio/runtime'
import { Service } from '../../bindings/wread/internal/app'

const dragThreshold = 6

/** usePillDrag Pill 窗口拖动；位移小于阈值时视为单击恢复。 */
export function usePillDrag(onRestore: () => void) {
  const sessionRef = useRef(0)
  const lastPosRef = useRef({ x: 0, y: 0 })

  /** onMouseDown 启动拖动或点击会话。 */
  const onMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      if (e.button !== 0) {
        return
      }
      e.preventDefault()
      e.stopPropagation()

      const sessionId = ++sessionRef.current
      const startScreenX = e.screenX
      const startScreenY = e.screenY
      let startX = 0
      let startY = 0
      let moved = false
      let rafId = 0

      const prime = WailsWindow.Position().then((pos) => {
        if (sessionRef.current !== sessionId) {
          return
        }
        startX = pos.x
        startY = pos.y
        lastPosRef.current = { x: pos.x, y: pos.y }
      })

      const onMove = (ev: MouseEvent) => {
        if (sessionRef.current !== sessionId) {
          return
        }
        const dx = ev.screenX - startScreenX
        const dy = ev.screenY - startScreenY
        if (!moved && Math.hypot(dx, dy) >= dragThreshold) {
          moved = true
        }
        if (!moved) {
          return
        }
        if (rafId) {
          return
        }
        rafId = window.requestAnimationFrame(() => {
          rafId = 0
          if (sessionRef.current !== sessionId) {
            return
          }
          void prime.then(() => {
            const x = Math.round(startX + dx)
            const y = Math.round(startY + dy)
            lastPosRef.current = { x, y }
            void WailsWindow.SetPosition(x, y).catch(console.error)
          })
        })
      }

      const onUp = () => {
        if (sessionRef.current !== sessionId) {
          return
        }
        sessionRef.current++
        if (rafId) {
          window.cancelAnimationFrame(rafId)
        }
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
        void prime.then(() => {
          if (moved) {
            const { x, y } = lastPosRef.current
            void Service.SavePillPosition(x, y).catch(console.error)
            return
          }
          onRestore()
        })
      }

      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
      void prime.catch(console.error)
    },
    [onRestore],
  )

  return { onMouseDown }
}
