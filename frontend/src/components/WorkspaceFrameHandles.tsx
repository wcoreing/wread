import type { MouseEvent as ReactMouseEvent } from 'react'
import type { FrameEdge } from '../hooks/useWorkspaceFrameDrag'

type Props = {
  onEdge: (edge: FrameEdge) => (e: ReactMouseEvent) => void
  /** hasNotePane 右侧业务区是否可见（纯阅读场景仅 scope 占右缘）。 */
  hasNotePane: boolean
}

/** WorkspaceFrameHandles 内嵌 Shell 布局的整窗外边框拖柄（左在管理区、右在笔记区）。 */
export default function WorkspaceFrameHandles({ onEdge, hasNotePane }: Props) {
  return (
    <>
      <div className="overlay-edge workspace-frame-edge workspace-frame-top" onMouseDown={onEdge('n')} />
      <div className="overlay-edge workspace-frame-edge workspace-frame-bottom" onMouseDown={onEdge('s')} />
      <div className="overlay-edge workspace-frame-edge workspace-frame-left" onMouseDown={onEdge('w')} />
      <div className="overlay-edge workspace-frame-edge workspace-frame-right" onMouseDown={onEdge('e')} />
      <div className="overlay-corner workspace-frame-corner workspace-frame-nw" onMouseDown={onEdge('nw')} />
      <div className="overlay-corner workspace-frame-corner workspace-frame-sw" onMouseDown={onEdge('sw')} />
      {hasNotePane ? (
        <>
          <div className="overlay-corner workspace-frame-corner workspace-frame-ne" onMouseDown={onEdge('ne')} />
          <div className="overlay-corner workspace-frame-corner workspace-frame-se" onMouseDown={onEdge('se')} />
        </>
      ) : (
        <>
          <div className="overlay-corner workspace-frame-corner workspace-frame-ne scope-frame-ne" onMouseDown={onEdge('ne')} />
          <div className="overlay-corner workspace-frame-corner workspace-frame-se scope-frame-se" onMouseDown={onEdge('se')} />
        </>
      )}
    </>
  )
}
