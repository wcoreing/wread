import ViewMenu from './ViewMenu'
import type { PanelId, PanelVisibility } from '../lib/panelVisibility'
import type { WindowLayoutPresetsApi } from '../hooks/useWindowLayoutPresets'

/** PanelRestoreRail 管理区关闭后贴左缘的视图菜单。 */
export default function PanelRestoreRail({
  panels,
  onSetPanel,
  layoutPresets,
  hidePanels = [],
  hasScope = true,
}: {
  panels: PanelVisibility
  onSetPanel: (id: PanelId, on: boolean) => void
  layoutPresets?: WindowLayoutPresetsApi
  hidePanels?: PanelId[]
  hasScope?: boolean
}) {
  return (
    <aside className="panel-restore-rail" aria-label="面板恢复">
      <ViewMenu
        panels={panels}
        onSetPanel={onSetPanel}
        layoutPresets={layoutPresets}
        hidePanels={hidePanels}
        hasScope={hasScope}
        compact
      />
    </aside>
  )
}
