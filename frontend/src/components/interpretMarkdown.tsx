import type { Components } from 'react-markdown'
import MermaidCodeBlock from './MermaidCodeBlock'
import { flattenMarkdownChildren, sectionThemeFromTitle } from '../lib/interpretMagazine'
import type { LayoutTheme } from '../lib/interpretThemes'

/** isMermaidLang 是否为 Mermaid 围栏语言标记。 */
function isMermaidLang(lang: string): boolean {
  const l = lang.toLowerCase()
  return l === 'mermaid' || l === 'graph' || l === 'flowchart'
}

/** looksLikeMermaid 无语言标记时根据内容判断是否为 Mermaid 图。 */
function looksLikeMermaid(text: string): boolean {
  const s = text.trimStart()
  return /^(graph\s|flowchart\s|sequenceDiagram|mindmap\b|classDiagram|erDiagram|stateDiagram)/i.test(s)
}

/** buildInterpretMarkdownComponents 构建 Markdown 自定义渲染组件。 */
export function buildInterpretMarkdownComponents(layoutTheme: LayoutTheme): Components {
  return {
    h2: ({ children }) => {
      const title = flattenMarkdownChildren(children).trim()
      const theme = sectionThemeFromTitle(title)
      return (
        <h2 className={`interpret-section-head theme-${theme}`}>
          <span className="interpret-section-label">{title}</span>
        </h2>
      )
    },
    h3: ({ children }) => <h3 className="interpret-h3">{children}</h3>,
    blockquote: ({ children }) => <blockquote className="interpret-pullquote">{children}</blockquote>,
    table: ({ children }) => (
      <div className="interpret-table-wrap">
        <table>{children}</table>
      </div>
    ),
    img: ({ src, alt }) => (
      <figure className="interpret-figure">
        <img src={src} alt={alt || ''} loading="lazy" />
        {alt ? <figcaption>{alt}</figcaption> : null}
      </figure>
    ),
    code: ({ className, children }) => {
      const text = String(children).replace(/\n$/, '')
      const lang = /language-(\w+)/.exec(className || '')?.[1] || ''
      if (isMermaidLang(lang) || (!lang && looksLikeMermaid(text))) {
        return <MermaidCodeBlock code={text} layoutTheme={layoutTheme} />
      }
      return (
        <code className={className} data-lang={lang}>
          {children}
        </code>
      )
    },
  }
}
