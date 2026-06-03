import { useCallback, useEffect, useRef, useState } from 'react'
import { Events } from '@wailsio/runtime'
import { Service } from '../../bindings/wread/internal/app'
import type { AppInfoDO, CatalogNodeDO, ReaderSettingsDO, SessionDO, SnapDO } from '../../bindings/wread/internal/model'
import { idsCoveredByDeletion, pruneSelectionRoots } from '../lib/catalogSelection'
import {
  findCatalogNode,
  findChapterTitle,
  isChapter,
  resolveChapterId,
  snapInCatalog,
} from '../lib/catalogTree'

/** resetNotebookView 切换笔记本时清空正文区状态。 */
function resetNotebookView() {
  return {
    current: '',
    ocrOriginal: '',
    capturePreview: '',
    question: '',
    streaming: '',
    status: '',
    selectedChapterId: '',
    selectedPageId: '',
    activeSnapId: '',
    pageTitle: '',
    concepts: [] as string[],
    catalogNodes: [] as CatalogNodeDO[],
  }
}

/** useActiveNotebook 当前笔记本、目录与解读状态。 */
export function useActiveNotebook() {
  const [appInfo, setAppInfo] = useState<AppInfoDO | null>(null)
  const [notebooks, setNotebooks] = useState<SessionDO[]>([])
  const [activeNotebookId, setActiveNotebookId] = useState('')
  const [notebookName, setNotebookName] = useState('')
  const [status, setStatus] = useState('')
  const [streaming, setStreaming] = useState('')
  const [current, setCurrent] = useState('')
  const [ocrOriginal, setOcrOriginal] = useState('')
  const [capturePreview, setCapturePreview] = useState('')
  const [question, setQuestion] = useState('')
  const [interpreting, setInterpreting] = useState(false)
  const [catalogNodes, setCatalogNodes] = useState<CatalogNodeDO[]>([])
  const [catalogAutoAdd, setCatalogAutoAdd] = useState(true)
  const [selectedChapterId, setSelectedChapterId] = useState('')
  const [selectedPageId, setSelectedPageId] = useState('')
  const [rootSelected, setRootSelected] = useState(true)
  const [activeSnapId, setActiveSnapId] = useState('')
  const [pageTitle, setPageTitle] = useState('')
  const [concepts, setConcepts] = useState<string[]>([])
  const [catalogEntryScrollId, setCatalogEntryScrollId] = useState('')
  const [readerSettings, setReaderSettings] = useState<ReaderSettingsDO>({
    fontSize: 15,
    lineHeight: 1.75,
    fontFamily: 'system',
    paragraphGap: 12,
  })

  const streamBuf = useRef('')
  const saveFontTimer = useRef<number>()
  const saveNameTimer = useRef<number>()

  /** syncSelectedChapter 恢复或默认选中归入目录。 */
  const syncSelectedChapter = async (nodes: CatalogNodeDO[]) => {
    const parentId = await Service.GetCatalogInsertParent()
    if (parentId && findCatalogNode(nodes, parentId)) {
      setSelectedChapterId(parentId)
      setRootSelected(false)
      return
    }
    setSelectedChapterId('')
    setRootSelected(true)
  }

  /** reloadCatalog 刷新当前笔记本目录。 */
  const reloadCatalog = useCallback((): Promise<CatalogNodeDO[]> => {
    return Service.ListCatalog()
      .then((nodes) => {
        setCatalogNodes(nodes)
        void syncSelectedChapter(nodes)
        return nodes
      })
      .catch((err) => {
        console.error(err)
        return [] as CatalogNodeDO[]
      })
  }, [])

  /** clearCatalogEntryScroll 目录滚到位后清除录入滚动标记。 */
  const clearCatalogEntryScroll = useCallback(() => {
    setCatalogEntryScrollId('')
  }, [])

  /** reloadNotebooks 刷新笔记本列表。 */
  const reloadNotebooks = useCallback(() => {
    Service.ListNotebooks()
      .then(setNotebooks)
      .catch(console.error)
  }, [])

  /** applyActiveNotebook 应用当前打开的笔记本到 UI。 */
  const applyActiveNotebook = useCallback((nb: SessionDO) => {
    setActiveNotebookId(nb.id)
    setNotebookName(nb.notebookName || '未命名笔记本')
    const cleared = resetNotebookView()
    setCurrent(cleared.current)
    setOcrOriginal(cleared.ocrOriginal)
    setCapturePreview(cleared.capturePreview)
    setQuestion(cleared.question)
    setStreaming(cleared.streaming)
    setStatus(cleared.status)
    setSelectedChapterId(cleared.selectedChapterId)
    setSelectedPageId(cleared.selectedPageId)
    setRootSelected(true)
    setActiveSnapId(cleared.activeSnapId)
    setPageTitle(cleared.pageTitle)
    setConcepts(cleared.concepts)
    setCatalogNodes(cleared.catalogNodes)
    reloadCatalog()
    reloadNotebooks()
  }, [reloadCatalog, reloadNotebooks])

  /** openNotebook 打开指定笔记本。 */
  const openNotebook = async (id: string) => {
    if (id === activeNotebookId) return
    const nb = await Service.OpenNotebook(id)
    applyActiveNotebook(nb)
  }

  /** createNotebook 新建笔记本。 */
  const createNotebook = async (title = '') => {
    const nb = await Service.CreateNotebook(title)
    applyActiveNotebook(nb)
  }

  /** deleteNotebook 删除笔记本。 */
  const deleteNotebook = async (id: string) => {
    try {
      const nb = await Service.DeleteNotebook(id)
      applyActiveNotebook(nb)
    } catch (e: unknown) {
      setStatus(String(e))
      console.error(e)
    }
  }

  /** deleteNotebooks 批量删除笔记本。 */
  const deleteNotebooks = async (ids: string[]) => {
    const unique = [...new Set(ids.filter(Boolean))]
    if (unique.length === 0) return
    try {
      let last = await Service.GetActiveNotebook()
      for (const id of unique) {
        last = await Service.DeleteNotebook(id)
      }
      applyActiveNotebook(last)
    } catch (e: unknown) {
      setStatus(String(e))
      console.error(e)
    }
  }

  /** updateReaderSettings 随调随存字体样式。 */
  const updateReaderSettings = (next: ReaderSettingsDO) => {
    setReaderSettings(next)
    window.clearTimeout(saveFontTimer.current)
    saveFontTimer.current = window.setTimeout(() => {
      Service.SaveReaderSettings(next).catch(console.error)
    }, 300)
  }

  /** selectRoot 选中笔记本根目录，作为新建子目录的父级。 */
  const selectRoot = async () => {
    setRootSelected(true)
    setSelectedChapterId('')
    setSelectedPageId('')
    await Service.SetCatalogInsertParent('')
  }

  /** selectChapter 选中章节，作为解读归入目标。 */
  const selectChapter = async (node: CatalogNodeDO) => {
    setRootSelected(false)
    setSelectedChapterId(node.id)
    setSelectedPageId('')
    await Service.SetCatalogInsertParent(node.id)
  }

  /** selectPage 选中章节下的解读页并加载正文。 */
  const selectPage = async (node: CatalogNodeDO) => {
    setRootSelected(false)
    const chapterId = resolveChapterId(catalogNodes, node.id)
    setSelectedPageId(node.id)
    if (chapterId) {
      setSelectedChapterId(chapterId)
      await Service.SetCatalogInsertParent(chapterId)
    }
    const snap = await Service.SelectSnap(node.snapId)
    setActiveSnapId(snap.id)
    setPageTitle(snap.title || node.title)
    setConcepts(snap.concepts || [])
    setCurrent(snap.summary)
    setOcrOriginal(snap.ocrText || '')
    setCapturePreview(snap.capturePreview || '')
  }

  /** createChapter 新建章节。 */
  const createChapter = async (parentId = '') => {
    const parentNode = parentId ? findCatalogNode(catalogNodes, parentId) : undefined
    const parent = parentNode && isChapter(parentNode) ? parentId : ''
    const node = await Service.CreateChapter(parent, '')
    reloadCatalog()
    await selectChapter(node)
  }

  /** setCatalogAutoAdd 设置解读后是否自动归入章节。 */
  const setCatalogAutoAddMode = async (on: boolean) => {
    if (on === catalogAutoAdd) return
    await Service.SetCatalogAutoAdd(on)
    setCatalogAutoAdd(on)
  }

  /** addActiveToChapter 手动将当前解读归入选中章节。 */
  const addActiveToChapter = async (): Promise<boolean> => {
    if (!activeSnapId) return false
    if (!selectedChapterId) {
      setStatus('请先在目录选择章节')
      return false
    }
    try {
      const node = await Service.AddToCatalog(selectedChapterId, activeSnapId, '')
      setSelectedPageId(node.id)
      await reloadCatalog()
      setCatalogEntryScrollId(node.id)
      setStatus('')
      return true
    } catch (e: unknown) {
      setStatus(String(e))
      return false
    }
  }

  /** renameCatalogNode 重命名章节或笔记页。 */
  const renameCatalogNode = async (node: CatalogNodeDO, title: string) => {
    await Service.UpdateCatalogNode({
      id: node.id,
      parentId: node.parentId,
      kind: node.kind,
      title,
      snapId: node.snapId,
    })
    reloadCatalog()
  }

  /** applyAfterCatalogRemoval 删除目录节点后同步选中态与正文区。 */
  const applyAfterCatalogRemoval = async (removedIds: Set<string>, clearedSnapIds: Set<string>) => {
    if (selectedChapterId && removedIds.has(selectedChapterId)) {
      setSelectedChapterId('')
      setRootSelected(true)
      await Service.SetCatalogInsertParent('')
    }
    if (selectedPageId && removedIds.has(selectedPageId)) {
      setSelectedPageId('')
    }
    if (activeSnapId && clearedSnapIds.has(activeSnapId)) {
      setActiveSnapId('')
      setPageTitle('')
      setConcepts([])
      setCurrent('')
      setOcrOriginal('')
      setCapturePreview('')
      setQuestion('')
      setStreaming('')
    }
  }

  /** deleteCatalogNode 删除章节或目录页（含底层解读快照）。 */
  const deleteCatalogNode = async (node: CatalogNodeDO) => {
    try {
      const snapId = node.kind === 'page' ? node.snapId : ''
      const clearedSnaps = new Set<string>()
      if (snapId) clearedSnaps.add(snapId)
      await Service.DeleteCatalogNode(node.id)
      await applyAfterCatalogRemoval(idsCoveredByDeletion(catalogNodes, [node.id]), clearedSnaps)
      reloadCatalog()
    } catch (e: unknown) {
      setStatus(String(e))
      console.error(e)
    }
  }

  /** moveCatalogNode 拖动调整目录父级与排序。 */
  const moveCatalogNode = async (nodeId: string, parentId: string, index: number) => {
    try {
      await Service.MoveCatalogNode(nodeId, parentId, index)
      reloadCatalog()
    } catch (e: unknown) {
      setStatus(String(e))
      console.error(e)
    }
  }

  /** deleteCatalogNodes 批量删除目录项（自动合并父子选中）。 */
  const deleteCatalogNodes = async (ids: string[]) => {
    const roots = pruneSelectionRoots(catalogNodes, ids)
    if (roots.length === 0) return
    try {
      const removedIds = idsCoveredByDeletion(catalogNodes, roots)
      const clearedSnaps = new Set<string>()
      for (const id of removedIds) {
        const n = findCatalogNode(catalogNodes, id)
        if (n?.kind === 'page' && n.snapId) clearedSnaps.add(n.snapId)
      }
      for (const id of roots) {
        await Service.DeleteCatalogNode(id)
      }
      await applyAfterCatalogRemoval(removedIds, clearedSnaps)
      reloadCatalog()
    } catch (e: unknown) {
      setStatus(String(e))
      console.error(e)
    }
  }

  useEffect(() => {
    Service.GetAppInfo().then(setAppInfo).catch(console.error)
    Service.GetCatalogSettings().then((s) => setCatalogAutoAdd(s.autoAdd)).catch(console.error)
    Service.GetReaderSettings().then(setReaderSettings).catch(console.error)
    Service.GetActiveNotebook()
      .then(applyActiveNotebook)
      .catch(console.error)

    const offStatus = Events.On('read:status', (ev: { data: string }) => {
      setStatus(ev.data)
      setInterpreting(true)
      streamBuf.current = ''
      setStreaming('')
      if (ev.data.includes('截屏识别')) {
        setOcrOriginal('')
        setCapturePreview('')
      }
    })
    const offPreview = Events.On('read:preview', (ev: { data: string }) => setCapturePreview(ev.data))
    const offOcr = Events.On('read:ocr', (ev: { data: string }) => setOcrOriginal(ev.data))
    const offDelta = Events.On('read:delta', (ev: { data: string }) => {
      streamBuf.current += ev.data
      setStreaming(streamBuf.current)
    })
    const offDone = Events.On('read:done', (ev: { data: SnapDO }) => {
      setActiveSnapId(ev.data.id)
      setPageTitle(ev.data.title || '')
      setConcepts(ev.data.concepts || [])
      setCurrent(ev.data.summary)
      setOcrOriginal(ev.data.ocrText || '')
      if (ev.data.capturePreview) {
        setCapturePreview(ev.data.capturePreview)
      }
      setSelectedPageId('')
      setStatus('')
      setInterpreting(false)
      setStreaming('')
      reloadCatalog()
      reloadNotebooks()
    })
    const offError = Events.On('read:error', (ev: { data: string }) => {
      setStatus(ev.data)
      setInterpreting(false)
      setStreaming('')
    })
    const offFollowup = Events.On('read:followup', (ev: { data: string }) => {
      setCurrent(ev.data)
      setStatus('')
      setInterpreting(false)
      setStreaming('')
    })
    const offReaderSettings = Events.On('reader:settings', (ev: { data: ReaderSettingsDO }) =>
      setReaderSettings(ev.data),
    )
    const offCatalog = Events.On('catalog:changed', (ev: { data: CatalogNodeDO }) => {
      reloadCatalog()
      if (ev.data?.id) {
        setRootSelected(false)
        if (ev.data.kind === 'page') {
          setSelectedPageId(ev.data.id)
          setSelectedChapterId(ev.data.parentId)
          setCatalogEntryScrollId(ev.data.id)
          Service.SetCatalogInsertParent(ev.data.parentId).catch(console.error)
        } else {
          setSelectedChapterId(ev.data.id)
          Service.SetCatalogInsertParent(ev.data.id).catch(console.error)
        }
      }
    })
    const offNotebook = Events.On('notebook:opened', (ev: { data: SessionDO }) => {
      if (ev.data?.id) applyActiveNotebook(ev.data)
    })

    return () => {
      offStatus()
      offPreview()
      offOcr()
      offDelta()
      offDone()
      offError()
      offFollowup()
      offReaderSettings()
      offCatalog()
      offNotebook()
      window.clearTimeout(saveFontTimer.current)
      window.clearTimeout(saveNameTimer.current)
    }
  }, [applyActiveNotebook, reloadCatalog, reloadNotebooks])

  useEffect(() => {
    if (!activeSnapId || catalogNodes.length === 0) return
    const page = catalogNodes.find((n) => n.kind === 'page' && n.snapId === activeSnapId)
    if (page) {
      setRootSelected(false)
      setSelectedPageId(page.id)
      setSelectedChapterId(page.parentId)
    }
  }, [catalogNodes, activeSnapId])

  /** updateNotebookName 更新笔记本名称并防抖保存。 */
  const updateNotebookName = (name: string) => {
    setNotebookName(name)
    window.clearTimeout(saveNameTimer.current)
    saveNameTimer.current = window.setTimeout(() => {
      Service.SetActiveNotebookName(name).then(() => reloadNotebooks()).catch(console.error)
    }, 400)
  }

  /** followUp 针对当前段落追问。 */
  const followUp = async () => {
    if (!question.trim()) return
    try {
      streamBuf.current = ''
      setStreaming('')
      setInterpreting(true)
      setStatus('追问中…')
      await Service.AskFollowUp(question)
      setQuestion('')
    } catch (e: unknown) {
      setStatus(String(e))
    } finally {
      setInterpreting(false)
    }
  }

  /** catalogOrganizeError AI 分类失败时展示状态。 */
  const catalogOrganizeError = (msg: string) => setStatus(msg)

  /** catalogOrganizeApplied AI 分章成功后清除状态（目录由 catalog:changed 刷新）。 */
  const catalogOrganizeApplied = () => setStatus('')

  const hasSources = Boolean(capturePreview || ocrOriginal)
  const interpretBody = streaming || current
  const emptyHint = '在阅读器点「解读」开始'
  const pendingCatalogEntry = Boolean(
    activeSnapId && !snapInCatalog(catalogNodes, activeSnapId),
  )
  const catalogEntryReady = pendingCatalogEntry && Boolean(selectedChapterId)
  const pendingInChapter = catalogEntryReady
  const selectedChapterTitle = findChapterTitle(catalogNodes, selectedChapterId)

  return {
    appInfo,
    notebooks,
    activeNotebookId,
    notebookName,
    updateNotebookName,
    openNotebook,
    createNotebook,
    deleteNotebook,
    deleteNotebooks,
    status,
    setStatus,
    interpreting,
    readerSettings,
    updateReaderSettings,
    catalogNodes,
    catalogAutoAdd,
    rootSelected,
    selectedChapterId,
    selectedChapterTitle,
    selectedPageId,
    activeSnapId,
    pendingInChapter,
    pendingCatalogEntry,
    catalogEntryReady,
    selectRoot,
    selectChapter,
    selectPage,
    createChapter,
    setCatalogAutoAddMode,
    addActiveToChapter,
    catalogEntryScrollId,
    clearCatalogEntryScroll,
    renameCatalogNode,
    deleteCatalogNode,
    deleteCatalogNodes,
    moveCatalogNode,
    catalogOrganizeError,
    catalogOrganizeApplied,
    current,
    ocrOriginal,
    capturePreview,
    question,
    setQuestion,
    streaming,
    followUp,
    hasSources,
    interpretBody,
    emptyHint,
    pageTitle,
    concepts,
  }
}
