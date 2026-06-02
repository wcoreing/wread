import type { WindowLayoutSnapshotDO } from '../../bindings/wread/internal/model'

const placeLabel: Record<string, string> = {
  right: '笔记在右',
  left: '笔记在左',
  top: '笔记在上',
  bottom: '笔记在下',
  center: '笔记居中',
  popout: '笔记独立窗',
}

/** layoutPresetWindowWidth 计算工作区窗口宽度。 */
function layoutPresetWindowWidth(layout: WindowLayoutSnapshotDO): number {
  if (layout.docked && layout.notePlace !== 'top' && layout.notePlace !== 'bottom') {
    return layout.scopeW + layout.sidebarW
  }
  return layout.scopeW
}

/** layoutPresetSummary 生成布局预设的可读摘要。 */
export function layoutPresetSummary(layout: WindowLayoutSnapshotDO): string {
  const winW = layoutPresetWindowWidth(layout)
  const place = placeLabel[layout.notePlace] || layout.notePlace
  const size = `${winW}×${layout.h}`
  const pos = `(${layout.x}, ${layout.y})`
  if (!layout.docked) {
    const popH = layout.popoutH || layout.h
    return `${size} @ ${pos} · 阅读 ${layout.scopeW} · 弹出 ${layout.sidebarW}×${popH} · ${place}`
  }
  if (layout.notePlace === 'top' || layout.notePlace === 'bottom') {
    return `${size} @ ${pos} · 阅读区高 ${layout.scopeW} · 笔记 ${layout.sidebarW}px · ${place}`
  }
  return `${size} @ ${pos} · 阅读 ${layout.scopeW} · 笔记 ${layout.sidebarW} · ${place}`
}

export const builtinDefaultLayoutPresetID = 'builtin-default'
