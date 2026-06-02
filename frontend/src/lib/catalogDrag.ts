import type { CatalogNodeDO } from '../../bindings/wread/internal/model'
import { isChapter } from './catalogTree'

export type CatalogDropPlace = 'before' | 'after' | 'into'

export type CatalogDropHint = {
  targetId: string
  place: CatalogDropPlace
}

const DRAG_MIME = 'application/x-wread-catalog-node'

/** catalogDragPayload 序列化拖动节点 ID。 */
export function catalogDragPayload(nodeId: string): string {
  return nodeId
}

/** readCatalogDragPayload 解析拖动数据。 */
export function readCatalogDragPayload(dt: DataTransfer): string {
  return dt.getData(DRAG_MIME) || dt.getData('text/plain')
}

/** setCatalogDragData 写入拖动数据。 */
export function setCatalogDragData(dt: DataTransfer, nodeId: string) {
  dt.setData(DRAG_MIME, nodeId)
  dt.setData('text/plain', nodeId)
  dt.effectAllowed = 'move'
}

/** sortedSiblingIds 同级节点 ID（不含 exclude）。 */
export function sortedSiblingIds(nodes: CatalogNodeDO[], parentId: string, excludeId = ''): string[] {
  return nodes
    .filter((n) => n.parentId === parentId && n.id !== excludeId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
    .map((n) => n.id)
}

/** isCatalogDescendant 判断 nodeId 是否为 ancestorId 的子孙。 */
export function isCatalogDescendant(nodes: CatalogNodeDO[], ancestorId: string, nodeId: string): boolean {
  if (!ancestorId || !nodeId) return false
  const byId = new Map(nodes.map((n) => [n.id, n]))
  let cur = byId.get(nodeId)
  while (cur) {
    if (cur.parentId === ancestorId) return true
    if (!cur.parentId) return false
    cur = byId.get(cur.parentId)
  }
  return false
}

/** resolveDropPlace 根据指针位置判断落点。 */
export function resolveDropPlace(
  drag: CatalogNodeDO,
  target: CatalogNodeDO,
  offsetY: number,
  rowHeight: number,
): CatalogDropPlace {
  const ratio = rowHeight > 0 ? offsetY / rowHeight : 0.5
  if (!isChapter(drag) && isChapter(target)) {
    if (ratio < 0.28) return 'before'
    if (ratio > 0.72) return 'after'
    return 'into'
  }
  return ratio < 0.5 ? 'before' : 'after'
}

/** computeCatalogMove 计算移动后的父级与序号。 */
export function computeCatalogMove(
  nodes: CatalogNodeDO[],
  dragId: string,
  targetId: string,
  place: CatalogDropPlace,
): { parentId: string; index: number } | null {
  const drag = nodes.find((n) => n.id === dragId)
  const target = nodes.find((n) => n.id === targetId)
  if (!drag || !target || drag.id === target.id) return null

  if (isChapter(drag) && (target.id === drag.id || isCatalogDescendant(nodes, drag.id, target.id))) {
    return null
  }

  if (place === 'into' && isChapter(target)) {
    if (isChapter(drag) && isCatalogDescendant(nodes, drag.id, target.id)) return null
    const siblings = sortedSiblingIds(nodes, target.id, dragId)
    return { parentId: target.id, index: siblings.length }
  }

  const parentId = target.parentId
  if (!isChapter(drag) && parentId === '') return null

  const siblings = sortedSiblingIds(nodes, parentId, dragId)
  let index = siblings.indexOf(targetId)
  if (index < 0) return null
  if (place === 'after') index += 1

  const oldSiblings = sortedSiblingIds(nodes, parentId)
  const oldIndex = oldSiblings.indexOf(dragId)
  if (drag.parentId === parentId && oldIndex >= 0 && oldIndex < index) {
    index -= 1
  }
  if (index < 0) index = 0
  if (index > siblings.length) index = siblings.length
  return { parentId, index }
}
