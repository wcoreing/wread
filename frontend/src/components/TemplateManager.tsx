import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { useInterpretSettings } from '../hooks/useInterpretSettings'

type Settings = ReturnType<typeof useInterpretSettings>

type Props = {
  settings: Settings
  className?: string
}

const STORAGE_KEY = 'wread.templateSideW'
const DEFAULT_SIDE_W = 128
const MIN_SIDE_W = 96
const MAX_SIDE_W = 280

/** readSideWidth 读取模板列表宽度。 */
function readSideWidth() {
  const saved = Number(localStorage.getItem(STORAGE_KEY))
  if (!Number.isFinite(saved)) return DEFAULT_SIDE_W
  return Math.max(MIN_SIDE_W, Math.min(MAX_SIDE_W, Math.round(saved)))
}

/** TemplateManager 解读模板列表与编辑（左右布局，可拖动分栏）。 */
export default function TemplateManager({ settings, className = 'interpret-settings' }: Props) {
  const s = settings
  const canDelete = s.promptSettings.templates.length > 1
  const [sideW, setSideW] = useState(readSideWidth)
  const sideWRef = useRef(sideW)

  useEffect(() => {
    sideWRef.current = sideW
  }, [sideW])

  /** startSplitDrag 拖动调整模板列表宽度。 */
  const startSplitDrag = (startX: number) => {
    const startW = sideWRef.current
    const onMove = (ev: MouseEvent) => {
      const next = Math.max(MIN_SIDE_W, Math.min(MAX_SIDE_W, Math.round(startW + ev.clientX - startX)))
      setSideW(next)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      localStorage.setItem(STORAGE_KEY, String(sideWRef.current))
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div
      className={`${className} template-manager`}
      style={{ '--template-side-w': `${sideW}px` } as CSSProperties}
    >
      <div className="interpret-settings-head template-head-drag">
        <span>模板管理</span>
        <button
          type="button"
          className="template-reset-btn"
          onClick={() => s.resetTemplates().catch((e) => console.error(e))}
        >
          恢复默认
        </button>
      </div>
      {s.status && <div className="interpret-settings-status">{s.status}</div>}

      <div className="template-split">
        <aside className="template-side">
          <div className="template-list">
            {s.promptSettings.templates.map((t) => {
              const editing = t.id === s.tplId
              return (
                <div key={t.id} className={`template-list-row ${editing ? 'editing' : ''}`}>
                  <button
                    type="button"
                    className="template-list-item"
                    onClick={() => s.selectTemplateForEdit(t.id).catch((e) => console.error(e))}
                  >
                    <span className="template-list-name">{t.name}</span>
                  </button>
                  {canDelete && (
                    <button
                      type="button"
                      className="template-op-btn danger"
                      onClick={() => s.deleteTemplate(t.id).catch((e) => console.error(e))}
                    >
                      删除
                    </button>
                  )}
                </div>
              )
            })}
          </div>
          <button
            type="button"
            className="template-list-add"
            onClick={() => s.createTemplate().catch((e) => console.error(e))}
          >
            + 新建
          </button>
        </aside>

        <div
          className="template-splitter"
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            startSplitDrag(e.clientX)
          }}
        />

        <div className="template-editor">
          {s.tplId ? (
            <>
              <label>模板名称</label>
              <input value={s.tplName} onChange={(e) => s.updateTplName(e.target.value)} />

              <label>System 提示词</label>
              <textarea
                className="interpret-settings-editor template-editor-body"
                value={s.tplBody}
                onChange={(e) => s.updateTplBody(e.target.value)}
              />
            </>
          ) : (
            <div className="template-editor-empty">左侧选择或新建模板</div>
          )}
        </div>
      </div>
    </div>
  )
}
