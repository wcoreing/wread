import { useCallback, useRef, type MouseEvent as ReactMouseEvent } from 'react'
import { Window as WailsWindow } from '@wailsio/runtime'
import { Service } from '../../bindings/wread/internal/app'

/** 窗口边框缩放方向（n/s/e/w 及四角组合）。 */
export type FrameEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

type DragMode = FrameEdge | 'move'

type FrameRect = { x: number; y: number; w: number; h: number }

type FrameMinSize = { minW: number; minH: number }

const defaultMin: FrameMinSize = { minW: 560, minH: 180 }

/** clampFrameRect 按最小尺寸约束窗口 bounds，上/左缩放时同步修正原点。 */
function clampFrameRect(
  edge: FrameEdge,
  start: FrameRect,
  next: FrameRect,
  min: FrameMinSize,
): FrameRect {
  let { x, y, w, h } = next
  if (w < min.minW) {
    if (edge.includes('w')) {
      x = start.x + start.w - min.minW
    }
    w = min.minW
  }
  if (h < min.minH) {
    if (edge.includes('n')) {
      y = start.y + start.h - min.minH
    }
    h = min.minH
  }
  return { x, y, w, h }
}

/** calcFrameRect 根据屏幕位移计算缩放后的窗口 bounds。 */
function calcFrameRect(
  edge: FrameEdge,
  start: FrameRect,
  dx: number,
  dy: number,
  min: FrameMinSize,
): FrameRect {
  let { x, y, w, h } = start
  if (edge.includes('n')) {
    y = start.y + dy
    h = start.h - dy
  }
  if (edge.includes('s')) {
    h = start.h + dy
  }
  if (edge.includes('w')) {
    x = start.x + dx
    w = start.w - dx
  }
  if (edge.includes('e')) {
    w = start.w + dx
  }
  return clampFrameRect(edge, start, { x, y, w, h }, min)
}

/** calcMoveRect 顶栏拖动时的平移 bounds。 */
function calcMoveRect(start: FrameRect, dx: number, dy: number): FrameRect {
  return { x: start.x + dx, y: start.y + dy, w: start.w, h: start.h }
}

/** applyWindowBounds 经 Wails Runtime 改窗口 frame，拖拽热路径不走 Go Service。 */
async function applyWindowBounds(rect: FrameRect, mode: DragMode): Promise<void> {
  const x = Math.round(rect.x)
  const y = Math.round(rect.y)
  const w = Math.round(rect.w)
  const h = Math.round(rect.h)
  const posChanged = mode === 'move' || mode.includes('n') || mode.includes('w')
  const sizeChanged = mode !== 'move'
  if (posChanged) {
    await WailsWindow.SetPosition(x, y)
  }
  if (sizeChanged) {
    await WailsWindow.SetSize(w, h)
  }
}

/** useWorkspaceFrameDrag 顶栏移动 + 边框缩放；Runtime 改窗，松手后 Go 持久化。 */
export function useWorkspaceFrameDrag(resizeEnabled: boolean, limits?: FrameMinSize) {
  const sessionRef = useRef(0)
  const minRef = useRef(limits ?? defaultMin)
  minRef.current = limits ?? defaultMin

  /** beginSession 启动一次拖拽会话（move 或 resize）。 */
  const beginSession = useCallback((mode: DragMode, e: ReactMouseEvent) => {
    if (e.button !== 0) {
      return
    }
    if (mode !== 'move' && !resizeEnabled) {
      return
    }
    e.preventDefault()
    e.stopPropagation()

    const sessionId = ++sessionRef.current
    const startScreenX = e.screenX
    const startScreenY = e.screenY
    let startFrame: FrameRect | null = null
    let rafId = 0

    void Service.BeginWorkspaceFrameDrag().catch(console.error)

    const prime = Promise.all([WailsWindow.Position(), WailsWindow.Size()]).then(([pos, size]) => {
      if (sessionRef.current !== sessionId) {
        return
      }
      startFrame = { x: pos.x, y: pos.y, w: size.width, h: size.height }
    })

    const onMove = (ev: MouseEvent) => {
      if (sessionRef.current !== sessionId) {
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
          if (!startFrame || sessionRef.current !== sessionId) {
            return
          }
          const dx = ev.screenX - startScreenX
          const dy = ev.screenY - startScreenY
          const rect =
            mode === 'move'
              ? calcMoveRect(startFrame, dx, dy)
              : calcFrameRect(mode, startFrame, dx, dy, minRef.current)
          void applyWindowBounds(rect, mode).catch(console.error)
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
      void Service.FinishWorkspaceResize().catch(console.error)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    void prime.catch(console.error)
  }, [resizeEnabled])

  /** start 在边框 mousedown 时启动缩放。 */
  const start = useCallback(
    (edge: FrameEdge, e: ReactMouseEvent) => {
      beginSession(edge, e)
    },
    [beginSession],
  )

  /** startMove 顶栏空白区拖动移动窗口。 */
  const startMove = useCallback(
    (e: ReactMouseEvent) => {
      beginSession('move', e)
    },
    [beginSession],
  )

  return { start, startMove }
}
