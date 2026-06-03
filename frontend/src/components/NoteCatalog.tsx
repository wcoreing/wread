import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Service } from '../../bindings/wread/internal/app'
import type { CatalogNodeDO } from '../../bindings/wread/internal/model'
import CatalogContextMenu from './CatalogContextMenu'
import ConfirmDialog from './ConfirmDialog'
import {
  allNodeIds,
  allPageIds,
  collectDescendantIds,
  describeCatalogDelete,
  formatBindingError,
  pageIdsFromChecked,
} from '../lib/catalogSelection'
import {
  computeCatalogMove,
  readCatalogDragPayload,
  resolveDropPlace,
  setCatalogDragData,
  type CatalogDropHint,
} from '../lib/catalogDrag'
import { buildCatalogTree, isChapter, type CatalogTreeNode } from '../lib/catalogTree'
import type { CatalogSide } from '../lib/catalogLayout'
import { catalogFontSizeMax, catalogFontSizeMin } from '../lib/catalogLayout'

type Props = {
  notebookName: string
  onNotebookNameChange: (name: string) => void
  nodes: CatalogNodeDO[]
  selectedChapterId: string
  selectedPageId: string
  onSelectChapter: (node: CatalogNodeDO) => void
  onSelectPage: (node: CatalogNodeDO) => void
  onRename: (node: CatalogNodeDO, title: string) => void
  onDelete: (node: CatalogNodeDO) => void
  onBatchDelete: (ids: string[]) => void
  onMove: (nodeId: string, parentId: string, index: number) => void
  onCreateChapter: (parentId: string) => void
  catalogSide: CatalogSide
  onToggleCatalogSide: () => void
  hideSideToggle?: boolean
  panelStyle?: CSSProperties
  fontSize?: number
  onFontSizeChange?: (size: number) => void
  resizeEdge?: 'left' | 'right'
  onResizeStart?: (startX: number, containerW: number) => void
  scrollToNodeId?: string
  onScrollToNodeDone?: () => void
  onOrganizeApplied?: () => void
  onOrganizeError?: (msg: string) => void
}

type ConfirmState =
  | { kind: 'single'; node: CatalogNodeDO }
  | { kind: 'batch'; ids: string[] }
  | null

type ContextTarget =
  | { kind: 'notebook' }
  | { kind: 'node'; node: CatalogNodeDO }

type NodeProps = {
  node: CatalogTreeNode
  depth: number
  pageIndex: number
  batchMode: boolean
  checkedIds: Set<string>
  dragId: string
  dropHint: CatalogDropHint | null
  pendingRenameId: string
  onConsumePendingRename: () => void
  onToggleCheck: (node: CatalogNodeDO, checked: boolean) => void
  selectedChapterId: string
  selectedPageId: string
  onSelectChapter: (node: CatalogNodeDO) => void
  onSelectPage: (node: CatalogNodeDO) => void
  onRename: (node: CatalogNodeDO, title: string) => void
  onRequestDelete: (node: CatalogNodeDO) => void
  onContextMenu: (e: React.MouseEvent, node: CatalogNodeDO) => void
  onDragStart: (nodeId: string) => void
  onDragEnd: () => void
  onRowDragOver: (e: React.DragEvent, node: CatalogNodeDO) => void
  onRowDrop: (e: React.DragEvent, node: CatalogNodeDO) => void
  openChapterIds: Set<string>
}

/** pageLabelText 笔记页完整标题文案。 */
function pageLabelText(pageIndex: number, title: string): string {
  return `第${pageIndex}页 ${title || '未命名'}`
}

