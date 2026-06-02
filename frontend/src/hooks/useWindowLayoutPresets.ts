import { useEffect, useRef, useState } from 'react'
import { Events } from '@wailsio/runtime'
import { Service } from '../../bindings/wread/internal/app'
import type { WindowLayoutPresetsDO } from '../../bindings/wread/internal/model'
import { builtinDefaultLayoutPresetID } from '../lib/layoutPresetSummary'

/** useWindowLayoutPresets 窗口布局预设的读取、保存与应用。 */
export function useWindowLayoutPresets() {
  const [presets, setPresets] = useState<WindowLayoutPresetsDO>({ activeId: '', presets: [] })
  const [editId, setEditId] = useState('')
  const [editName, setEditName] = useState('')
  const [status, setStatus] = useState('')
  const editNameRef = useRef('')

  /** syncEditRefs 同步名称 ref，供防抖保存读取最新值。 */
  const syncEditRefs = (name: string) => {
    editNameRef.current = name
  }

  /** loadPresets 从后端刷新预设列表。 */
  const loadPresets = async (selectId?: string) => {
    const st = await Service.GetWindowLayoutPresets()
    setPresets(st)
    const target = selectId || editId || st.activeId || st.presets[0]?.id || ''
    const preset = st.presets.find((p) => p.id === target) || st.presets[0]
    if (!preset) return
    setEditId(preset.id)
    setEditName(preset.name)
    syncEditRefs(preset.name)
  }

  useEffect(() => {
    loadPresets().catch(console.error)
    Events.On('layout:preset', (ev: { data: string }) => {
      loadPresets(ev.data).catch(console.error)
    })
  }, [])

  const activePreset = presets.presets.find((p) => p.id === presets.activeId)
  const editingPreset = presets.presets.find((p) => p.id === editId)

  /** selectPresetForEdit 选中预设进入编辑。 */
  const selectPresetForEdit = async (id: string) => {
    if (id === editId) return
    const preset = presets.presets.find((p) => p.id === id)
    if (!preset) return
    setEditId(preset.id)
    setEditName(preset.name)
    syncEditRefs(preset.name)
    setStatus('')
  }

  /** updatePresetName 更新预设名称。 */
  const updatePresetName = (name: string) => {
    setEditName(name)
    syncEditRefs(name)
  }

  /** savePresetName 保存当前编辑的名称。 */
  const savePresetName = async () => {
    if (!editId) return
    await Service.SaveWindowLayoutPreset({ id: editId, name: editNameRef.current, fromCurrent: false })
    await loadPresets(editId)
    setStatus('名称已保存')
  }

  /** applyPreset 切换并应用布局预设。 */
  const applyPreset = async (id: string) => {
    await Service.ApplyWindowLayoutPreset(id)
    await loadPresets(id)
    setStatus('布局已应用')
  }

  /** applyActivePreset 应用当前选中的布局预设。 */
  const applyActivePreset = async () => {
    if (!editId) return
    await applyPreset(editId)
  }

  /** createPreset 将当前窗口保存为新预设。 */
  const createPreset = async () => {
    const saved = await Service.SaveWindowLayoutPreset({
      id: '',
      name: `布局 ${presets.presets.length + 1}`,
      fromCurrent: true,
    })
    await loadPresets(saved.id)
    setStatus('已保存当前窗口')
  }

  /** refreshPresetFromCurrent 用当前窗口覆盖所选预设。 */
  const refreshPresetFromCurrent = async () => {
    if (!editId) return
    await Service.SaveWindowLayoutPreset({ id: editId, name: editNameRef.current, fromCurrent: true })
    await loadPresets(editId)
    setStatus('已更新为当前窗口')
  }

  /** deletePreset 删除布局预设。 */
  const deletePreset = async (id: string) => {
    await Service.DeleteWindowLayoutPreset(id)
    await loadPresets()
    setStatus('已删除')
  }

  /** restoreDefaultLayout 恢复内置默认布局。 */
  const restoreDefaultLayout = async () => {
    await Service.RestoreDefaultWindowLayout()
    await loadPresets(builtinDefaultLayoutPresetID)
    setStatus('已恢复默认')
  }

  return {
    presets,
    activePreset,
    editingPreset,
    editId,
    editName,
    updatePresetName,
    savePresetName,
    selectPresetForEdit,
    applyPreset,
    applyActivePreset,
    createPreset,
    refreshPresetFromCurrent,
    deletePreset,
    restoreDefaultLayout,
    status,
    canDelete: (id: string) => id !== builtinDefaultLayoutPresetID && presets.presets.length > 1,
  }
}

export type WindowLayoutPresetsApi = ReturnType<typeof useWindowLayoutPresets>
