import { useCallback, useEffect, useState } from 'react'
import { Events } from '@wailsio/runtime'
import { Service } from '../../bindings/wread/internal/app'
import { normalizeScopeMode, type ScopeMode } from '../lib/scopeMode'

/** useScopeMode 阅读器三态模式（操作 / 阅读 / 笔记）。 */
export function useScopeMode() {
  const [scopeMode, setScopeMode] = useState<ScopeMode>('op')

  useEffect(() => {
    Service.GetScopeMode()
      .then((mode) => setScopeMode(normalizeScopeMode(mode)))
      .catch(console.error)
    Events.On('overlay:scopeMode', (ev: { data: string }) => {
      setScopeMode(normalizeScopeMode(ev.data))
    })
  }, [])

  /** pickScopeMode 切换阅读器模式并同步穿透。 */
  const pickScopeMode = useCallback(async (mode: ScopeMode) => {
    await Service.SetScopeMode(mode)
    setScopeMode(mode)
  }, [])

  return {
    scopeMode,
    pickScopeMode,
    notesInScope: scopeMode === 'note',
    frameAdjustable: scopeMode !== 'op',
  }
}
