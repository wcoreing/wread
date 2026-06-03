/** SystemThemeId 系统 UI 主题标识（非阅读排版主题）。 */
export type SystemThemeId = 'rice' | 'snow' | 'gray' | 'black'

export type SystemThemeOption = {
  id: SystemThemeId
  label: string
  desc: string
  /** 主题预览渐变 */
  preview: string
}

/** SYSTEM_THEME_OPTIONS 系统 UI 主题列表。 */
export const SYSTEM_THEME_OPTIONS: SystemThemeOption[] = [
  { id: 'rice', label: '米白', desc: '暖米色调 · 纸感层次', preview: 'linear-gradient(135deg, #faf8f5 0%, #e7e0d4 40%, #d6cbb8 70%, #44403c 100%)' },
  { id: 'snow', label: '雪白', desc: '冷冽纯白 · 冰蓝景深', preview: 'linear-gradient(135deg, #ffffff 0%, #e0f2fe 35%, #bae6fd 65%, #0f172a 100%)' },
  { id: 'gray', label: '灰白', desc: '零饱和 · 灰阶层次 · 克制高级', preview: 'linear-gradient(135deg, #fafafa 0%, #e5e5e5 38%, #a3a3a3 68%, #171717 100%)' },
  { id: 'black', label: '黑色', desc: '纯黑 · 暗金 rim 光 · 聚光灯层次', preview: 'linear-gradient(135deg, #cfc4ae 0%, #525252 35%, #1a1a1a 62%, #000000 100%)' },
]

export const SYSTEM_THEME_STORAGE_KEY = 'wread.systemTheme'

const VALID_IDS = new Set<string>(SYSTEM_THEME_OPTIONS.map((t) => t.id))

/** normalizeSystemTheme 校验并返回有效系统主题。 */
export function normalizeSystemTheme(v?: string | null): SystemThemeId {
  if (v && VALID_IDS.has(v)) return v as SystemThemeId
  return 'rice'
}

/** systemThemeClass 返回挂载到 html 的主题 class。 */
export function systemThemeClass(id: SystemThemeId): string {
  return `system-theme-${id}`
}
