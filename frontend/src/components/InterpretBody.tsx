import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { parseInterpretSections } from '../lib/interpretSections'
import { useSystemTheme } from '../hooks/useSystemTheme'
import {
  layoutThemeFromSystemTheme,
  mastheadMode,
  useSectionCards,
} from '../lib/interpretThemes'
import { buildInterpretMarkdownComponents } from './interpretMarkdown'
import { InterpretMermaidReadyCtx } from './interpretMermaidContext'
import './readerContent.css'
import './readerThemes.css'

type Props = {
  content: string
  emptyHint: string
  streaming?: boolean
  pageTitle?: string
  notebookName?: string
  concepts?: string[]
}

type MastheadProps = {
  mode: 'full' | 'compact' | 'none'
  notebookName: string
  pageTitle: string
  tags: string[]
}

/** InterpretMasthead 解读页眉（仅 AI 元信息，不含截屏/OCR）。 */
function InterpretMasthead({
  mode,
  notebookName,
  pageTitle,
  tags,
}: MastheadProps) {
  if (mode === 'none') return null
  if (mode === 'compact') {
    return (
      <header className="interpret-masthead compact">
        {pageTitle && <h1 className="interpret-title">{pageTitle}</h1>}
        {notebookName && <p className="interpret-kicker-inline">{notebookName}</p>}
      </header>
    )
  }
  return (
    <header className="interpret-masthead">
      {notebookName && <p className="interpret-kicker">{notebookName}</p>}
      {pageTitle && <h1 className="interpret-title">{pageTitle}</h1>}
      {tags.length > 0 && (
        <ul className="interpret-tags" aria-label="关键概念">
          {tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      )}
    </header>
  )
}

/** InterpretBody 解读正文（多预设排版 + Mermaid）。 */
export default function InterpretBody({
  content,
  emptyHint,
  streaming = false,
  pageTitle = '',
  notebookName = '',
  concepts = [],
}: Props) {
  const { themeId } = useSystemTheme()
  const layoutTheme = layoutThemeFromSystemTheme(themeId)
  const tags = concepts.filter((c) => c.trim())
  const mermaidReady = !streaming
  const scrollRef = useRef<HTMLElement>(null)
  const scrollTopRef = useRef(0)
  const mdComponents = useMemo(() => buildInterpretMarkdownComponents(layoutTheme), [layoutTheme])
  /** cardBodyComponents 卡片节内不再渲染 ## 为杂志 h2，避免与卡片标题重复。 */
  const cardBodyComponents = useMemo(
    () => ({
      ...mdComponents,
      h2: ({ children }: { children?: ReactNode }) => (
        <h3 className="interpret-h3">{children}</h3>
      ),
    }),
    [mdComponents],
  )
  const sections = useMemo(() => parseInterpretSections(content), [content])
  const cardMode = useSectionCards(layoutTheme) && sections && sections.length > 0
  const headMode = mastheadMode(layoutTheme)

  /** 流式输出时解读区贴底滚动；结束时恢复滚动位置，避免闪跳。 */
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (streaming) {
      scrollTopRef.current = el.scrollTop
      const stick = () => {
        el.scrollTop = el.scrollHeight
      }
      stick()
      const id = requestAnimationFrame(stick)
      return () => cancelAnimationFrame(id)
    }
    el.scrollTop = scrollTopRef.current
  }, [content, streaming])

  if (!content) {
    return (
      <div className={`interpret-body interpret-theme-${layoutTheme} empty`}>
        <p>{emptyHint}</p>
      </div>
    )
  }

  return (
    <article
      ref={scrollRef}
      className={`interpret-body interpret-theme-${layoutTheme} markdown-body${streaming ? ' streaming' : ''}`}
    >
      <InterpretMasthead
        mode={headMode}
        notebookName={notebookName}
        pageTitle={streaming ? '' : pageTitle}
        tags={streaming ? [] : tags}
      />

      <div className="interpret-article-body">
        <InterpretMermaidReadyCtx.Provider value={mermaidReady}>
          {cardMode ? (
            <div className="interpret-section-cards">
              {sections!.map((sec) => (
                <section
                  key={sec.title}
                  className={`interpret-section-card theme-${sec.sectionTheme}`}
                >
                  <h2 className={`interpret-section-head theme-${sec.sectionTheme}`}>
                    <span className="interpret-section-label">{sec.title}</span>
                  </h2>
                  <Markdown remarkPlugins={[remarkGfm]} components={cardBodyComponents}>
                    {sec.body}
                  </Markdown>
                </section>
              ))}
            </div>
          ) : (
            <Markdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {content}
            </Markdown>
          )}
        </InterpretMermaidReadyCtx.Provider>
        {streaming && <span className="interpret-cursor" aria-hidden="true" />}
      </div>
    </article>
  )
}
