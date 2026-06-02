import type { CatalogNodeDO } from '../../bindings/wread/internal/model'
import { isChapter } from './catalogTree'

/** collectDescendantIds 收集节点及其子树全部 ID。 */
export function collectDescendantIds(nodes: CatalogNodeDO[], rootId: string): string[] {
  const ids = [rootId]
  const walk = (parentId: string) => {
    for (const n of nodes) {
      if (n.parentId === parentId) {
        ids.push(n.id)
        walk(n.id)
      }
    }
  }
  walk(rootId)
  return ids
}

/** pruneSelectionRoots 去掉已被父节点选中的子项，避免重复删除。 */
export function pruneSelectionRoots(nodes: CatalogNodeDO[], selected: Iterable<string>): string[] {
  const set = new Set(selected)
  const byId = new Map(nodes.map((n) => [n.id, n]))
  return [...set].filter((id) => {
    let cur = byId.get(id)
    while (cur?.parentId) {
      if (set.has(cur.parentId)) return false
      cur = byId.get(cur.parentId)
    }
    return true
  })
}

/** allNodeIds 平铺列表中全部节点 ID。 */
export function allNodeIds(nodes: CatalogNodeDO[]): string[] {
  return nodes.map((n) => n.id)
}

/** idsCoveredByDeletion 本次删除会波及的节点 ID（含章节子树）。 */
export function idsCoveredByDeletion(nodes: CatalogNodeDO[], rootIds: string[]): Set<string> {
  const out = new Set<string>()
  for (const id of rootIds) {
    const node = nodes.find((n) => n.id === id)
    if (!node) continue
    if (isChapter(node)) {
      for (const x of collectDescendantIds(nodes, id)) out.add(x)
    } else {
      out.add(id)
    }
  }
  return out
}

/** describeCatalogDelete 生成删除确认文案。 */
export function describeCatalogDelete(nodes: CatalogNodeDO[], targetIds: string[]): { title: string; message: string } {
  const roots = pruneSelectionRoots(nodes, targetIds)
  if (roots.length === 0) {
    return { title: '删除笔记', message: '未选择任何项。' }
  }
  if (roots.length === 1) {
    const node = nodes.find((n) => n.id === roots[0])
    if (!node) {
      return { title: '删除笔记', message: '确定删除所选内容？此操作不可恢复。' }
    }
    if (isChapter(node)) {
      const kids = collectDescendantIds(nodes, node.id).length - 1
      const extra = kids > 0 ? `及其下 ${kids} 条笔记` : ''
      return {
        title: '删除章节',
        message: `确定删除章节「${node.title || '未命名'}」${extra}？此操作不可恢复。`,
      }
    }
    return {
      title: '删除笔记',
      message: `确定删除「${node.title || '未命名'}」？此操作不可恢复。`,
    }
  }
  let chapters = 0
  let pages = 0
  for (const id of roots) {
    const node = nodes.find((n) => n.id === id)
    if (!node) continue
    if (isChapter(node)) chapters += 1
    else pages += 1
  }
  const parts: string[] = []
  if (chapters) parts.push(`${chapters} 个章节`)
  if (pages) parts.push(`${pages} 条笔记`)
  return {
    title: '批量删除',
    message: `确定删除选中的 ${parts.join('、')}？此操作不可恢复。`,
  }
}

/** describeNotebookDelete 笔记本删除确认文案。 */
export function describeNotebookDelete(names: string[]): { title: string; message: string } {
  if (names.length === 0) {
    return { title: '删除笔记本', message: '未选择任何笔记本。' }
  }
  if (names.length === 1) {
    return {
      title: '删除笔记本',
      message: `确定删除笔记本「${names[0]}」？其中的目录与笔记将一并删除，且不可恢复。`,
    }
  }
  return {
    title: '批量删除笔记本',
    message: `确定删除 ${names.length} 个笔记本（${names.slice(0, 3).join('、')}${names.length > 3 ? '…' : ''}）？此操作不可恢复。`,
  }
}
