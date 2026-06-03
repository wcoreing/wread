import type { ComponentProps } from 'react'
import NotePaneBody from './NotePaneBody'
import type { SessionDO } from '../../bindings/wread/internal/model'

type NoteBodyProps = ComponentProps<typeof NotePaneBody>

type Props = {
  notebooks: SessionDO[]
  activeNotebookId: string
  listOpen: boolean
  onOpenNotebook: (id: string) => void
  onCreateNotebook: () => void
  onDeleteNotebook: (id: string) => void
  onBatchDeleteNotebooks: (ids: string[]) => void
  className?: string
} & Omit<
  NoteBodyProps,
  | 'className'
  | 'notebooks'
  | 'activeNotebookId'
  | 'listOpen'
  | 'onOpenNotebook'
  | 'onCreateNotebook'
  | 'onDeleteNotebook'
  | 'onBatchDeleteNotebooks'
>

/** NotebookPane 笔记区：笔记本侧栏 + 目录 + 解读正文。 */
export default function NotebookPane({
  notebooks,
  activeNotebookId,
  listOpen,
  onOpenNotebook,
  onCreateNotebook,
  onDeleteNotebook,
  onBatchDeleteNotebooks,
  className = 'notebook-pane-body',
  ...noteProps
}: Props) {
  return (
    <NotePaneBody
      {...noteProps}
      className={className}
      notebooks={notebooks}
      activeNotebookId={activeNotebookId}
      listOpen={listOpen}
      onOpenNotebook={onOpenNotebook}
      onCreateNotebook={onCreateNotebook}
      onDeleteNotebook={onDeleteNotebook}
      onBatchDeleteNotebooks={onBatchDeleteNotebooks}
    />
  )
}
