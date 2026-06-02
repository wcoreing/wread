//go:build darwin

package overlay

/*
void wreadSetPassMetrics(
    double toolbarH, double edgeInset, double splitterHit, double splitterPad,
    double readerRailW, double readerRailH, double readerRailPad,
    double noteRailW, double noteRailBtnH, double noteRailGap, double railSideExtra);
*/
import "C"

// syncNativePassMetrics 将 layout_geom 常量同步到 pass_darwin。
func syncNativePassMetrics() {
	C.wreadSetPassMetrics(
		C.double(ToolbarHeight),
		C.double(ScopeEdgeInset),
		C.double(SplitterHit),
		C.double(SplitterPad),
		C.double(EdgeRailNativeW),
		C.double(EdgeRailNativeH),
		C.double(EdgeRailHitPad),
		C.double(EdgeRailNativeW),
		C.double(EdgeRailNoteBtnH),
		C.double(EdgeRailGap),
		C.double(RailSideExtra),
	)
}
