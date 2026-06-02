package overlay

// 穿透带几何（唯一原生判定来源；竖条/笔记等由 Web 点击，仅穿透带 ignores+Post）。
// 须与 frontend/src/components/edgeRail.css 中竖条侧内缩一致。
const (
	ToolbarHeight   = 36
	ScopeEdgeInset  = 14
	EdgeRailNativeW = 38 // 解读条命中宽，用于穿透带靠翻页侧内缩
	EdgeRailHitPad  = 8
	RailSideExtra   = 4
)
