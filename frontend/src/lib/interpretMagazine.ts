/** 解读区杂志分栏主题 ID。 */
export type MagazineSectionTheme = 'lead' | 'concepts' | 'logic' | 'note' | 'misc'

/** sectionThemeFromTitle 根据 ## 标题匹配杂志分栏配色。 */
export function sectionThemeFromTitle(title: string): MagazineSectionTheme {
  const t = title.replace(/\s+/g, '')
  if (/一句话|概要|摘要|导读/.test(t)) return 'lead'
  if (/关键概念|概念|术语/.test(t)) return 'concepts'
  if (/逻辑|论证|结构|位置|脉络/.test(t)) return 'logic'
  if (/关系图谱|关系图|图谱|关系网络/.test(t)) return 'logic'
  if (/值得注意|注意|提示|误区|警示/.test(t)) return 'note'
  return 'misc'
}

/** flattenMarkdownChildren 提取 React 子节点纯文本。 */
export function flattenMarkdownChildren(children: unknown): string {
  if (children == null) return ''
  if (typeof children === 'string' || typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(flattenMarkdownChildren).join('')
  if (typeof children === 'object' && 'props' in (children as object)) {
    const props = (children as { props?: { children?: unknown } }).props
    return flattenMarkdownChildren(props?.children)
  }
  return ''
}

/** extractLeadFromMarkdown 从正文中提取「一句话」段落作引语。 */
export function extractLeadFromMarkdown(content: string): string {
  const blocks = content.split(/^##\s+/m)
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i]
    const nl = block.indexOf('\n')
    const title = (nl >= 0 ? block.slice(0, nl) : block).trim()
    if (sectionThemeFromTitle(title) !== 'lead') continue
    const body = (nl >= 0 ? block.slice(nl + 1) : '').trim()
    const para = body.split(/\n\n+/).find((p) => p.trim() && !p.trim().startsWith('#'))
    if (para) return para.replace(/\*\*|__|\*|_/g, '').trim()
  }
  const first = content.split(/\n\n+/).find((p) => p.trim() && !p.trim().startsWith('#'))
  return first ? first.replace(/\*\*|__|\*|_/g, '').trim().slice(0, 200) : ''
}
