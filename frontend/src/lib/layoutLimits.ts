/** 开卷区最小尺寸（与 backend minScopeWidth 一致）。 */
export const minScopeSize = 240

/** 笔记栏最小宽度（与 backend minSidebarWidth 一致）。 */
export const minSidebarWidth = 420

/** 上下布局时笔记区最小高度（与 backend minNoteHeight 一致）。 */
export const minNoteHeight = 200

/** sidebarDragLimits 返回分割条拖动时的笔记区尺寸上下限。 */
export function sidebarDragLimits(vertical: boolean) {
  if (vertical) {
    const max = Math.max(minNoteHeight, window.innerHeight - minScopeSize - 1)
    return { min: minNoteHeight, max }
  }
  const max = Math.max(minSidebarWidth, window.innerWidth - minScopeSize - 1)
  return { min: minSidebarWidth, max }
}
