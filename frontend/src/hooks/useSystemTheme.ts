import { useCallback, useEffect, useState } from 'react'
import {
  SYSTEM_THEME_OPTIONS,
  SYSTEM_THEME_STORAGE_KEY,
  normalizeSystemTheme,
  systemThemeClass,
  type SystemThemeId,
} from '../lib/systemThemes'

/** readStoredTheme 从 localStorage 读取系统主题。 */
function readStoredTheme(): SystemThemeId {
  return normalizeSystemTheme(localStorage.getItem(SYSTEM_THEME_STORAGE_KEY))
}

/** applySystemThemeClass 将主题 class 挂到 html 元素。 */
function applySystemThemeClass(id: SystemThemeId) {
  const root = document.documentElement
  for (const opt of SYSTEM_THEME_OPTIONS) {
    root.classList.remove(systemThemeClass(opt.id))
  }
  root.classList.add(systemThemeClass(id))
}

/** useSystemTheme 管理系统 UI 主题（持久化 + 跨窗口同步）。 */
export function useSystemTheme() {
  const [themeId, setThemeIdState] = useState<SystemThemeId>(readStoredTheme)

  /** setThemeId 切换并持久化系统主题。 */
  const setThemeId = useCallback((id: SystemThemeId) => {
    const next = normalizeSystemTheme(id)
    localStorage.setItem(SYSTEM_THEME_STORAGE_KEY, next)
    applySystemThemeClass(next)
    setThemeIdState(next)
  }, [])

  useEffect(() => {
    applySystemThemeClass(themeId)
  }, [themeId])

  useEffect(() => {
    /** onStorage 监听其他窗口的主题变更。 */
    const onStorage = (ev: StorageEvent) => {
      if (ev.key !== SYSTEM_THEME_STORAGE_KEY) return
      const next = normalizeSystemTheme(ev.newValue)
      applySystemThemeClass(next)
      setThemeIdState(next)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return { themeId, setThemeId, options: SYSTEM_THEME_OPTIONS }
}

/** bootstrapSystemTheme 应用启动时初始化主题（main 入口调用）。 */
export function bootstrapSystemTheme() {
  applySystemThemeClass(readStoredTheme())
}
