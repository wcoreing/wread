//go:build darwin

package overlay

/*
void wreadSetPassMetrics(double toolbarH, double edgeInset, double readerRailW,
                         double readerRailPad, double railSideExtra);
*/
import "C"

// syncNativePassMetrics 将 layout_geom 常量同步到 pass_darwin。
func syncNativePassMetrics() {
	C.wreadSetPassMetrics(
		C.double(ToolbarHeight),
		C.double(ScopeEdgeInset),
		C.double(EdgeRailNativeW),
		C.double(EdgeRailHitPad),
		C.double(RailSideExtra),
	)
}
