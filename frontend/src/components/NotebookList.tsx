import { useState } from 'react'
import type { SessionDO } from '../../bindings/wread/internal/model'
import ConfirmDialog from './ConfirmDialog'
import { describeNotebookDelete } from '../lib/catalogSelection'

type Props = {
  notebooks: SessionDO[]
  activeNotebookId: string
  onOpen: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
  onBatchDelete: (ids: string[]) => void
  onClose?: () => void
}

type ConfirmState = { ids: string[] } | null

/** formatNotebookTime 格式化为简短日期。 */
function formatNotebookTime(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts * 1000)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })
}

/** NotebookList 笔记本列表侧栏。 */
export default function NotebookList({
  notebooks,
  activeNotebookId,
  onOpen,
  onCreate,
  onDelete,
  onBatchDelete,
  onClose,
}: Props) {
  const [batchMode, setBatchMode] = useState(false)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set())
  const [confirm, setConfirm] = useState<ConfirmState>(null)

  const confirmNames =
    confirm?.ids.map((id) => notebooks.find((n) => n.id === id)?.notebookName?.trim() || '未命名笔记本') ?? []
  const confirmCopy = describeNotebookDelete(confirmNames)

  /** toggleBatchMode 切换批量选择模式。 */
  const toggleBatchMode = () => {
    setBatchMode((v) => {
      if (v) setCheckedIds(new Set())
      return !v
    })
  }

  /** runConfirmedDelete 确认后删除。 */
  const runConfirmedDelete = () => {
    if (!confirm) return
    if (confirm.ids.length === 1) onDelete(confirm.ids[0])
    else onBatchDelete(confirm.ids)
    setConfirm(null)
    setCheckedIds(new Set())
    setBatchMode(false)
  }

  const checkedCount = checkedIds.size

  return (
    <div className="notebook-list">
      <ConfirmDialog
        open={confirm !== null}
        title={confirmCopy.title}
        message={confirmCopy.message}
        onConfirm={runConfirmedDelete}
        onCancel={() => setConfirm(null)}
      />
      <div className="notebook-list-head">
        <span className="notebook-list-title">{batchMode ? `已选 ${checkedCount}` : '全部笔记本'}</span>
        <div className="notebook-list-head-actions">
          {batchMode ? (
            <>
              <button
                type="button"
                className="notebook-list-batch"
                onClick={() => setCheckedIds(new Set(notebooks.map((n) => n.id)))}
                disabled={notebooks.length === 0}
              >
                全选
              </button>
              <button
                type="button"
                className="notebook-list-batch danger"
                disabled={checkedCount === 0}
                onClick={() => setConfirm({ ids: [...checkedIds] })}
              >
                删除
              </button>
              <button type="button" className="notebook-list-batch" onClick={toggleBatchMode}>
                完成
              </button>
            </>
          ) : (
            <>
              <button type="button" className="notebook-list-batch" onClick={toggleBatchMode} disabled={notebooks.length === 0}>
                批量
              </button>
              <button type="button" className="notebook-list-new" title="新建笔记本" onClick={onCreate}>
                +
              </button>
            </>
          )}
          {onClose && (
            <button type="button" className="notebook-list-close" title="关闭 (Esc)" onClick={onClose}>
              ×
            </button>
          )}
        </div>
      </div>
      <ul className="notebook-list-items">
        {notebooks.length === 0 && <li className="notebook-list-empty">点 + 新建笔记本</li>}
        {notebooks.map((nb) => {
          const active = nb.id === activeNotebookId
          const label = nb.notebookName?.trim() || '未命名笔记本'
          const checked = checkedIds.has(nb.id)
          return (
            <li key={nb.id} className={`notebook-list-item ${active ? 'active' : ''} ${checked ? 'checked' : ''}`}>
              {batchMode ? (
                <label className="notebook-list-item-check">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      setCheckedIds((prev) => {
                        const next = new Set(prev)
                        if (e.target.checked) next.add(nb.id)
                        else next.delete(nb.id)
                        return next
                      })
                    }}
                  />
                  <span className="notebook-list-item-name">{label}</span>
                  <span className="notebook-list-item-time">{formatNotebookTime(nb.updatedAt)}</span>
                </label>
              ) : (
                <button type="button" className="notebook-list-item-btn" onClick={() => onOpen(nb.id)}>
                  <span className="notebook-list-item-name">{label}</span>
                  <span className="notebook-list-item-time">{formatNotebookTime(nb.updatedAt)}</span>
                </button>
              )}
              {!batchMode && (
                <button
                  type="button"
                  className="notebook-list-item-del"
                  title="删除笔记本"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setConfirm({ ids: [nb.id] })
                  }}
                >
                  ×
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
