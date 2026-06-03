import type { WindowLayoutSnapshotDO } from '../../bindings/wread/internal/model'

type Props = {
  layout: WindowLayoutSnapshotDO
  className?: string
}

/** LayoutPresetDiagram 布局预设迷你示意图。 */
export default function LayoutPresetDiagram({ layout, className = '' }: Props) {
  const place = layout.docked ? layout.notePlace : 'popout'
  const noteRatio = layout.sidebarW / Math.max(layout.scopeW + layout.sidebarW, 1)
  const noteFlex = Math.max(0.18, Math.min(0.45, noteRatio))

  if (place === 'top' || place === 'bottom') {
    const noteFirst = place === 'top'
    return (
      <div className={`layout-preset-diagram col ${className}`} aria-hidden>
        {noteFirst && <span className="layout-preset-diagram-note" style={{ flex: `${noteFlex} 1 0` }} />}
        <span className="layout-preset-diagram-reader" style={{ flex: `${1 - noteFlex} 1 0` }} />
        {!noteFirst && <span className="layout-preset-diagram-note" style={{ flex: `${noteFlex} 1 0` }} />}
      </div>
    )
  }

  if (place === 'popout') {
    return (
      <div className={`layout-preset-diagram popout ${className}`} aria-hidden>
        <span className="layout-preset-diagram-reader" />
        <span className="layout-preset-diagram-float" />
      </div>
    )
  }

  if (place === 'center') {
    return (
      <div className={`layout-preset-diagram center ${className}`} aria-hidden>
        <span className="layout-preset-diagram-reader" />
        <span className="layout-preset-diagram-overlay" />
      </div>
    )
  }

  const noteFirst = place === 'left'
  return (
    <div className={`layout-preset-diagram row ${className}`} aria-hidden>
      {noteFirst && <span className="layout-preset-diagram-note" style={{ flex: `${noteFlex} 1 0` }} />}
      <span className="layout-preset-diagram-reader" style={{ flex: `${1 - noteFlex} 1 0` }} />
      {!noteFirst && <span className="layout-preset-diagram-note" style={{ flex: `${noteFlex} 1 0` }} />}
    </div>
  )
}
