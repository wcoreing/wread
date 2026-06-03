export type NotePlaceId = 'right' | 'left' | 'top' | 'bottom' | 'center' | 'popout'

const PLACE_OPTIONS: { place: NotePlaceId; label: string }[] = [
  { place: 'right', label: '右侧' },
  { place: 'left', label: '左侧' },
  { place: 'top', label: '顶部' },
  { place: 'center', label: '居中' },
  { place: 'bottom', label: '底部' },
  { place: 'popout', label: '独立' },
]

type Props = {
  active: NotePlaceId
  onPick: (place: NotePlaceId) => void
  className?: string
}

/** NotePlaceBar 笔记停靠位置选择。 */
export default function NotePlaceBar({ active, onPick, className = 'note-layout-select' }: Props) {
  return (
    <select
      className={className}
      value={active}
      title="笔记位置"
      onChange={(e) => onPick(e.target.value as NotePlaceId)}
    >
      {PLACE_OPTIONS.map((opt) => (
        <option key={opt.place} value={opt.place}>{opt.label}</option>
      ))}
    </select>
  )
}

/** resolveNotePlace 解析当前笔记停靠方位。 */
export function resolveNotePlace(docked: boolean, place: string): NotePlaceId {
  if (!docked || place === 'popout') return 'popout'
  if (place === 'left' || place === 'top' || place === 'bottom' || place === 'center') return place
  return 'right'
}
