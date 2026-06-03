import { useState } from 'react'
import { Service } from '../../bindings/wread/internal/app'
import type { WindowLayoutPresetsApi } from '../hooks/useWindowLayoutPresets'
import { layoutPresetSummary } from '../lib/layoutPresetSummary'
import NotePlaceBar, { type NotePlaceId } from './NotePlaceBar'
import LayoutPresetDiagram from './LayoutPresetDiagram'
import SnapCaptureSettings from './SnapCaptureSettings'

type Props = {
  presets: WindowLayoutPresetsApi
  layoutPlace?: NotePlaceId
  onPickPlace?: (place: NotePlaceId) => void
  showWakeReader?: boolean
  className?: string
  /** embedded 嵌入配置 Tab，隐藏页头。 */
  embedded?: boolean
}

/** LayoutManager 窗口布局预设：列表 → 全宽详情（方案 A）。 */
export default function LayoutManager({
  presets: p,
  layoutPlace,
  onPickPlace,
  showWakeReader,
  className = 'interpret-settings',
  embedded = false,
}: Props) {
  const [detailId, setDetailId] = useState<string | null>(null)

  /** openPreset 选中预设并进入详情。 */
  const openPreset = async (id: string) => {
    await p.selectPresetForEdit(id)
    setDetailId(id)
  }

  /** backToList 返回预设列表。 */
  const backToList = () => setDetailId(null)

  /** createAndOpen 保存当前窗口并打开详情。 */
  const createAndOpen = async () => {
    const id = await p.createPreset()
    if (id) setDetailId(id)
  }

  const editing = detailId ? p.presets.presets.find((item) => item.id === detailId) : undefined
  const inDetail = detailId !== null && editing !== undefined

  return (
    <div className={`${className} template-manager layout-manager settings-stack${embedded ? ' settings-tab-pane' : ''}`}>
      {!inDetail ? (
        <>
          {embedded ? (
            <div className="settings-tab-toolbar settings-tab-toolbar-split">
              <button type="button" className="note-action-btn" onClick={() => createAndOpen().catch(console.error)}>
                保存当前窗口
              </button>
              <button type="button" className="template-reset-btn" onClick={() => p.restoreDefaultLayout().catch(console.error)}>
                恢复默认
              </button>
            </div>
          ) : (
            <div className="interpret-settings-head template-head-drag">
              <span>布局管理</span>
              <button type="button" className="template-reset-btn" onClick={() => p.restoreDefaultLayout().catch(console.error)}>
                恢复默认
              </button>
            </div>
          )}
          {p.status && <div className="interpret-settings-status">{p.status}</div>}

          <div className="settings-layout-scroll">
            {(layoutPlace && onPickPlace) && (
              <div className="settings-form settings-reading-form">
                <div className="settings-form-row">
                  <label className="settings-form-label">笔记位置</label>
                  <NotePlaceBar
                    active={layoutPlace}
                    onPick={onPickPlace}
                    className="settings-layout-select settings-form-control"
                  />
                </div>
              </div>
            )}

            <SnapCaptureSettings />

            {showWakeReader && (
              <button
                type="button"
                className="sidebar-wake-btn settings-wake-reader"
                onClick={() => Service.FocusOverlay().catch(console.error)}
              >
                唤起阅读器
              </button>
            )}

            <div className="interpret-settings-section settings-layout-presets-title">布局预设</div>
            <div className="layout-preset-list">
            {p.presets.presets.map((item) => {
              const active = item.id === p.presets.activeId
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`settings-stack-row layout-preset-card${active ? ' active-preset' : ''}`}
                  onClick={() => openPreset(item.id).catch(console.error)}
                >
                  <LayoutPresetDiagram layout={item.layout} className="layout-preset-card-diagram" />
                  <span className="settings-stack-row-main">
                    <span className="settings-stack-row-title">{item.name}</span>
                    <span className="settings-stack-row-desc">{layoutPresetSummary(item.layout)}</span>
                  </span>
                  <span className="settings-stack-row-meta">
                    {active && <span className="template-list-badge">当前</span>}
                    <span className="settings-stack-chevron" aria-hidden>›</span>
                  </span>
                </button>
              )
            })}
            {p.presets.presets.length === 0 && (
              <div className="layout-preset-empty">暂无布局预设，可保存当前窗口</div>
            )}
          </div>
          </div>
        </>
      ) : (
        <div className="settings-stack-detail">
          <div className="settings-stack-detail-head">
            <button type="button" className="settings-stack-back" onClick={backToList}>
              ← 返回
            </button>
            <div className="settings-stack-detail-actions">
              <button type="button" className="note-action-btn primary" onClick={() => p.applyPreset(editing!.id).catch(console.error)}>
                应用
              </button>
              {p.canDelete(editing!.id) && (
                <button
                  type="button"
                  className="template-op-btn danger"
                  onClick={() => {
                    p.deletePreset(editing!.id)
                      .then(() => setDetailId(null))
                      .catch(console.error)
                  }}
                >
                  删除
                </button>
              )}
            </div>
          </div>
          {p.status && <div className="interpret-settings-status">{p.status}</div>}
          {editing!.id === p.presets.activeId && (
            <div className="settings-stack-active-hint">当前正在使用此布局</div>
          )}

          <LayoutPresetDiagram layout={editing!.layout} className="layout-preset-detail-diagram" />

          <div className="settings-form">
            <div className="settings-form-row">
              <label className="settings-form-label">名称</label>
              <input
                className="settings-form-control"
                value={p.editName}
                onChange={(e) => p.updatePresetName(e.target.value)}
                onBlur={() => p.savePresetName().catch(console.error)}
                placeholder="预设名称"
              />
            </div>
          </div>

          <div className="interpret-settings-section">窗口信息</div>
          <div className="layout-preset-summary">{layoutPresetSummary(editing!.layout)}</div>

          <div className="interpret-settings-actions">
            <button type="button" className="note-action-btn" onClick={() => p.refreshPresetFromCurrent().catch(console.error)}>
              更新为当前窗口
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
