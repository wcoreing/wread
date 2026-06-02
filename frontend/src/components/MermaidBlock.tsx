import { useEffect, useId, useRef, useState } from 'react'
import mermaid from 'mermaid'
import type { LayoutTheme } from '../lib/interpretThemes'

let mermaidReady = false

/** ensureMermaid 初始化 Mermaid（仅一次）。 */
function ensureMermaid(theme: LayoutTheme) {
  if (mermaidReady) return
  mermaid.initialize({
    startOnLoad: false,
    theme: theme === 'terminal' ? 'dark' : 'neutral',
    securityLevel: 'loose',
    fontFamily: 'inherit',
  })
  mermaidReady = true
}

type Props = {
  code: string
  ready: boolean
  layoutTheme: LayoutTheme
}

/** MermaidBlock 渲染 Mermaid 流程图/时序图。 */
export default function MermaidBlock({ code, ready, layoutTheme }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const renderId = useId().replace(/:/g, '')
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!ready) return
    const text = code.trim()
    if (!text) return
    ensureMermaid(layoutTheme)
    setErr('')
    let cancelled = false
    mermaid
      .render(`mmd-${renderId}-${Date.now()}`, text)
      .then(({ svg }) => {
        if (cancelled || !hostRef.current) return
        hostRef.current.innerHTML = svg
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setErr(String(e))
        if (hostRef.current) hostRef.current.textContent = ''
      })
    return () => {
      cancelled = true
    }
  }, [code, ready, renderId, layoutTheme])

  if (!ready) {
    return (
      <pre className="mermaid-pending">
        <code>{code}</code>
      </pre>
    )
  }

  return (
    <div className="mermaid-block">
      <div className="mermaid-host" ref={hostRef} />
      {err && <p className="mermaid-error">图表无法渲染</p>}
    </div>
  )
}
