import type { ButtonHTMLAttributes, MouseEvent } from 'react'
import { Window as WailsWindow } from '@wailsio/runtime'
import ToggleSwitch from './ToggleSwitch'
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
  onInterpret: () => void
}

/** ReaderEdgeRail 阅读器靠翻页侧内缘：解读。 */
export function ReaderEdgeRail({ interpreting, onInterpret }: ReaderEdgeRailProps) {
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
    </aside>
  )
}

type ContinuousControlsProps = {
  continuousRead: boolean
  continuousRunning: boolean
  onContinuousReadChange: (on: boolean) => void
  onStopContinuous: () => void
}

/** ContinuousControls 阅读区顶栏连续伴读开关。 */
export function ContinuousControls({
  continuousRead,
  continuousRunning,
  onContinuousReadChange,
  onStopContinuous,
}: ContinuousControlsProps) {
  const title = continuousRead
    ? '连续伴读已开启：解读后自动翻页继续'
    : '开启连续伴读：需阅读模式穿透翻页'

  return (
    <div className="overlay-continuous-group">
      <span className="overlay-continuous-label">连续</span>
      <ToggleSwitch
        className="overlay-continuous-toggle"
        checked={continuousRead}
        label="连续伴读"
        title={title}
        onChange={onContinuousReadChange}
      />
      {continuousRunning && (
        <button type="button" className="overlay-continuous-stop-btn" onClick={onStopContinuous}>
          停止
        </button>
      )}
    </div>
  )
}

type InterpretToolbarBtnProps = {
  interpreting: boolean
  onInterpret: () => void
}

/** InterpretToolbarBtn 阅读区顶栏解读按钮（布局居中时无内缘栏）。 */
export function InterpretToolbarBtn({ interpreting, onInterpret }: InterpretToolbarBtnProps) {
  return (
    <div className="overlay-interpret-group">
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
