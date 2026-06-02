import { createContext, useContext } from 'react'

/** InterpretMermaidReadyCtx 解读区 Mermaid 是否可渲染（流式结束后为 true）。 */
export const InterpretMermaidReadyCtx = createContext(false)

/** useInterpretMermaidReady 读取 Mermaid 渲染就绪状态。 */
export function useInterpretMermaidReady() {
  return useContext(InterpretMermaidReadyCtx)
}
