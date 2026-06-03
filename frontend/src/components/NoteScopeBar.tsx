import { catalogRailLabel, notebookRailLabel } from '../lib/catalogLayout'

type Props = {
  listOpen: boolean
  onToggleList: () => void
  catalogCollapsed: boolean
  onToggleCatalog: () => void
  showEntryMode?: boolean
  catalogAutoAdd?: boolean
  onCatalogAutoAddChange?: (auto: boolean) => void
  pendingCatalogEntry?: boolean
  catalogEntryReady?: boolean
  onAddToChapter?: () => void
}

/** NoteScopeBar 笔记二级栏：笔记本、目录、录入方式。 */
export default function NoteScopeBar({
  listOpen,
  onToggleList,
  catalogCollapsed,
  onToggleCatalog,
  showEntryMode = true,
  catalogAutoAdd = true,
  onCatalogAutoAddChange,
  pendingCatalogEntry = false,
  catalogEntryReady = false,
  onAddToChapter,
}: Props) {
  return (
    <div className="note-scope-bar">
      <div className="note-scope-nav">
        <button
          type="button"
          className={`sidebar-menu-btn ${listOpen ? 'active' : ''}`}
          onClick={onToggleList}
          title={listOpen ? '收起笔记本列表' : '展开笔记本列表'}
        >
          {notebookRailLabel()}
        </button>
        <button
          type="button"
          className={`sidebar-menu-btn ${!catalogCollapsed ? 'active' : ''}`}
          onClick={onToggleCatalog}
          title={catalogCollapsed ? '展开目录' : '收起目录'}
          aria-expanded={!catalogCollapsed}
        >
          {catalogRailLabel()}
        </button>
      </div>
      {showEntryMode && onCatalogAutoAddChange && (
        <div className="note-entry-mode">
          <span className="note-entry-mode-label">录入方式</span>
          <div className="note-catalog-mode" role="radiogroup" aria-label="录入方式">
            <button
              type="button"
              role="radio"
              aria-checked={catalogAutoAdd}
              className={catalogAutoAdd ? 'active' : ''}
              onClick={() => onCatalogAutoAddChange(true)}
            >
              自动
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={!catalogAutoAdd}
              className={!catalogAutoAdd ? 'active' : ''}
              onClick={() => onCatalogAutoAddChange(false)}
            >
              手动
            </button>
          </div>
        </div>
      )}
      {showEntryMode && !catalogAutoAdd && pendingCatalogEntry && onAddToChapter && (
        <button
          type="button"
          className={`sidebar-menu-btn note-scope-add-btn${catalogEntryReady ? ' note-entry-ready' : ''}`}
          title={catalogEntryReady ? '将当前解读录入目录' : '录入目录（需先在目录选择章节）'}
          onClick={onAddToChapter}
        >
          录入
        </button>
      )}
    </div>
  )
}
