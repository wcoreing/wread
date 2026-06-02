//go:build darwin

package overlay

/*
#import <ApplicationServices/ApplicationServices.h>
*/
import "C"

// AccessibilityTrusted 是否已授予辅助功能（CGEventPost 穿透点击需要）。
func AccessibilityTrusted() bool {
	return C.AXIsProcessTrusted() != 0
}
