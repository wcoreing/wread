import MermaidBlock from './MermaidBlock'
import { useInterpretMermaidReady } from './interpretMermaidContext'
import type { LayoutTheme } from '../lib/interpretThemes'

type Props = {
  code: string
  layoutTheme: LayoutTheme
}

/** MermaidCodeBlock 订阅 Context，流式结束无需 remount 整页 Markdown 即可渲染图。 */
export default function MermaidCodeBlock({ code, layoutTheme }: Props) {
  const ready = useInterpretMermaidReady()
  return <MermaidBlock code={code} ready={ready} layoutTheme={layoutTheme} />
}
