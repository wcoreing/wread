/** ScopeMode 阅读器模式：操作 / 穿透阅读 / 笔记对照。 */
export type ScopeMode = 'op' | 'read' | 'note'

const MODES: ScopeMode[] = ['op', 'read', 'note']

/** normalizeScopeMode 规范化后端返回值。 */
export function normalizeScopeMode(raw: string): ScopeMode {
  return MODES.includes(raw as ScopeMode) ? (raw as ScopeMode) : 'op'
}
