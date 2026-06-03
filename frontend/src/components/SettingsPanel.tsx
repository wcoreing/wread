import { useState } from 'react'
import AiSettings from './AiSettings'
import LayoutManager from './LayoutManager'
import TemplateManager from './TemplateManager'
import ThemeManager from './ThemeManager'
import type { NotePlaceId } from './NotePlaceBar'
import type { useInterpretSettings } from '../hooks/useInterpretSettings'
import type { WindowLayoutPresetsApi } from '../hooks/useWindowLayoutPresets'

type Settings = ReturnType<typeof useInterpretSettings>

export type SettingsTab = 'ai' | 'templates' | 'appearance' | 'layout'

type Props = {
  settings: Settings
  layoutPresets: WindowLayoutPresetsApi
  layoutPlace: NotePlaceId
  onPickPlace: (place: NotePlaceId) => void
  catalogAutoAdd?: boolean
  onCatalogAutoAddChange?: (auto: boolean) => void
  showWakeReader?: boolean
  className?: string
}

/** SettingsPanel 配置页：AI、模板、外观、布局 Tab。 */
export default function SettingsPanel({
  settings,
  layoutPresets,
  layoutPlace,
  onPickPlace,
  catalogAutoAdd,
  onCatalogAutoAddChange,
  showWakeReader,
  className = 'sidebar-body',
}: Props) {
  const [tab, setTab] = useState<SettingsTab>('ai')

  return (
    <div className={`${className} settings-panel`}>
      <div className="tabs settings-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'ai'}
          className={tab === 'ai' ? 'active' : ''}
          onClick={() => setTab('ai')}
        >
          AI
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'templates'}
          className={tab === 'templates' ? 'active' : ''}
          onClick={() => setTab('templates')}
        >
          模板
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'appearance'}
          className={tab === 'appearance' ? 'active' : ''}
          onClick={() => setTab('appearance')}
        >
          外观
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'layout'}
          className={tab === 'layout' ? 'active' : ''}
          onClick={() => setTab('layout')}
        >
          布局
        </button>
      </div>
      <div className="settings-tab-body">
        {tab === 'ai' && (
          <AiSettings
            settings={settings}
            catalogAutoAdd={catalogAutoAdd}
            onCatalogAutoAddChange={onCatalogAutoAddChange}
            embedded
          />
        )}
        {tab === 'templates' && <TemplateManager settings={settings} embedded />}
        {tab === 'appearance' && <ThemeManager embedded />}
        {tab === 'layout' && (
          <LayoutManager
            presets={layoutPresets}
            layoutPlace={layoutPlace}
            onPickPlace={onPickPlace}
            showWakeReader={showWakeReader}
            embedded
          />
        )}
      </div>
    </div>
  )
}
