import type { CSSProperties } from 'react'
import type { ReaderSettingsDO } from '../../bindings/wread/internal/model'

export const FONT_FAMILY_OPTIONS = [
  { value: 'system', label: '系统默认' },
  { value: 'sans', label: '黑体 / 苹方' },
  { value: 'serif', label: '宋体' },
  { value: 'kai', label: '楷体' },
  { value: 'mono', label: '等宽' },
] as const

export const FONT_FAMILY_CSS: Record<string, string> = {
  system: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,
  serif: `'Songti SC', 'Noto Serif SC', STSong, serif`,
  kai: `'Kaiti SC', 'STKaiti', KaiTi, serif`,
  sans: `'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif`,
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
}

/** readerStyleVars 生成解读区 CSS 变量。 */
export function readerStyleVars(st: ReaderSettingsDO): CSSProperties {
  return {
    ['--interpret-font-size' as string]: `${st.fontSize}px`,
    ['--interpret-line-height' as string]: String(st.lineHeight),
    ['--interpret-font-family' as string]: FONT_FAMILY_CSS[st.fontFamily] || FONT_FAMILY_CSS.system,
    ['--interpret-paragraph-gap' as string]: `${st.paragraphGap || 12}px`,
  }
}
