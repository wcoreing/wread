import type { CatalogNodeDO } from '../../bindings/wread/internal/model'

export type CatalogTreeNode = CatalogNodeDO & { children: CatalogTreeNode[] }

export const kindChapter = 'chapter'
export const kindPage = 'page'

/** isChapter 是否为章节节点。 */
export function isChapter(node: CatalogNodeDO): boolean {
  return node.kind === kindChapter
}

/** buildCatalogTree 将平铺章节树转为层级结构。 */
export function buildCatalogTree(nodes: CatalogNodeDO[]): CatalogTreeNode[] {
  const map = new Map<string, CatalogTreeNode>()
  const roots: CatalogTreeNode[] = []
  for (const node of nodes) {
    map.set(node.id, { ...node, children: [] })
  }
  for (const node of nodes) {
    const item = map.get(node.id)!
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(item)
    } else {
      roots.push(item)
    }
  }
  const sortKids = (list: CatalogTreeNode[]) => {
    list.sort((a, b) => a.sortOrder - b.sortOrder || 0)
    for (const n of list) sortKids(n.children)
  }
  sortKids(roots)
  return roots
}

/** findCatalogNode 按 ID 查找节点。 */
export function findCatalogNode(nodes: CatalogNodeDO[], id: string): CatalogNodeDO | undefined {
  return nodes.find((n) => n.id === id)
}

/** snapInCatalog 判断解读页是否已归入某章节。 */
export function snapInCatalog(nodes: CatalogNodeDO[], snapId: string): boolean {
  return nodes.some((n) => n.kind === kindPage && n.snapId === snapId)
}

/** resolveChapterId 将节点 ID 解析为章节 ID。 */
export function resolveChapterId(nodes: CatalogNodeDO[], nodeId: string): string {
  if (!nodeId) return ''
  const byId = new Map(nodes.map((n) => [n.id, n]))
  let cur = byId.get(nodeId)
  while (cur) {
    if (cur.kind === kindChapter) return cur.id
    if (!cur.parentId) return ''
    cur = byId.get(cur.parentId)
  }
  return ''
}

/** findChapterTitle 查找章节标题。 */
export function findChapterTitle(nodes: CatalogNodeDO[], chapterId: string): string {
  return findCatalogNode(nodes, chapterId)?.title || ''
}

/** formatPageLabel 格式化为书籍目录页条目。 */
export function formatPageLabel(pageIndex: number, title: string): string {
  return `第${pageIndex}页  ${title || '未命名'}`
}
