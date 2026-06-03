import { useEffect, useRef, useState } from 'react'
import ChoiceSelect from './ChoiceSelect'
import NotebookList from './NotebookList'
import type { SessionDO } from '../../bindings/wread/internal/model'

type Props = {
  notebooks: SessionDO[]
  activeNotebookId: string
  onOpen: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
  onBatchDelete: (ids: string[]) => void
}

/** NotebookSwitcher 顶栏笔记本切换 + 新建 + 管理。 */
export default function NotebookSwitcher({
  notebooks,
  activeNotebookId,
  onOpen,
  onCreate,
  onDelete,
  onBatchDelete,
}: Props) {
  const [manageOpen, setManageOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const options = notebooks.map((nb) => ({
    value: nb.id,
    label: nb.notebookName?.trim() || '未命名笔记本',
  }))
  const selectValue = options.some((o) => o.value === activeNotebookId) ? activeNotebookId : options[0]?.value ?? ''

  useEffect(() => {
    if (!manageOpen) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setManageOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setManageOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [manageOpen])

  return (
    <div ref={rootRef} className={`notebook-switcher${manageOpen ? ' manage-open' : ''}`}>
      <ChoiceSelect
        className="notebook-switcher-select"
        value={selectValue}
        options={options}
        placeholder={notebooks.length === 0 ? '暂无笔记本' : '选择笔记本'}
        title="切换笔记本"
        disabled={notebooks.length === 0}
        onChange={onOpen}
      />
      <button type="button" className="notebook-switcher-new" title="新建笔记本" onClick={onCreate}>
        +
      </button>
      <button
        type="button"
        className="notebook-switcher-more"
        title="管理笔记本"
        aria-expanded={manageOpen}
        disabled={notebooks.length === 0}
        onClick={() => setManageOpen((v) => !v)}
      >
        ···
      </button>
      {manageOpen && (
        <div className="notebook-manage-popover">
          <NotebookList
            notebooks={notebooks}
            activeNotebookId={activeNotebookId}
            onOpen={(id) => {
              onOpen(id)
              setManageOpen(false)
            }}
            onCreate={() => {
              onCreate()
              setManageOpen(false)
            }}
            onDelete={onDelete}
            onBatchDelete={onBatchDelete}
            onClose={() => setManageOpen(false)}
          />
        </div>
      )}
    </div>
  )
}
