import { useCallback } from 'react'
import { Service } from '../../bindings/wread/internal/app'
import { useSystemTheme } from '../hooks/useSystemTheme'
import { usePillDrag } from '../hooks/usePillDrag'
import './pill.css'

/** PillPage 最小化悬浮图标：拖动定位，单击恢复上次窗口。 */
export default function PillPage() {
  useSystemTheme()
  const restore = useCallback(() => {
    void Service.RestoreFromPill().catch(console.error)
  }, [])
  const drag = usePillDrag(restore)

  return (
    <div className="pill-root">
      <button
        type="button"
        className="pill-btn"
        title="拖动定位 · 单击恢复窗口"
        aria-label="Wread 悬浮图标，拖动定位，单击恢复窗口"
        onMouseDown={drag.onMouseDown}
      >
        <span className="pill-mark">w</span>
      </button>
    </div>
  )
}