/** CatalogTreeNodeRow 章节树单行。 */
function CatalogTreeNodeRow({
  node,
  depth,
  pageIndex,
  batchMode,
  checkedIds,
  dragId,
  dropHint,
  pendingRenameId,
  onConsumePendingRename,
  onToggleCheck,
  selectedChapterId,
  selectedPageId,
  onSelectChapter,
  onSelectPage,
  onRename,
  onRequestDelete,
  onContextMenu,
  onDragStart,
  onDragEnd,
  onRowDragOver,
  onRowDrop,
  openChapterIds,
}: NodeProps) {
  const [open, setOpen] = useState(true)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(node.title)
  const chapter = isChapter(node)
  const hasChildren = node.children.length > 0
  const active = chapter ? selectedChapterId === node.id : selectedPageId === node.id
  const checked = checkedIds.has(node.id)
  const isDragging = dragId === node.id
  const dropOn = dropHint && dropHint.targetId === node.id ? `drop-${dropHint.place}` : ''
  const fullTitle = chapter ? node.title || '未命名' : pageLabelText(pageIndex, node.title)

  useEffect(() => {
    if (chapter && openChapterIds.has(node.id)) {
      setOpen(true)
    }
  }, [chapter, node.id, openChapterIds])

  useEffect(() => {
    if (pendingRenameId === node.id) {
      setDraft(node.title)
      setEditing(true)
      onConsumePendingRename()
    }
  }, [pendingRenameId, node.id, node.title, onConsumePendingRename])

  const commitRename = () => {
    const title = draft.trim()
    setEditing(false)
    if (title && title !== node.title) onRename(node, title)
    else setDraft(node.title)
  }

  const handleSelect = () => {
    if (batchMode) {
      onToggleCheck(node, !checked)
      return
    }
    if (chapter) onSelectChapter(node)
    else onSelectPage(node)
  }

  let pageCounter = 0

  return (
    <div className={`catalog-branch ${chapter ? 'is-chapter' : 'is-page'}`}>
      <div
        className={`catalog-row ${active && !batchMode ? 'active' : ''} ${checked ? 'checked' : ''} ${isDragging ? 'dragging' : ''} ${dropOn} ${chapter ? 'chapter-row' : 'page-row'}`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        data-catalog-id={node.id}
        onDragOver={(e) => onRowDragOver(e, node)}
        onDrop={(e) => onRowDrop(e, node)}
      >
        {batchMode ? (
          <input
            type="checkbox"
            className="catalog-check"
            checked={checked}
            aria-label={chapter ? `选择章节 ${node.title}` : `选择笔记 ${node.title}`}
            onChange={(e) => {
              e.stopPropagation()
              onToggleCheck(node, e.target.checked)
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : chapter && hasChildren ? (
          <button type="button" className="catalog-toggle" onClick={() => setOpen((v) => !v)} aria-label={open ? '收起' : '展开'}>
            {open ? '▾' : '▸'}
          </button>
        ) : null}
        {batchMode && chapter && hasChildren && (
          <button type="button" className="catalog-toggle" onClick={() => setOpen((v) => !v)} aria-label={open ? '收起' : '展开'}>
            {open ? '▾' : '▸'}
          </button>
        )}
        {editing ? (
          <input
            className="catalog-edit"
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') {
                setDraft(node.title)
                setEditing(false)
              }
            }}
          />
        ) : (
          <>
            {!batchMode && (
              <span
                className="catalog-drag-handle"
                draggable
                title="拖动排序"
                aria-label="拖动排序"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onDragStart={(e) => {
                  setCatalogDragData(e.dataTransfer, node.id)
                  onDragStart(node.id)
                }}
                onDragEnd={onDragEnd}
              />
            )}
            <div
              role="button"
              tabIndex={0}
              className="catalog-label"
              title={fullTitle}
              onClick={handleSelect}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleSelect()
                }
              }}
              onContextMenu={(e) => onContextMenu(e, node)}
            >
              {chapter ? (
                <span className="catalog-label-text">{node.title || '未命名'}</span>
              ) : (
                <>
                  <span className="page-no">第{pageIndex}页</span>
                  <span className="page-title">{node.title || '未命名'}</span>
                </>
              )}
            </div>
          </>
        )}
        {!batchMode && (
          <button
            type="button"
            className="catalog-del"
            title="删除"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onRequestDelete(node)
            }}
          >
            ×
          </button>
        )}
      </div>
      {hasChildren && open && node.children.map((child) => {
        const childPageIndex = isChapter(child) ? 0 : ++pageCounter
        return (
          <CatalogTreeNodeRow
            key={child.id}
            node={child}
            depth={depth + 1}
            pageIndex={childPageIndex}
            batchMode={batchMode}
            checkedIds={checkedIds}
            dragId={dragId}
            dropHint={dropHint}
            pendingRenameId={pendingRenameId}
            onConsumePendingRename={onConsumePendingRename}
            onToggleCheck={onToggleCheck}
            selectedChapterId={selectedChapterId}
            selectedPageId={selectedPageId}
            onSelectChapter={onSelectChapter}
            onSelectPage={onSelectPage}
            onRename={onRename}
            onRequestDelete={onRequestDelete}
            onContextMenu={onContextMenu}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onRowDragOver={onRowDragOver}
            onRowDrop={onRowDrop}
            openChapterIds={openChapterIds}
          />
        )
      })}
    </div>
  )
}

