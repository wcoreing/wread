import type { SystemThemeId } from './systemThemes'

/** LayoutTheme 解读区排版预设 ID。 */
export type LayoutTheme = 'magazine' | 'minimal' | 'academic' | 'terminal' | 'card' | 'brief'

/** mastheadMode 页眉展示模式。 */
export function mastheadMode(theme: LayoutTheme): 'full' | 'compact' | 'none' {
  if (theme === 'magazine' || theme === 'academic' || theme === 'card') return 'full'
  if (theme === 'minimal' || theme === 'brief') return 'compact'
  return 'none'
}

/** useSectionCards 是否按 ## 拆成卡片区块渲染。 */
export function useSectionCards(theme: LayoutTheme): boolean {
  return theme === 'card'
}

const SYSTEM_LAYOUT_MAP: Record<SystemThemeId, LayoutTheme> = {
  rice: 'academic',
  snow: 'minimal',
  gray: 'brief',
  black: 'terminal',
}

/** layoutThemeFromSystemTheme 根据系统主题推导解读排版风格。 */
export function layoutThemeFromSystemTheme(id: SystemThemeId): LayoutTheme {
  return SYSTEM_LAYOUT_MAP[id] ?? 'academic'
}
