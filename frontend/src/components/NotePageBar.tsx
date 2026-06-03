import NoteReaderSettings from './NoteReaderSettings'
import type { ReaderSettingsDO } from '../../bindings/wread/internal/model'

type Props = {
  settings: ReaderSettingsDO
  onChange: (next: ReaderSettingsDO) => void
  className?: string
}

/** NotePageBar 正文顶排版工具条。 */
export default function NotePageBar({ settings, onChange, className = 'note-page-bar' }: Props) {
  return (
    <div className={className}>
      <NoteReaderSettings settings={settings} onChange={onChange} />
    </div>
  )
}
