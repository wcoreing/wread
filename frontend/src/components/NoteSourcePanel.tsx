import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSourcePanelView } from '../hooks/useSourcePanelView'

type Props = {
  ocrOriginal: string
  capturePreview: string
  pageTitle: string
}

/** NoteSourcePanel 笔记模式下侧栏原文对照（截屏 / OCR 互斥切换）。 */
export default function NoteSourcePanel({ ocrOriginal, capturePreview, pageTitle }: Props) {
  const { viewMode, setViewMode } = useSourcePanelView()
  const [zoomOpen, setZoomOpen] = useState(false)
  const hasImage = Boolean(capturePreview)
  const hasOcr = Boolean(ocrOriginal.trim())
  const hasSource = hasImage || hasOcr

  /** closeZoom 关闭截屏放大层。 */
  const closeZoom = useCallback(() => setZoomOpen(false), [])

  useEffect(() => {
    if (!zoomOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeZoom()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoomOpen, closeZoom])

  /** resolveViewMode 当前可展示的模式，无数据时回退到另一项。 */
  const activeMode = (() => {
    if (viewMode === 'image' && hasImage) return 'image' as const
    if (viewMode === 'ocr' && hasOcr) return 'ocr' as const
    if (hasImage) return 'image' as const
    if (hasOcr) return 'ocr' as const
    return viewMode
  })()

  return (
    <div className="source-panel">
      <div className="source-head">
        <div className="source-head-main">
          <span className="source-head-title">原文对照</span>
          <div className="source-view-mode" role="tablist" aria-label="原文显示">
            <button
              type="button"
              role="tab"
              aria-selected={activeMode === 'image'}
              className={activeMode === 'image' ? 'active' : ''}
              disabled={!hasImage}
              title={hasImage ? '查看截屏' : '暂无截屏'}
              onClick={() => setViewMode('image')}
            >
              截屏
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeMode === 'ocr'}
              className={activeMode === 'ocr' ? 'active' : ''}
              disabled={!hasOcr}
              title={hasOcr ? '查看 OCR 文本' : '暂无 OCR'}
              onClick={() => setViewMode('ocr')}
            >
              OCR
            </button>
          </div>
        </div>
        {pageTitle && <span className="source-head-page">{pageTitle}</span>}
      </div>
      {!hasSource ? (
        <p className="source-empty">暂无原文，先在阅读器解读或在目录选一页</p>
      ) : activeMode === 'image' && hasImage ? (
        <div className="source-body">
          <button
            type="button"
            className="source-preview-btn"
            title="点击放大"
            onClick={() => setZoomOpen(true)}
          >
            <img src={capturePreview} alt={pageTitle || '截屏原文'} className="source-preview" />
          </button>
        </div>
      ) : activeMode === 'ocr' && hasOcr ? (
        <div className="source-body">
          <pre className="source-ocr">{ocrOriginal}</pre>
        </div>
      ) : (
        <p className="source-empty">当前模式暂无内容，请切换查看</p>
      )}
      {zoomOpen &&
        hasImage &&
        createPortal(
          <div
            className="source-zoom-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="截屏放大"
            onClick={closeZoom}
          >
            <button type="button" className="source-zoom-close" aria-label="关闭" onClick={closeZoom}>
              ×
            </button>
            <img
              src={capturePreview}
              alt={pageTitle || '截屏原文'}
              className="source-zoom-img"
              onClick={closeZoom}
            />
          </div>,
          document.body,
        )}
    </div>
  )
}
