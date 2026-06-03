import { useEffect, useRef, useState } from 'react'
import { Service } from '../../bindings/wread/internal/app'
import type { PromptSettingsDO } from '../../bindings/wread/internal/model'

/** useInterpretSettings 解读模板与 AI 连接配置。 */
export function useInterpretSettings() {
  const [apiBase, setApiBase] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [modelName, setModelName] = useState('qwen-plus')
  const [hasKey, setHasKey] = useState(false)
  const [status, setStatus] = useState('')
  const [promptSettings, setPromptSettings] = useState<PromptSettingsDO>({ activeId: '', templates: [] })
  const [tplId, setTplId] = useState('')
  const [tplName, setTplName] = useState('')
  const [tplBody, setTplBody] = useState('')

  const skipSave = useRef(false)
  const saveTplTimer = useRef<number>()
  const tplIdRef = useRef('')
  const tplNameRef = useRef('')
  const tplBodyRef = useRef('')

  /** syncTemplateRefs 同步模板编辑 ref，供防抖保存读取最新值。 */
  const syncTemplateRefs = (id: string, name: string, body: string) => {
    tplIdRef.current = id
    tplNameRef.current = name
    tplBodyRef.current = body
  }

  /** loadPromptEditor 同步模板编辑器字段。 */
  const loadPromptEditor = (st: PromptSettingsDO, id?: string) => {
    const targetId = id || st.activeId || st.templates[0]?.id || ''
    const tpl = st.templates.find((t) => t.id === targetId) || st.templates[0]
    if (!tpl) return
    skipSave.current = true
    setTplId(tpl.id)
    setTplName(tpl.name)
    setTplBody(tpl.systemPrompt)
    syncTemplateRefs(tpl.id, tpl.name, tpl.systemPrompt)
    window.setTimeout(() => {
      skipSave.current = false
    }, 0)
  }

  /** flushTemplateSave 立即保存当前模板编辑内容。 */
  const flushTemplateSave = async () => {
    window.clearTimeout(saveTplTimer.current)
    if (skipSave.current || !tplIdRef.current) return
    const saved = await Service.SavePromptTemplate({
      id: tplIdRef.current,
      name: tplNameRef.current,
      systemPrompt: tplBodyRef.current,
    })
    const st = await Service.GetPromptSettings()
    setPromptSettings(st)
    syncTemplateRefs(saved.id, tplNameRef.current, tplBodyRef.current)
  }

  /** scheduleTemplateSave 防抖自动保存模板。 */
  const scheduleTemplateSave = () => {
    if (skipSave.current || !tplIdRef.current) return
    window.clearTimeout(saveTplTimer.current)
    saveTplTimer.current = window.setTimeout(() => {
      flushTemplateSave().catch(console.error)
    }, 400)
  }

  useEffect(() => {
    Service.GetAISettings().then((s) => {
      setApiBase(s.apiBase || 'https://dashscope.aliyuncs.com/compatible-mode/v1')
      setModelName(s.model || 'qwen-plus')
      setHasKey(s.hasApiKey)
    }).catch(console.error)
    Service.GetPromptSettings().then((st) => {
      setPromptSettings(st)
      loadPromptEditor(st)
    }).catch(console.error)
    return () => window.clearTimeout(saveTplTimer.current)
  }, [])

  const activeTemplateName = promptSettings.templates.find((t) => t.id === promptSettings.activeId)?.name || '默认'

  /** selectTemplateForEdit 选中模板进入编辑，切换前保存当前编辑。 */
  const selectTemplateForEdit = async (id: string) => {
    if (id === tplIdRef.current) return
    try {
      await flushTemplateSave()
    } catch (e) {
      console.error(e)
    }
    loadPromptEditor(promptSettings, id)
    setStatus('')
  }

  /** pickTemplate 设为当前解读模板。 */
  const pickTemplate = async (id: string) => {
    if (id === promptSettings.activeId) return
    await Service.SetActivePromptTemplate(id)
    const st = await Service.GetPromptSettings()
    setPromptSettings(st)
    if (tplIdRef.current) {
      loadPromptEditor(st, tplIdRef.current)
    }
  }

  /** createTemplate 新建空白模板，返回新模板 id。 */
  const createTemplate = async () => {
    try {
      await flushTemplateSave()
    } catch (e) {
      console.error(e)
    }
    const saved = await Service.SavePromptTemplate({
      id: '',
      name: '新模板',
      systemPrompt: '你是伴读老师。请结合笔记本主题 {{notebookName}} 与上文摘要 {{rollingSummary}}，解读当前段落。',
    })
    const st = await Service.GetPromptSettings()
    setPromptSettings(st)
    loadPromptEditor(st, saved.id)
    setStatus('')
    return saved.id
  }

  /** updateTplName 更新模板名称并自动保存。 */
  const updateTplName = (name: string) => {
    setTplName(name)
    tplNameRef.current = name
    scheduleTemplateSave()
  }

  /** updateTplBody 更新模板正文并自动保存。 */
  const updateTplBody = (body: string) => {
    setTplBody(body)
    tplBodyRef.current = body
    scheduleTemplateSave()
  }

  /** deleteTemplate 删除指定模板。 */
  const deleteTemplate = async (id: string) => {
    window.clearTimeout(saveTplTimer.current)
    await Service.DeletePromptTemplate(id)
    const st = await Service.GetPromptSettings()
    setPromptSettings(st)
    loadPromptEditor(st)
    setStatus('')
  }

  /** resetTemplates 恢复默认模板集。 */
  const resetTemplates = async () => {
    window.clearTimeout(saveTplTimer.current)
    const st = await Service.ResetPromptTemplates()
    setPromptSettings(st)
    loadPromptEditor(st)
    setStatus('已恢复默认')
  }

  /** saveAI 保存 AI 连接配置。 */
  const saveAI = async () => {
    await Service.SaveAISettings({ apiBase, apiKey, model: modelName, provider: 'dashscope' })
    setHasKey(true)
    setApiKey('')
    setStatus('AI 已保存')
  }

  /** testAI 测试 AI 连接。 */
  const testAI = async () => {
    await Service.TestAIConnection()
    setStatus('连接正常')
  }

  return {
    apiBase,
    setApiBase,
    apiKey,
    setApiKey,
    modelName,
    setModelName,
    hasKey,
    status,
    promptSettings,
    tplId,
    tplName,
    updateTplName,
    tplBody,
    updateTplBody,
    activeTemplateName,
    selectTemplateForEdit,
    pickTemplate,
    createTemplate,
    deleteTemplate,
    resetTemplates,
    saveAI,
    testAI,
  }
}
