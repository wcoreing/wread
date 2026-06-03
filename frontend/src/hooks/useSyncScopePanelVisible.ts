import { useEffect } from 'react'
import { Service } from '../../bindings/wread/internal/app'

/** useSyncScopePanelVisible 将阅读区显隐同步至原生穿透几何。 */
export function useSyncScopePanelVisible(enabled: boolean, visible: boolean) {
  useEffect(() => {
    if (!enabled) return
    void Service.SetScopePanelVisible(visible).catch(console.error)
  }, [enabled, visible])
}