/** NoteCatalog 书名 + 章节树侧栏。 */
export default function NoteCatalog({
  notebookName,
  onNotebookNameChange,
  nodes,
  selectedChapterId,
  selectedPageId,
  onSelectChapter,
  onSelectPage,
  onRename,
  onDelete,
  onBatchDelete,
  onMove,
  onCreateChapter,
  catalogSide,
  onToggleCatalogSide,
  hideSideToggle = false,
  panelStyle,
  fontSize,
  onFontSizeChange,
  resizeEdge,
  onResizeStart,
  scrollToNodeId = '',
  onScrollToNodeDone,
  onOrganizeApplied,
  onOrganizeError,
}: Props) {
  const tree = useMemo(() => buildCatalogTree(nodes), [nodes])
  const [batchMode, setBatchMode] = useState(false)
  const [organizeMode, setOrganizeMode] = useState(false)
  const [organizing, setOrganizing] = useState(false)
  const checkMode = batchMode || organizeMode
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set())
  const [openChapterIds, setOpenChapterIds] = useState<Set<string>>(() => new Set())
  const listRef = useRef<HTMLDivElement>(null)
  const [confirm, setConfirm] = useState<ConfirmState>(null)
  const [dragId, setDragId] = useState('')
  const [dropHint, setDropHint] = useState<CatalogDropHint | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; target: ContextTarget } | null>(null)
  const [pendingRenameId, setPendingRenameId] = useState('')
  const nodesRef = useRef(nodes)
  const notebookInputRef = useRef<HTMLInputElement>(null)
  nodesRef.current = nodes

  const confirmCopy = confirm
    ? describeCatalogDelete(nodes, confirm.kind === 'single' ? [confirm.node.id] : confirm.ids)
    : { title: '', message: '' }

  /** scrollToEntryNode 录入成功后展开章节并滚到目录底部。 */
  useEffect(() => {
    if (!scrollToNodeId) return
    const target = nodes.find((n) => n.id === scrollToNodeId)
    if (target?.kind === 'page' && target.parentId) {
      setOpenChapterIds((prev) => {
        const next = new Set(prev)
        next.add(target.parentId)
        return next
      })
    }
  }, [scrollToNodeId, nodes])

  useEffect(() => {
    if (!scrollToNodeId) return
    const timer = window.setTimeout(() => {
      const list = listRef.current
      if (!list) {
        onScrollToNodeDone?.()
        return
      }
      const row = list.querySelector(`[data-catalog-id="${scrollToNodeId}"]`)
      if (row) {
        row.scrollIntoView({ block: 'end', behavior: 'smooth' })
      } else {
        list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' })
      }
      onScrollToNodeDone?.()
    }, 80)
    return () => window.clearTimeout(timer)
  }, [scrollToNodeId, nodes, openChapterIds, onScrollToNodeDone])

  useEffect(() => {
    if (pendingRenameId !== 'notebook') return
    const input = notebookInputRef.current
    if (!input) return
    input.focus()
    input.select()
    setPendingRenameId('')
  }, [pendingRenameId])

  /** openContextMenu 打开右键菜单。 */
  const openContextMenu = (e: React.MouseEvent, target: ContextTarget) => {
    e.preventDefault()
    e.stopPropagation()
    setCtxMenu({ x: e.clientX, y: e.clientY, target })
  }

  /** toggleBatchMode 进入或退出批量选择。 */
  const toggleBatchMode = () => {
    setOrganizeMode(false)
    setBatchMode((v) => {
      if (v) setCheckedIds(new Set())
      return !v
    })
  }

  /** toggleOrganizeMode 进入或退出 AI 分类多选。 */
  const toggleOrganizeMode = () => {
    setBatchMode(false)
    setOrganizeMode((v) => {
      if (v) setCheckedIds(new Set())
      return !v
    })
  }

  /** confirmOrganize 对选中页执行 AI 分章。 */
  const confirmOrganize = useCallback(async () => {
    const pageIds = pageIdsFromChecked(nodes, checkedIds)
    if (pageIds.length < 2) {
      onOrganizeError?.('至少选择 2 页笔记')
      return
    }
    setOrganizing(true)
    try {
      await Service.OrganizeCatalogPages(pageIds)
      setCheckedIds(new Set())
      setOrganizeMode(false)
      onOrganizeApplied?.()
    } catch (e: unknown) {
      onOrganizeError?.(formatBindingError(e))
    } finally {
      setOrganizing(false)
    }
  }, [checkedIds, nodes, onOrganizeApplied, onOrganizeError])

  /** toggleNodeCheck 勾选/取消节点（章节含子树）。 */
  const toggleNodeCheck = (node: CatalogNodeDO, on: boolean) => {
    const ids = isChapter(node) ? collectDescendantIds(nodes, node.id) : [node.id]
    setCheckedIds((prev) => {
      const next = new Set(prev)
      for (const id of ids) {
        if (on) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }

  const checkedCount = checkedIds.size
  const selectedPageCount = pageIdsFromChecked(nodes, checkedIds).length
  const canStartOrganize = allPageIds(nodes).length >= 2
  const resizeSide = resizeEdge ?? catalogSide

  const ctxItems = (() => {
    if (!ctxMenu) return []
    if (ctxMenu.target.kind === 'notebook') {
      return [{ label: '重命名笔记本', onClick: () => setPendingRenameId('notebook') }]
    }
    const n = ctxMenu.target.node
    return [
      {
        label: isChapter(n) ? '重命名章节' : '重命名笔记',
        onClick: () => setPendingRenameId(n.id),
      },
    ]
  })()

  return (
    <div className="catalog-panel-wrap">
      <div className="catalog-panel" style={panelStyle}>
        <ConfirmDialog
          open={confirm !== null}
          title={confirmCopy.title}
          message={confirmCopy.message}
          onConfirm={() => {
            if (!confirm) return
            if (confirm.kind === 'single') onDelete(confirm.node)
            else onBatchDelete(confirm.ids)
            setConfirm(null)
            if (confirm.kind === 'batch') {
              setCheckedIds(new Set())
              setBatchMode(false)
            }
          }}
          onCancel={() => setConfirm(null)}
        />
        {ctxMenu && (
          <CatalogContextMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxItems} onClose={() => setCtxMenu(null)} />
        )}
        <div
          className="catalog-notebook-name"
          onContextMenu={(e) => openContextMenu(e, { kind: 'notebook' })}
        >
          <input
            ref={notebookInputRef}
            value={notebookName}
            onChange={(e) => onNotebookNameChange(e.target.value)}
            placeholder="笔记本名称"
            title={notebookName}
          />
        </div>
        <div className="catalog-head">
          <span className="catalog-head-title">
            {organizeMode ? `AI 分类 · ${selectedPageCount} 页` : batchMode ? `已选 ${checkedCount}` : '目录'}
          </span>
          <div className="catalog-head-actions">
            {organizeMode ? (
              <>
                <button type="button" className="catalog-batch-btn" onClick={() => setCheckedIds(new Set(allPageIds(nodes)))} disabled={nodes.length === 0}>
                  全选页
                </button>
                <button type="button" className="catalog-batch-btn" onClick={() => setCheckedIds(new Set())} disabled={selectedPageCount === 0}>
                  清空
                </button>
                <button type="button" className="catalog-batch-btn" onClick={toggleOrganizeMode} disabled={organizing}>
                  取消
                </button>
                <button
                  type="button"
                  className="catalog-batch-btn primary"
                  disabled={selectedPageCount < 2 || organizing}
                  onClick={() => void confirmOrganize()}
                >
                  {organizing ? '分类中…' : '确认分类'}
                </button>
              </>
            ) : batchMode ? (
              <>
                <button type="button" className="catalog-batch-btn" onClick={() => setCheckedIds(new Set(allNodeIds(nodes)))} disabled={nodes.length === 0}>
                  全选
                </button>
                <button type="button" className="catalog-batch-btn" onClick={() => setCheckedIds(new Set())} disabled={checkedCount === 0}>
                  清空
                </button>
                <button
                  type="button"
                  className="catalog-batch-btn danger"
                  disabled={checkedCount === 0}
                  onClick={() => setConfirm({ kind: 'batch', ids: [...checkedIds] })}
                >
                  删除
                </button>
                <button type="button" className="catalog-batch-btn" onClick={toggleBatchMode}>
                  完成
                </button>
              </>
            ) : (
              <>
                {onFontSizeChange != null && fontSize != null && (
                  <label className="catalog-font-size" title="目录字号">
                    <span className="catalog-font-size-label">Aa</span>
                    <input
                      type="range"
                      min={catalogFontSizeMin}
                      max={catalogFontSizeMax}
                      value={fontSize}
                      onChange={(e) => onFontSizeChange(Number(e.target.value))}
                    />
                    <em>{fontSize}</em>
                  </label>
                )}
                <button type="button" className="catalog-batch-btn" onClick={toggleBatchMode} disabled={nodes.length === 0}>
                  批量
                </button>
                <button
                  type="button"
                  className="catalog-batch-btn"
                  onClick={toggleOrganizeMode}
                  disabled={!canStartOrganize}
                  title="多选笔记后 AI 自动分章"
                >
                  AI 分类
                </button>
                {!hideSideToggle && (
                  <button
                    type="button"
                    className="catalog-side-btn"
                    onClick={onToggleCatalogSide}
                    title={catalogSide === 'left' ? '目录移到右侧' : '目录移到左侧'}
                  >
                    {catalogSide === 'left' ? '居右' : '居左'}
                  </button>
                )}
                <button type="button" className="catalog-new-btn" onClick={() => onCreateChapter(selectedChapterId)} title="新建章节">
                  + 章
                </button>
              </>
            )}
          </div>
        </div>
        <div ref={listRef} className="catalog-list" onDragLeave={() => setDropHint(null)}>
          {tree.length === 0 && <p className="catalog-empty">点「+ 章」创建章节</p>}
          {tree.map((node) => (
            <CatalogTreeNodeRow
              key={node.id}
              node={node}
              depth={0}
              pageIndex={0}
              batchMode={checkMode}
              checkedIds={checkedIds}
              dragId={dragId}
              dropHint={dropHint}
              pendingRenameId={pendingRenameId}
              onConsumePendingRename={() => setPendingRenameId('')}
              onToggleCheck={toggleNodeCheck}
              selectedChapterId={selectedChapterId}
              selectedPageId={selectedPageId}
              onSelectChapter={onSelectChapter}
              onSelectPage={onSelectPage}
              onRename={onRename}
              onRequestDelete={(n) => setConfirm({ kind: 'single', node: n })}
              onContextMenu={(e, n) => openContextMenu(e, { kind: 'node', node: n })}
              onDragStart={setDragId}
              onDragEnd={() => {
                setDragId('')
                setDropHint(null)
              }}
              onRowDragOver={(e, target) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                const fromId = dragId || readCatalogDragPayload(e.dataTransfer)
                const drag = nodesRef.current.find((n) => n.id === fromId)
                if (!drag || drag.id === target.id) {
                  setDropHint(null)
                  return
                }
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                const place = resolveDropPlace(drag, target, e.clientY - rect.top, rect.height)
                setDropHint({ targetId: target.id, place })
              }}
              onRowDrop={(e, target) => {
                e.preventDefault()
                const fromId = dragId || readCatalogDragPayload(e.dataTransfer)
                setDragId('')
                setDropHint(null)
                const drag = nodesRef.current.find((n) => n.id === fromId)
                if (!drag) return
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                const place = resolveDropPlace(drag, target, e.clientY - rect.top, rect.height)
                const move = computeCatalogMove(nodesRef.current, fromId, target.id, place)
                if (move) onMove(fromId, move.parentId, move.index)
              }}
              openChapterIds={openChapterIds}
            />
          ))}
        </div>
      </div>
      {onResizeStart && (
        <div
          className={`catalog-panel-resize catalog-panel-resize-${resizeSide}`}
          title="拖动调整目录宽度"
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            const split = (e.currentTarget.closest('.note-split') as HTMLElement | null)?.clientWidth
            onResizeStart(e.clientX, split || window.innerWidth)
          }}
        />
      )}
    </div>
  )
}
