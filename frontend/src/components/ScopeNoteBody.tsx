import InterpretBody from './InterpretBody'
import NotePageBar from './NotePageBar'
import type { ReaderSettingsDO } from '../../bindings/wread/internal/model'

type Props = {
  content: string
  emptyHint: string
  streaming?: boolean
  pageTitle?: string
  notebookName?: string
  concepts?: string[]
  readerSettings: ReaderSettingsDO
  onReaderSettingsChange: (next: ReaderSettingsDO) => void
}

/** ScopeNoteBody 笔记模式下阅读区：排版工具条 + 解读正文。 */
export default function ScopeNoteBody({
  content,
  emptyHint,
  streaming = false,
  pageTitle = '',
  notebookName = '',
  concepts = [],
  readerSettings,
  onReaderSettingsChange,
}: Props) {
  return (
    <div className="scope-note-shell">
      <NotePageBar
        className="note-page-bar scope-note-bar"
        settings={readerSettings}
        onChange={onReaderSettingsChange}
      />
      <div className="scope-note-body">
        <InterpretBody
          content={content}
          emptyHint={emptyHint}
          streaming={streaming}
          pageTitle={pageTitle}
          notebookName={notebookName}
          concepts={concepts}
        />
      </div>
    </div>
  )
}
