/** LayoutTheme 解读区排版预设 ID。 */
export type LayoutTheme = 'magazine' | 'minimal' | 'academic' | 'terminal' | 'card' | 'brief'

export type InterpretThemeOption = {
  id: LayoutTheme
  label: string
  desc: string
}

/** INTERPRET_THEME_OPTIONS 解读区排版预设列表。 */
export const INTERPRET_THEME_OPTIONS: InterpretThemeOption[] = [
  { id: 'magazine', label: '杂志', desc: '页眉、引语、分栏配色' },
  { id: 'minimal', label: '简约', desc: '留白、细线、低干扰' },
  { id: 'academic', label: '学术', desc: 'Formal 章节、蓝灰配色' },
  { id: 'card', label: '卡片', desc: '每节独立卡片容器' },
  { id: 'brief', label: '简报', desc: '紧凑信息密度' },
  { id: 'terminal', label: '终端', desc: '等宽荧光绿' },
]

/** normalizeLayoutTheme 校验并返回有效预设。 */
export function normalizeLayoutTheme(v?: string): LayoutTheme {
  if (INTERPRET_THEME_OPTIONS.some((t) => t.id === v)) return v as LayoutTheme
  return 'magazine'
}

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
