package overlay

// 穿透热区尺寸（唯一来源；须与 frontend/src/components/edgeRail.css 一致）。
// 修改后由 setNativePassThroughLayout 同步到 darwin。
const (
	ToolbarHeight    = 36
	ScopeEdgeInset   = 14
	SplitterHit      = 7
	SplitterPad      = 3
	EdgeRailBtnW     = 30
	EdgeRailBtnH     = 72
	EdgeRailGap      = 8
	EdgeRailHitPad   = 8
	EdgeRailNativeW  = 38
	EdgeRailNativeH  = 92
	EdgeRailNoteBtnH = 82 // 原生笔记竖条单钮命中高（≥ CSS 72 + 余量）
	RailSideExtra    = 4  // 穿透带靠竖条侧额外内缩
)

// ReaderRailSideInset 阅读区穿透带靠翻页侧内缩（避开解读竖条）。
func ReaderRailSideInset() float64 {
	return float64(EdgeRailNativeW + EdgeRailHitPad + RailSideExtra)
}
