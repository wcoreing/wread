import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { WindowLayoutPresetsApi } from '../hooks/useWindowLayoutPresets'
import { layoutPresetSummary } from '../lib/layoutPresetSummary'

type Props = {
  presets: WindowLayoutPresetsApi
  className?: string
}

const STORAGE_KEY = 'wread.layoutSideW'
const DEFAULT_SIDE_W = 128
const MIN_SIDE_W = 96
const MAX_SIDE_W = 280

/** readSideWidth 读取布局列表宽度。 */
function readSideWidth() {
  const saved = Number(localStorage.getItem(STORAGE_KEY))
  if (!Number.isFinite(saved)) return DEFAULT_SIDE_W
  return Math.max(MIN_SIDE_W, Math.min(MAX_SIDE_W, Math.round(saved)))
}

/** LayoutManager 窗口布局预设列表与应用（左右布局，可拖动分栏）。 */
export default function LayoutManager({ presets: p, className = 'interpret-settings' }: Props) {
  const [sideW, setSideW] = useState(readSideWidth)
  const sideWRef = useRef(sideW)

  useEffect(() => {
    sideWRef.current = sideW
  }, [sideW])

  /** startSplitDrag 拖动调整布局列表宽度。 */
  const startSplitDrag = (startX: number) => {
    const startW = sideWRef.current
    const onMove = (ev: MouseEvent) => {
      const next = Math.max(MIN_SIDE_W, Math.min(MAX_SIDE_W, Math.round(startW + ev.clientX - startX)))
      setSideW(next)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      localStorage.setItem(STORAGE_KEY, String(sideWRef.current))
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const editing = p.editingPreset

  return (
    <div
      className={`${className} template-manager layout-manager`}
      style={{ '--template-side-w': `${sideW}px` } as CSSProperties}
    >
      <div className="interpret-settings-head template-head-drag">
        <span>布局管理</span>
        <button type="button" className="template-reset-btn" onClick={() => p.restoreDefaultLayout().catch(console.error)}>
          恢复默认
        </button>
      </div>
      {p.status && <div className="interpret-settings-status">{p.status}</div>}

      <div className="template-split">
        <aside className="template-side">
          <div className="template-list">
            {p.presets.presets.map((item) => {
              const active = item.id === p.presets.activeId
              const selected = item.id === p.editId
              return (
                <div key={item.id} className={`template-list-row ${selected ? 'editing' : ''}`}>
                  <button
                    type="button"
                    className={`template-list-item ${active ? 'active-preset' : ''}`}
                    onClick={() => p.selectPresetForEdit(item.id).catch(console.error)}
                  >
                    <span className="template-list-name">{item.name}</span>
                    {active && <span className="layout-preset-active-tag">当前</span>}
                  </button>
                  <button
                    type="button"
                    className="layout-preset-apply-btn"
                    title="应用此布局"
                    onClick={() => p.applyPreset(item.id).catch(console.error)}
                  >
                    应用
                  </button>
                </div>
              )
            })}
          </div>
          <button type="button" className="note-action-btn layout-create-btn" onClick={() => p.createPreset().catch(console.error)}>
            保存当前窗口
          </button>
        </aside>

        <div
          className="template-splitter"
          role="separator"
          aria-orientation="vertical"
          onMouseDown={(e) => {
            e.preventDefault()
            startSplitDrag(e.clientX)
          }}
        />

        <div className="template-editor layout-preset-editor">
          {editing ? (
            <>
              <label>名称</label>
              <input
                value={p.editName}
                onChange={(e) => p.updatePresetName(e.target.value)}
                onBlur={() => p.savePresetName().catch(console.error)}
                placeholder="预设名称"
              />
              <div className="interpret-settings-section">窗口信息</div>
              <div className="layout-preset-summary">{layoutPresetSummary(editing.layout)}</div>
              <div className="interpret-settings-actions">
                <button type="button" className="note-action-btn primary" onClick={() => p.applyActivePreset().catch(console.error)}>
                  应用
                </button>
                <button type="button" className="note-action-btn" onClick={() => p.refreshPresetFromCurrent().catch(console.error)}>
                  更新为当前窗口
                </button>
                {p.canDelete(editing.id) && (
                  <button
                    type="button"
                    className="template-op-btn danger"
                    onClick={() => p.deletePreset(editing.id).catch(console.error)}
                  >
                    删除
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="layout-preset-empty">请选择或新建布局预设</div>
          )}
        </div>
      </div>
    </div>
  )
}
