import { readCatalogPanelWidth } from './catalogLayout'

/** 开卷区最小尺寸（与 backend minScopeWidth 一致）。 */
export const minScopeSize = 240

/** 笔记栏最小宽度（与 backend minSidebarWidth 一致）。 */
export const minSidebarWidth = 420

/** 上下布局时笔记区最小高度（与 backend minNoteHeight 一致）。 */
export const minNoteHeight = 200

export type FrameMinSize = { minW: number; minH: number }

const undockedMinW = 560
const undockedMinH = 180
const toolbarH = 36

/** workspaceFrameMinSize 内嵌模式下边框缩放的最小窗口尺寸（与 backend 布局下限一致）。 */
export function workspaceFrameMinSize(
  docked: boolean,
  place: string,
  sidebarW: number,
  managerW = 0,
): FrameMinSize {
  if (!docked) {
    return { minW: undockedMinW, minH: undockedMinH }
  }
  if (place === 'top' || place === 'bottom') {
    const noteH = Math.max(minNoteHeight, sidebarW)
    return { minW: minScopeSize, minH: minScopeSize + noteH + toolbarH }
  }
  if (place === 'center') {
    return { minW: minScopeSize + minSidebarWidth + managerW, minH: undockedMinH }
  }
  return { minW: minScopeSize + sidebarW + managerW + 1, minH: undockedMinH }
}

/** catalogColumnWidth 内嵌 place-right 时目录栏占用宽度（收起为 0）。 */
export function catalogColumnWidth(collapsed: boolean): number {
  return collapsed ? 0 : readCatalogPanelWidth()
}

/** sidebarDragLimits 返回分割条拖动时的笔记区尺寸上下限。 */
export function sidebarDragLimits(vertical: boolean, catalogW = 0) {
  if (vertical) {
    const max = Math.max(minNoteHeight, window.innerHeight - minScopeSize - 1)
    return { min: minNoteHeight, max }
  }
  const max = Math.max(minSidebarWidth, window.innerWidth - minScopeSize - catalogW - 1)
  return { min: minSidebarWidth, max }
}
