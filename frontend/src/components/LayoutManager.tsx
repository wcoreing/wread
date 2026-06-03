import { Service } from '../../bindings/wread/internal/app'
import type { WindowLayoutPresetsApi } from '../hooks/useWindowLayoutPresets'
import NotePlaceBar, { type NotePlaceId } from './NotePlaceBar'
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

/** LayoutManager 窗口与阅读相关设置（布局预设已移至管理区）。 */
export default function LayoutManager({
  presets: p,
  layoutPlace,
  onPickPlace,
  showWakeReader,
  className = 'interpret-settings',
  embedded = false,
}: Props) {
  return (
    <div className={`${className} template-manager layout-manager settings-stack${embedded ? ' settings-tab-pane' : ''}`}>
      {embedded ? (
        <div className="settings-tab-toolbar settings-tab-toolbar-split">
          <button type="button" className="template-reset-btn" onClick={() => p.restoreDefaultLayout().catch(console.error)}>
            恢复默认窗口
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

        <p className="settings-field-hint settings-layout-moved-hint">
          窗口布局预设已移至左栏顶部，可直接切换或保存当前窗口。
        </p>
      </div>
    </div>
  )
}
