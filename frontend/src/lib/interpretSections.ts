import { sectionThemeFromTitle, type MagazineSectionTheme } from './interpretMagazine'

export type InterpretSection = {
  title: string
  body: string
  sectionTheme: MagazineSectionTheme
}

/** parseInterpretSections 按 ## 标题拆分为多段（无则返回 null）。 */
export function parseInterpretSections(content: string): InterpretSection[] | null {
  if (!/^##\s+/m.test(content)) return null
  const chunks = content.split(/^##\s+/m)
  const sections: InterpretSection[] = []
  for (let i = 1; i < chunks.length; i++) {
    const chunk = chunks[i]
    const nl = chunk.indexOf('\n')
    const title = (nl >= 0 ? chunk.slice(0, nl) : chunk).trim()
    const body = stripEchoedSectionHeading(
      nl >= 0 ? chunk.slice(nl + 1) : '',
      title,
    )
    if (!title) continue
    sections.push({
      title,
      body,
      sectionTheme: sectionThemeFromTitle(title),
    })
  }
  return sections.length > 0 ? sections : null
}

/** stripEchoedSectionHeading 去掉正文中与节标题重复的 ## / 纯文本标题行。 */
export function stripEchoedSectionHeading(body: string, title: string): string {
  const esc = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return body
    .replace(new RegExp(`^##\\s+${esc}\\s*\\n+`, 'gm'), '')
    .replace(new RegExp(`^#{1,3}\\s+${esc}\\s*\\n+`, 'gm'), '')
    .replace(new RegExp(`^${esc}\\s*\\n+`, 'gm'), '')
    .trim()
}
