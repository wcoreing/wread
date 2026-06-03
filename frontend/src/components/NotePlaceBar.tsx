import ChoiceSelect from './ChoiceSelect'

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
    <ChoiceSelect
      className={className}
      value={active}
      title="笔记位置"
      options={PLACE_OPTIONS.map((opt) => ({ value: opt.place, label: opt.label }))}
      onChange={onPick}
    />
  )
}

/** resolveNotePlace 解析当前笔记停靠方位。 */
export function resolveNotePlace(docked: boolean, place: string): NotePlaceId {
  if (!docked || place === 'popout') return 'popout'
  if (place === 'left' || place === 'top' || place === 'bottom' || place === 'center') return place
  return 'right'
}
