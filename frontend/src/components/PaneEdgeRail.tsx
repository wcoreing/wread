import type { ButtonHTMLAttributes, MouseEvent } from 'react'
import { Window as WailsWindow } from '@wailsio/runtime'
import './edgeRail.css'

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean
  interpret?: boolean
}

/** EdgeRailBtn 内缘竖条按钮（竖排文案）。 */
export function EdgeRailBtn({ active, interpret, className = '', ...rest }: BtnProps) {
  const extra = [
    'edge-rail-btn',
    active ? 'active' : '',
    interpret ? 'interpret' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return <button type="button" className={extra} {...rest} />
}

/** onEdgeRailFocus 内缘按钮按下时聚焦窗口（不 preventDefault，避免 Web 收不到 click）。 */
export function onEdgeRailFocus(e: MouseEvent<HTMLButtonElement>) {
  e.stopPropagation()
  void WailsWindow.Focus().catch(console.error)
}

/** onEdgeRailClick 内缘按钮点击；完成后 blur，避免 focus 样式像常亮。 */
export function onEdgeRailClick(action: () => void) {
  return (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    action()
    e.currentTarget.blur()
  }
}

type ReaderEdgeRailProps = {
  interpreting: boolean
  continuousRead: boolean
  continuousRunning: boolean
  onInterpret: () => void
  onContinuousReadChange: (on: boolean) => void
  onStopContinuous: () => void
}

/** ReaderEdgeRail 阅读器靠翻页侧内缘：解读与连续伴读。 */
export function ReaderEdgeRail({
  interpreting,
  continuousRead,
  continuousRunning,
  onInterpret,
  onContinuousReadChange,
  onStopContinuous,
}: ReaderEdgeRailProps) {
  return (
    <aside className="pane-edge-rail pane-edge-rail-reader" aria-label="解读">
      <EdgeRailBtn
        interpret
        disabled={interpreting}
        className={interpreting ? 'busy' : ''}
        title={interpreting ? '解读中…' : '解读当前页'}
        onMouseDown={onEdgeRailFocus}
        onClick={onEdgeRailClick(onInterpret)}
      >
        {interpreting ? '解读中' : '解读'}
      </EdgeRailBtn>
      {continuousRunning ? (
        <EdgeRailBtn
          className="continuous-stop"
          title="停止连续伴读"
          onMouseDown={onEdgeRailFocus}
          onClick={onEdgeRailClick(onStopContinuous)}
        >
          停止
        </EdgeRailBtn>
      ) : (
        <EdgeRailBtn
          active={continuousRead}
          title={continuousRead ? '连续伴读已开启：解读后自动翻页继续' : '开启连续伴读'}
          onMouseDown={onEdgeRailFocus}
          onClick={onEdgeRailClick(() => onContinuousReadChange(!continuousRead))}
        >
          连续
        </EdgeRailBtn>
      )}
    </aside>
  )
}

type InterpretControlsProps = {
  interpreting: boolean
  continuousRead: boolean
  continuousRunning: boolean
  onInterpret: () => void
  onContinuousReadChange: (on: boolean) => void
  onStopContinuous: () => void
}

/** InterpretControls 顶栏解读与连续伴读控件。 */
export function InterpretControls({
  interpreting,
  continuousRead,
  continuousRunning,
  onInterpret,
  onContinuousReadChange,
  onStopContinuous,
}: InterpretControlsProps) {
  return (
    <div className="overlay-interpret-group">
      <button
        type="button"
        className={`overlay-continuous-btn${continuousRead ? ' active' : ''}`}
        title={continuousRead ? '连续伴读已开启' : '开启连续伴读：解读后自动翻页继续'}
        disabled={continuousRunning}
        onClick={() => onContinuousReadChange(!continuousRead)}
      >
        连续
      </button>
      {continuousRunning && (
        <button type="button" className="overlay-continuous-stop-btn" onClick={onStopContinuous}>
          停止
        </button>
      )}
      <button
        type="button"
        className="overlay-interpret-btn"
        disabled={interpreting}
        onClick={onInterpret}
      >
        {interpreting ? '解读中…' : '解读'}
      </button>
    </div>
  )
}
