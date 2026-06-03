import type { ComponentProps } from 'react'
import NotePaneBody from './NotePaneBody'

type NoteBodyProps = ComponentProps<typeof NotePaneBody>

type Props = {
  sourceCollapsed: boolean
  wreadVisible?: boolean
  className?: string
} & Omit<NoteBodyProps, 'className' | 'sourceCollapsed' | 'wreadVisible'>

/** NotebookPane 笔记内容区：wread 解读 + 原文对照。 */
export default function NotebookPane({
  sourceCollapsed,
  wreadVisible = true,
  className = 'notebook-pane-body',
  ...noteProps
}: Props) {
  return (
    <NotePaneBody
      {...noteProps}
      className={className}
      sourceCollapsed={sourceCollapsed}
      wreadVisible={wreadVisible}
    />
  )
}
