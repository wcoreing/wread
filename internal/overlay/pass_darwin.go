//go:build darwin

package overlay

/*
#cgo darwin CFLAGS: -x objective-c
#cgo darwin LDFLAGS: -framework AppKit -framework ApplicationServices -lobjc
#import <AppKit/AppKit.h>
#import <ApplicationServices/ApplicationServices.h>
#import <objc/message.h>
#import <stdarg.h>
#import <string.h>
#import <stdlib.h>

extern void wreadPassLog(const char *msg);

static void wreadLog(const char *fmt, ...) {
	char buf[768];
	va_list ap;
	va_start(ap, fmt);
	vsnprintf(buf, sizeof(buf), fmt, ap);
	va_end(ap);
	wreadPassLog(buf);
}

static CGFloat g_toolbarH = 36.0;
static CGFloat g_edgeInset = 14.0;
static CGFloat g_readerRailW = 38.0;
static CGFloat g_readerRailPad = 8.0;
static CGFloat g_railSideExtra = 4.0;

static bool g_readMode = false;
static bool g_mouseDragging = false;
static bool g_frameDragging = false;
static void *g_window = NULL;
static CFAbsoluteTime g_lastForwardClick = 0;
static CFAbsoluteTime g_lastIgnoreUpdate = 0;
static id g_mouseMonitor = NULL;
static id g_localMouseMonitor = NULL;
static CGFloat g_scopeWidth = 640.0;
static CGFloat g_noteSize = 0.0;
static CGFloat g_catalogWidth = 0.0;
static char g_place[16] = "right";

void wreadSetPassMetrics(double toolbarH, double edgeInset, double readerRailW,
                        double readerRailPad, double railSideExtra) {
	g_toolbarH = toolbarH;
	g_edgeInset = edgeInset;
	g_readerRailW = readerRailW;
	g_readerRailPad = readerRailPad;
	g_railSideExtra = railSideExtra;
}

static BOOL wreadPlaceIs(const char *name) {
	return strncmp(g_place, name, 15) == 0;
}

static void wreadApplyPassThrough(NSWindow *window, BOOL ignore, BOOL forward) {
	static BOOL g_lastIgnore = NO;
	static BOOL g_lastForward = NO;
	if (ignore == g_lastIgnore && forward == g_lastForward) {
		return;
	}
	g_lastIgnore = ignore;
	g_lastForward = forward;
	if (ignore) {
		SEL sel = @selector(setIgnoresMouseEvents:forward:);
		if ([NSWindow instancesRespondToSelector:sel]) {
			((void (*)(id, SEL, BOOL, BOOL))objc_msgSend)((id)window, sel, YES, forward ? YES : NO);
		} else {
			[window setIgnoresMouseEvents:YES];
		}
		return;
	}
	[window setIgnoresMouseEvents:NO];
}

static NSRect wreadWindowFrame(NSWindow *window) {
	return [window frame];
}

static NSRect wreadScopeFrameRect(NSWindow *window) {
	NSRect frame = wreadWindowFrame(window);
	if (wreadPlaceIs("top")) {
		return NSMakeRect(frame.origin.x,
		                  frame.origin.y,
		                  frame.size.width,
		                  frame.size.height - g_noteSize - g_toolbarH);
	}
	if (wreadPlaceIs("bottom")) {
		return NSMakeRect(frame.origin.x,
		                  frame.origin.y + g_noteSize + g_toolbarH,
		                  frame.size.width,
		                  frame.size.height - g_noteSize - g_toolbarH);
	}
	CGFloat x = frame.origin.x;
	CGFloat w = frame.size.width;
	if (wreadPlaceIs("left")) {
		x += g_noteSize;
		w = g_scopeWidth;
	} else {
		x += g_catalogWidth;
		w = g_scopeWidth;
	}
	return NSMakeRect(x,
	                  frame.origin.y,
	                  w,
	                  frame.size.height - g_toolbarH);
}

static BOOL wreadPointInRect(NSPoint p, NSRect r) {
	return r.size.width > 0 && r.size.height > 0 && NSPointInRect(p, r);
}

// wreadPassthroughRect 阅读区中间穿透带（屏幕坐标）；仅此区域 ignores + Post Chrome。
static NSRect wreadPassthroughRect(NSWindow *window) {
	NSRect scopeFrame = wreadScopeFrameRect(window);
	if (scopeFrame.size.width <= 0 || scopeFrame.size.height <= 0) {
		return NSMakeRect(0, 0, 0, 0);
	}
	CGFloat top = g_edgeInset;
	CGFloat bottom = g_edgeInset;
	CGFloat left = g_edgeInset;
	CGFloat right = g_edgeInset;
	CGFloat railSide = g_readerRailW + g_readerRailPad + g_railSideExtra;
	if (g_noteSize > 0.0) {
		if (wreadPlaceIs("left")) {
			left = railSide;
		} else if (!wreadPlaceIs("top") && !wreadPlaceIs("bottom")) {
			right = railSide;
		}
		if (wreadPlaceIs("top")) {
			bottom = railSide;
		}
		if (wreadPlaceIs("bottom")) {
			top = railSide;
		}
	}
	NSRect r = scopeFrame;
	r.origin.x += left;
	r.origin.y += bottom;
	r.size.width -= left + right;
	r.size.height -= top + bottom;
	if (r.size.width < 0.0) {
		r.size.width = 0.0;
	}
	if (r.size.height < 0.0) {
		r.size.height = 0.0;
	}
	return r;
}

// wreadPointInPassthroughBand 几何：是否在阅读穿透带内（不含拖拽态）。
static BOOL wreadPointInPassthroughBand(NSWindow *window, NSPoint mouse) {
	if (!g_readMode || window == NULL) {
		return NO;
	}
	NSRect band = wreadPassthroughRect(window);
	return band.size.width > 0 && band.size.height > 0 && wreadPointInRect(mouse, band);
}

// wreadPointInWindowChrome 窗口四边/四角缩放热区（Shell 布局外框拖柄）。
static BOOL wreadPointInWindowChrome(NSWindow *window, NSPoint mouse) {
	if (window == NULL) {
		return NO;
	}
	NSRect win = wreadWindowFrame(window);
	CGFloat grab = 12.0;
	if (mouse.x <= win.origin.x + grab) {
		return YES;
	}
	if (mouse.x >= NSMaxX(win) - grab) {
		return YES;
	}
	if (mouse.y <= win.origin.y + grab) {
		return YES;
	}
	if (mouse.y >= NSMaxY(win) - grab) {
		return YES;
	}
	return NO;
}

// wreadPointInCatalogColumn 左侧管理区（目录/笔记本列）永不穿透。
static BOOL wreadPointInCatalogColumn(NSWindow *window, NSPoint mouse) {
	if (window == NULL || g_catalogWidth <= 0.0) {
		return NO;
	}
	if (wreadPlaceIs("top") || wreadPlaceIs("bottom")) {
		return NO;
	}
	NSRect win = wreadWindowFrame(window);
	if (wreadPlaceIs("left")) {
		return NO;
	}
	return mouse.x >= win.origin.x && mouse.x < win.origin.x + g_catalogWidth;
}

// wreadPointInNoteColumn 右侧笔记业务区永不穿透。
static BOOL wreadPointInNoteColumn(NSWindow *window, NSPoint mouse) {
	if (window == NULL || g_noteSize <= 0.0) {
		return NO;
	}
	NSRect win = wreadWindowFrame(window);
	if (wreadPlaceIs("left")) {
		return mouse.x >= win.origin.x && mouse.x < win.origin.x + g_noteSize;
	}
	if (wreadPlaceIs("top")) {
		return mouse.y >= win.origin.y && mouse.y < win.origin.y + g_noteSize;
	}
	if (wreadPlaceIs("bottom")) {
		return mouse.y > NSMaxY(win) - g_noteSize;
	}
	return mouse.x > NSMaxX(win) - g_noteSize;
}

// wreadPointInScopeNoteSplitter 阅读区与笔记区分割条热区。
static BOOL wreadPointInScopeNoteSplitter(NSWindow *window, NSPoint mouse) {
	if (window == NULL || g_noteSize <= 0.0 || g_scopeWidth <= 0.0) {
		return NO;
	}
	if (wreadPlaceIs("top") || wreadPlaceIs("bottom") || wreadPlaceIs("left")) {
		return NO;
	}
	NSRect win = wreadWindowFrame(window);
	CGFloat splitX = win.origin.x + g_catalogWidth + g_scopeWidth;
	CGFloat grab = 10.0;
	return mouse.x >= splitX - grab && mouse.x <= splitX + grab;
}

// wreadPointInInteractiveChrome 管理区/笔记区/分割条/外框 — 必须接收 WebView 鼠标。
static BOOL wreadPointInInteractiveChrome(NSWindow *window, NSPoint mouse) {
	return wreadPointInWindowChrome(window, mouse) ||
	       wreadPointInCatalogColumn(window, mouse) ||
	       wreadPointInNoteColumn(window, mouse) ||
	       wreadPointInScopeNoteSplitter(window, mouse);
}

// wreadShouldIgnoreMouse 是否对该点开启 ignores（仅阅读穿透带中心区域）。
static BOOL wreadShouldIgnoreMouse(NSWindow *window, NSPoint mouse) {
	if (g_mouseDragging || g_frameDragging) {
		return NO;
	}
	if (wreadPointInInteractiveChrome(window, mouse)) {
		return NO;
	}
	return wreadPointInPassthroughBand(window, mouse);
}

static CGPoint wreadCocoaToQuartz(NSPoint cocoa) {
	for (NSScreen *screen in [NSScreen screens]) {
		NSRect frame = [screen frame];
		if (!NSMouseInRect(cocoa, frame, NO)) {
			continue;
		}
		return CGPointMake(cocoa.x, NSMaxY(frame) - cocoa.y);
	}
	NSRect frame = [[NSScreen mainScreen] frame];
	return CGPointMake(cocoa.x, NSMaxY(frame) - cocoa.y);
}

static BOOL wreadPIDForWindowNumber(CGWindowID windowNumber, pid_t *outPID) {
	if (outPID == NULL) {
		return NO;
	}
	*outPID = 0;
	CFArrayRef list = CGWindowListCopyWindowInfo(kCGWindowListOptionIncludingWindow, windowNumber);
	if (list == NULL || CFArrayGetCount(list) == 0) {
		if (list != NULL) {
			CFRelease(list);
		}
		return NO;
	}
	CFDictionaryRef info = (CFDictionaryRef)CFArrayGetValueAtIndex(list, 0);
	CFNumberRef pidNum = (CFNumberRef)CFDictionaryGetValue(info, kCGWindowOwnerPID);
	BOOL ok = pidNum != NULL && CFNumberGetValue(pidNum, kCFNumberIntType, outPID);
	CFRelease(list);
	return ok && *outPID > 0;
}

static void wreadRefocusWread(NSWindow *wreadWindow) {
	if (wreadWindow == NULL) {
		return;
	}
	[[NSApplication sharedApplication] activate];
	[wreadWindow makeKeyAndOrderFront:nil];
	wreadLog("refocus wread wn=%ld", (long)[wreadWindow windowNumber]);
}

static void wreadScheduleRefocusWread(NSWindow *wreadWindow) {
	if (wreadWindow == NULL) {
		return;
	}
	dispatch_async(dispatch_get_main_queue(), ^{
		wreadRefocusWread(wreadWindow);
	});
}

// wreadTryPassthroughForward 穿透带内 Post 左键到下层，再夺回 Wread 焦点。
static BOOL wreadTryPassthroughForward(NSWindow *wreadWindow, NSPoint mouse, NSEvent *event,
                                     const char *source) {
	if (wreadWindow == NULL || event == NULL || source == NULL) {
		return NO;
	}
	if (!wreadPointInPassthroughBand(wreadWindow, mouse)) {
		return NO;
	}
	CFAbsoluteTime now = CFAbsoluteTimeGetCurrent();
	if (now - g_lastForwardClick < 0.2) {
		return NO;
	}

	NSInteger wn = [wreadWindow windowNumber];
	NSInteger belowWN =
	    [NSWindow windowNumberAtPoint:mouse belowWindowWithWindowNumber:wn];
	if (belowWN <= 0) {
		wreadLog("%s fail: no window below at (%.1f,%.1f)", source, mouse.x, mouse.y);
		return NO;
	}
	pid_t pid = 0;
	if (!wreadPIDForWindowNumber((CGWindowID)belowWN, &pid)) {
		return NO;
	}
	if (pid == [[NSProcessInfo processInfo] processIdentifier]) {
		return NO;
	}

	CGPoint quartz = wreadCocoaToQuartz(mouse);
	CGEventRef down = CGEventCreateMouseEvent(NULL, kCGEventLeftMouseDown, quartz, kCGMouseButtonLeft);
	if (down == NULL) {
		return NO;
	}
	CGEventRef up = CGEventCreateMouseEvent(NULL, kCGEventLeftMouseUp, quartz, kCGMouseButtonLeft);
	CGEventRef cg = [event CGEvent];
	CGEventFlags flags = cg ? CGEventGetFlags(cg) : 0;
	CGEventSetFlags(down, flags);
	if (up != NULL) {
		CGEventSetFlags(up, flags);
		CGEventSetIntegerValueField(down, kCGMouseEventClickState, 1);
		CGEventSetIntegerValueField(up, kCGMouseEventClickState, 1);
	}
	CGEventPost(kCGHIDEventTap, down);
	if (up != NULL) {
		CGEventPost(kCGHIDEventTap, up);
		CFRelease(up);
	}
	CFRelease(down);
	g_lastForwardClick = now;
	wreadLog("%s ok post quartz=(%.1f,%.1f)", source, quartz.x, quartz.y);
	return YES;
}

// wreadOnPassthroughBandClick 穿透带点击：尝试 Post，并统一抢回 Wread 焦点。
static void wreadOnPassthroughBandClick(NSWindow *window, NSPoint mouse, NSEvent *event,
                                      const char *source) {
	if (!wreadPointInPassthroughBand(window, mouse)) {
		return;
	}
	if (event != NULL && source != NULL) {
		(void)wreadTryPassthroughForward(window, mouse, event, source);
	}
	wreadScheduleRefocusWread(window);
}

// wreadPostMouseClickAt 在屏幕坐标 Post 左键到下层应用。
static BOOL wreadPostMouseClickAt(NSWindow *wreadWindow, NSPoint cocoa) {
	if (wreadWindow == NULL) {
		return NO;
	}
	NSInteger wn = [wreadWindow windowNumber];
	NSInteger belowWN =
	    [NSWindow windowNumberAtPoint:cocoa belowWindowWithWindowNumber:wn];
	if (belowWN <= 0) {
		wreadLog("turn page fail: no window below at (%.1f,%.1f)", cocoa.x, cocoa.y);
		return NO;
	}
	pid_t pid = 0;
	if (!wreadPIDForWindowNumber((CGWindowID)belowWN, &pid)) {
		return NO;
	}
	if (pid == [[NSProcessInfo processInfo] processIdentifier]) {
		return NO;
	}
	CGPoint quartz = wreadCocoaToQuartz(cocoa);
	CGEventRef down = CGEventCreateMouseEvent(NULL, kCGEventLeftMouseDown, quartz, kCGMouseButtonLeft);
	if (down == NULL) {
		return NO;
	}
	CGEventRef up = CGEventCreateMouseEvent(NULL, kCGEventLeftMouseUp, quartz, kCGMouseButtonLeft);
	CGEventSetIntegerValueField(down, kCGMouseEventClickState, 1);
	if (up != NULL) {
		CGEventSetIntegerValueField(up, kCGMouseEventClickState, 1);
	}
	CGEventPost(kCGHIDEventTap, down);
	if (up != NULL) {
		CGEventPost(kCGHIDEventTap, up);
		CFRelease(up);
	}
	CFRelease(down);
	g_lastForwardClick = CFAbsoluteTimeGetCurrent();
	wreadLog("turn page ok quartz=(%.1f,%.1f)", quartz.x, quartz.y);
	return YES;
}

// wreadPostTurnPage 在穿透带翻页侧 Post 左键（连续伴读自动翻页）。
BOOL wreadPostTurnPage(void *nsWindow) {
	if (nsWindow == NULL) {
		return NO;
	}
	NSWindow *window = (__bridge NSWindow *)nsWindow;
	NSRect band = wreadPassthroughRect(window);
	if (band.size.width < 20.0 || band.size.height < 20.0) {
		wreadLog("turn page fail: band too small");
		return NO;
	}
	NSPoint pt;
	pt.x = band.origin.x + band.size.width * 0.82;
	pt.y = band.origin.y + band.size.height * 0.5;
	if (!wreadPostMouseClickAt(window, pt)) {
		return NO;
	}
	wreadScheduleRefocusWread(window);
	return YES;
}

static void wreadRunOnMain(void (^block)(void)) {
	if ([NSThread isMainThread]) {
		block();
		return;
	}
	dispatch_async(dispatch_get_main_queue(), block);
}

static void wreadUpdateIgnoresFromMouse(void) {
	if (!g_readMode || g_window == NULL || g_frameDragging) {
		return;
	}
	CFAbsoluteTime now = CFAbsoluteTimeGetCurrent();
	if (now-g_lastIgnoreUpdate < 0.032) {
		return;
	}
	g_lastIgnoreUpdate = now;
	NSWindow *window = (__bridge NSWindow *)g_window;
	if (![window isVisible]) {
		return;
	}
	BOOL ignore = wreadShouldIgnoreMouse(window, [NSEvent mouseLocation]);
	wreadApplyPassThrough(window, ignore, ignore);
}

static void wreadRemoveMouseMonitor(void) {
	if (g_mouseMonitor != NULL) {
		[NSEvent removeMonitor:g_mouseMonitor];
		g_mouseMonitor = NULL;
	}
	if (g_localMouseMonitor != NULL) {
		[NSEvent removeMonitor:g_localMouseMonitor];
		g_localMouseMonitor = NULL;
	}
}

static void wreadTrackMouseButton(NSEvent *event) {
	switch ([event type]) {
	case NSEventTypeLeftMouseDown:
		g_mouseDragging = YES;
		break;
	case NSEventTypeLeftMouseUp:
		g_mouseDragging = NO;
		break;
	default:
		break;
	}
}

static void wreadInstallMouseMonitor(void) {
	wreadRemoveMouseMonitor();
	g_mouseDragging = NO;
	NSEventMask moveMask = NSEventMaskMouseMoved | NSEventMaskLeftMouseDragged;
	NSEventMask clickMask = NSEventMaskLeftMouseDown | NSEventMaskLeftMouseUp;
	g_mouseMonitor = [NSEvent addGlobalMonitorForEventsMatchingMask:moveMask | clickMask
	                                                         handler:^(NSEvent *event) {
		wreadRunOnMain(^{
			NSWindow *window =
			    g_window != NULL ? (__bridge NSWindow *)g_window : NULL;
			if (g_readMode && window != NULL && [event type] == NSEventTypeLeftMouseDown) {
				wreadOnPassthroughBandClick(window, [NSEvent mouseLocation], event, "global");
			}
			wreadTrackMouseButton(event);
			wreadUpdateIgnoresFromMouse();
		});
	}];
	g_localMouseMonitor = [NSEvent addLocalMonitorForEventsMatchingMask:moveMask | clickMask
	                                                            handler:^NSEvent *(NSEvent *event) {
		NSWindow *window = g_window != NULL ? (__bridge NSWindow *)g_window : NULL;
		if (g_readMode && window != NULL && [event type] == NSEventTypeLeftMouseDown) {
			NSPoint mouse = [NSEvent mouseLocation];
			if (wreadPointInPassthroughBand(window, mouse) &&
			    !wreadPointInInteractiveChrome(window, mouse)) {
				wreadOnPassthroughBandClick(window, mouse, event, "local");
				wreadTrackMouseButton(event);
				wreadUpdateIgnoresFromMouse();
				return nil;
			}
		}
		wreadTrackMouseButton(event);
		wreadUpdateIgnoresFromMouse();
		return event;
	}];
	if (g_mouseMonitor == NULL) {
		wreadLog("global monitor NULL — 需在 辅助功能 中允许 wread");
	}
}

void wreadSetPassThroughLayout(CGFloat scopeWidth, CGFloat noteSize, CGFloat catalogWidth,
                               const char *place) {
	if (scopeWidth == g_scopeWidth && noteSize == g_noteSize &&
	    catalogWidth == g_catalogWidth && place != NULL &&
	    strncmp(g_place, place, sizeof(g_place)) == 0) {
		return;
	}
	g_scopeWidth = scopeWidth;
	g_noteSize = noteSize;
	g_catalogWidth = catalogWidth;
	if (place != NULL) {
		strncpy(g_place, place, sizeof(g_place) - 1);
		g_place[sizeof(g_place) - 1] = '\0';
	}
	wreadRunOnMain(^{
		wreadUpdateIgnoresFromMouse();
	});
}

void wreadSetFrameDragging(bool dragging) {
	g_frameDragging = dragging ? true : false;
	if (dragging) {
		g_mouseDragging = true;
	}
	wreadRunOnMain(^{
		if (!g_readMode || g_window == NULL) {
			return;
		}
		NSWindow *window = (__bridge NSWindow *)g_window;
		if (dragging) {
			wreadApplyPassThrough(window, NO, NO);
			return;
		}
		wreadUpdateIgnoresFromMouse();
	});
}

void wreadSetPassThrough(void *nsWindow, bool enable) {
	if (nsWindow == NULL) {
		return;
	}
	wreadRunOnMain(^{
		g_window = nsWindow;
		g_readMode = enable;
		NSWindow *window = (__bridge NSWindow *)nsWindow;
		if (!enable) {
			wreadRemoveMouseMonitor();
			g_mouseDragging = NO;
			g_window = NULL;
			wreadApplyPassThrough(window, NO, NO);
			return;
		}
		wreadInstallMouseMonitor();
		wreadUpdateIgnoresFromMouse();
		wreadLog("read mode band-only wn=%ld ax=%d", (long)[window windowNumber],
		         AXIsProcessTrusted() ? 1 : 0);
	});
}
*/
import "C"
import "unsafe"

func setNativePassThrough(nativeWindow unsafe.Pointer, enable bool) {
	C.wreadSetPassThrough(nativeWindow, C.bool(enable))
}

func setNativePassThroughLayout(scopeW, noteSz, catalogW int, place string) {
	cPlace := C.CString(place)
	defer C.free(unsafe.Pointer(cPlace))
	C.wreadSetPassThroughLayout(C.double(scopeW), C.double(noteSz), C.double(catalogW), cPlace)
}

func setNativeFrameDragging(dragging bool) {
	C.wreadSetFrameDragging(C.bool(dragging))
}

func turnPageNative(nativeWindow unsafe.Pointer) bool {
	return bool(C.wreadPostTurnPage(nativeWindow))
}
