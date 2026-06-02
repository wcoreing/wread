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
extern void wreadReaderRailActivated(void);
extern void wreadNoteRailNotebookActivated(void);
extern void wreadNoteRailCatalogActivated(void);

static void wreadLog(const char *fmt, ...) {
	char buf[768];
	va_list ap;
	va_start(ap, fmt);
	vsnprintf(buf, sizeof(buf), fmt, ap);
	va_end(ap);
	wreadPassLog(buf);
}

static const CGFloat kWreadToolbarHeight = 36.0;
static const CGFloat kWreadEdgeInset = 14.0;
// 与 Web .edge-rail-btn 对齐：宽 48 + 余量，高约 72 + 余量。
static const CGFloat kWreadReaderRailW = 56.0;
static const CGFloat kWreadReaderRailH = 92.0;
static const CGFloat kWreadReaderRailPad = 10.0;
static const CGFloat kWreadNoteRailW = 56.0;
static const CGFloat kWreadNoteRailBtnH = 82.0;
static const CGFloat kWreadNoteRailGap = 10.0;
static bool g_readMode = false;
static bool g_mouseDragging = false;
static void *g_window = NULL;
static CFAbsoluteTime g_lastForwardClick = 0;
static id g_mouseMonitor = NULL;
static id g_localMouseMonitor = NULL;
static CGFloat g_scopeWidth = 640.0;
static CGFloat g_noteSize = 0.0;
static char g_place[16] = "right";

static BOOL wreadPlaceIs(const char *name) {
	return strncmp(g_place, name, 15) == 0;
}

static void wreadApplyPassThrough(NSWindow *window, BOOL ignore, BOOL forward) {
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

static NSRect wreadNotePaneRect(NSWindow *window) {
	if (g_noteSize <= 0.0) {
		return NSMakeRect(0, 0, 0, 0);
	}
	NSRect frame = wreadWindowFrame(window);
	if (wreadPlaceIs("left")) {
		return NSMakeRect(frame.origin.x, frame.origin.y, g_noteSize, frame.size.height);
	}
	if (wreadPlaceIs("top")) {
		return NSMakeRect(frame.origin.x,
		                  frame.origin.y + frame.size.height - g_noteSize,
		                  frame.size.width,
		                  g_noteSize);
	}
	if (wreadPlaceIs("bottom")) {
		return NSMakeRect(frame.origin.x, frame.origin.y, frame.size.width, g_noteSize);
	}
	if (wreadPlaceIs("center")) {
		CGFloat h = frame.size.height * 0.72;
		CGFloat y = frame.origin.y + (frame.size.height - h) * 0.5;
		return NSMakeRect(frame.origin.x + g_scopeWidth, y, g_noteSize, h);
	}
	return NSMakeRect(frame.origin.x + g_scopeWidth,
	                frame.origin.y,
	                g_noteSize,
	                frame.size.height);
}

static NSRect wreadScopeToolbarRect(NSWindow *window) {
	NSRect frame = wreadWindowFrame(window);
	if (wreadPlaceIs("top")) {
		return NSMakeRect(frame.origin.x,
		                  frame.origin.y + frame.size.height - g_noteSize - kWreadToolbarHeight,
		                  frame.size.width,
		                  kWreadToolbarHeight);
	}
	if (wreadPlaceIs("bottom")) {
		return NSMakeRect(frame.origin.x,
		                  frame.origin.y + g_noteSize,
		                  frame.size.width,
		                  kWreadToolbarHeight);
	}
	CGFloat x = frame.origin.x;
	CGFloat w = frame.size.width;
	if (wreadPlaceIs("left")) {
		x += g_noteSize;
		w = g_scopeWidth;
	} else if (g_noteSize > 0.0) {
		w = g_scopeWidth;
	}
	return NSMakeRect(x,
	                  frame.origin.y + frame.size.height - kWreadToolbarHeight,
	                  w,
	                  kWreadToolbarHeight);
}

static NSRect wreadScopeFrameRect(NSWindow *window) {
	NSRect frame = wreadWindowFrame(window);
	if (wreadPlaceIs("top")) {
		return NSMakeRect(frame.origin.x,
		                  frame.origin.y,
		                  frame.size.width,
		                  frame.size.height - g_noteSize - kWreadToolbarHeight);
	}
	if (wreadPlaceIs("bottom")) {
		return NSMakeRect(frame.origin.x,
		                  frame.origin.y + g_noteSize + kWreadToolbarHeight,
		                  frame.size.width,
		                  frame.size.height - g_noteSize - kWreadToolbarHeight);
	}
	CGFloat x = frame.origin.x;
	CGFloat w = frame.size.width;
	if (wreadPlaceIs("left")) {
		x += g_noteSize;
		w = g_scopeWidth;
	} else if (g_noteSize > 0.0) {
		w = g_scopeWidth;
	}
	return NSMakeRect(x,
	                  frame.origin.y,
	                  w,
	                  frame.size.height - kWreadToolbarHeight);
}

static BOOL wreadPointInRect(NSPoint p, NSRect r) {
	return r.size.width > 0 && r.size.height > 0 && NSPointInRect(p, r);
}

// wreadSplitterRect 开卷与笔记之间的分割条热区（仅调整内部分配，非窗口缩放）。
static NSRect wreadSplitterRect(NSWindow *window) {
	if (g_noteSize <= 0.0) {
		return NSMakeRect(0, 0, 0, 0);
	}
	NSRect frame = wreadWindowFrame(window);
	const CGFloat hit = 7.0;
	const CGFloat pad = 3.0;
	if (wreadPlaceIs("left")) {
		return NSMakeRect(frame.origin.x + g_noteSize - pad, frame.origin.y, hit, frame.size.height);
	}
	if (wreadPlaceIs("top")) {
		return NSMakeRect(frame.origin.x,
		                  frame.origin.y + frame.size.height - g_noteSize - pad,
		                  frame.size.width,
		                  hit);
	}
	if (wreadPlaceIs("bottom")) {
		return NSMakeRect(frame.origin.x, frame.origin.y + g_noteSize - pad, frame.size.width, hit);
	}
	return NSMakeRect(frame.origin.x + g_scopeWidth - pad, frame.origin.y, hit, frame.size.height);
}

// wreadIsSplitterDragPoint 是否点在分割条拖宽热区。
static BOOL wreadIsSplitterDragPoint(NSWindow *window, NSPoint mouse) {
	return wreadPointInRect(mouse, wreadSplitterRect(window));
}

// wreadReaderRailRect 阅读器内缘「解读」竖条（屏幕坐标），须与 PaneEdgeRail 布局一致。
static NSRect wreadReaderRailRect(NSWindow *window) {
	if (g_noteSize <= 0.0) {
		return NSMakeRect(0, 0, 0, 0);
	}
	NSRect scope = wreadScopeFrameRect(window);
	if (scope.size.width <= 0.0 || scope.size.height <= 0.0) {
		return NSMakeRect(0, 0, 0, 0);
	}
	CGFloat railW = kWreadReaderRailW;
	CGFloat railH = kWreadReaderRailH;
	if (railH > scope.size.height) {
		railH = scope.size.height;
	}
	CGFloat y = scope.origin.y + (scope.size.height - railH) * 0.5;
	if (wreadPlaceIs("top")) {
		CGFloat x = scope.origin.x + (scope.size.width - railW) * 0.5;
		CGFloat bottomY = scope.origin.y + scope.size.height - railH;
		NSRect rail = NSMakeRect(x, bottomY, railW, railH);
		return NSInsetRect(rail, -kWreadReaderRailPad, -kWreadReaderRailPad);
	}
	if (wreadPlaceIs("bottom")) {
		CGFloat x = scope.origin.x + (scope.size.width - railW) * 0.5;
		NSRect rail = NSMakeRect(x, scope.origin.y, railW, railH);
		return NSInsetRect(rail, -kWreadReaderRailPad, -kWreadReaderRailPad);
	}
	if (wreadPlaceIs("left")) {
		NSRect rail = NSMakeRect(scope.origin.x, y, railW, railH);
		return NSInsetRect(rail, -kWreadReaderRailPad, -kWreadReaderRailPad);
	}
	CGFloat rightX = scope.origin.x + scope.size.width - railW;
	NSRect rail = NSMakeRect(rightX, y, railW, railH);
	return NSInsetRect(rail, -kWreadReaderRailPad, -kWreadReaderRailPad);
}

// wreadIsReaderRailPoint 是否点在解读内缘条上（不穿透、不补发 Chrome）。
static BOOL wreadIsReaderRailPoint(NSWindow *window, NSPoint mouse) {
	return wreadPointInRect(mouse, wreadReaderRailRect(window));
}

// wreadNoteRailStackRect 笔记内缘竖条组（笔记本 + 目录，屏幕坐标）。
static NSRect wreadNoteRailStackRect(NSWindow *window) {
	if (g_noteSize <= 0.0) {
		return NSMakeRect(0, 0, 0, 0);
	}
	NSRect note = wreadNotePaneRect(window);
	if (note.size.width <= 0.0 || note.size.height <= 0.0) {
		return NSMakeRect(0, 0, 0, 0);
	}
	CGFloat stackH = kWreadNoteRailBtnH * 2.0 + kWreadNoteRailGap;
	CGFloat railW = kWreadNoteRailW;
	CGFloat y = note.origin.y + (note.size.height - stackH) * 0.5;
	CGFloat x = note.origin.x;
	if (wreadPlaceIs("left")) {
		x = note.origin.x + note.size.width - railW;
	}
	if (wreadPlaceIs("top")) {
		x = note.origin.x + (note.size.width - stackH) * 0.5;
		y = note.origin.y;
		return NSInsetRect(NSMakeRect(x, y, stackH, railW), -kWreadReaderRailPad, -kWreadReaderRailPad);
	}
	if (wreadPlaceIs("bottom")) {
		x = note.origin.x + (note.size.width - stackH) * 0.5;
		y = note.origin.y + note.size.height - railW;
		return NSInsetRect(NSMakeRect(x, y, stackH, railW), -kWreadReaderRailPad, -kWreadReaderRailPad);
	}
	NSRect stack = NSMakeRect(x, y, railW, stackH);
	return NSInsetRect(stack, -kWreadReaderRailPad, -kWreadReaderRailPad);
}

// wreadNoteRailHit 0=无，1=笔记本，2=目录。
static int wreadNoteRailHit(NSWindow *window, NSPoint mouse) {
	NSRect stack = wreadNoteRailStackRect(window);
	if (!wreadPointInRect(mouse, stack)) {
		return 0;
	}
	if (wreadPlaceIs("top") || wreadPlaceIs("bottom")) {
		CGFloat mid = stack.origin.x + kWreadNoteRailBtnH + kWreadNoteRailGap * 0.5;
		return mouse.x >= mid ? 1 : 2;
	}
	CGFloat mid = stack.origin.y + kWreadNoteRailBtnH + kWreadNoteRailGap * 0.5;
	return mouse.y >= mid ? 1 : 2;
}

// wreadIsNoteRailPoint 是否点在笔记内缘条上。
static BOOL wreadIsNoteRailPoint(NSWindow *window, NSPoint mouse) {
	return wreadNoteRailHit(window, mouse) != 0;
}

// wreadIsChromeUIPoint 笔记区 / 顶栏 / 分割条 / 内缘竖条（不穿透、不转发 Chrome）。
static BOOL wreadIsChromeUIPoint(NSWindow *window, NSPoint mouse) {
	if (window == NULL) {
		return NO;
	}
	if (wreadPointInRect(mouse, wreadNotePaneRect(window))) {
		return YES;
	}
	if (wreadPointInRect(mouse, wreadScopeToolbarRect(window))) {
		return YES;
	}
	if (wreadIsSplitterDragPoint(window, mouse) || wreadIsReaderRailPoint(window, mouse) ||
	    wreadIsNoteRailPoint(window, mouse)) {
		return YES;
	}
	return NO;
}

// wreadFocusWindow 确保开卷窗为 key，便于 Web 或原生竖条响应。
static void wreadFocusWindow(NSWindow *window) {
	if (window != NULL && ![window isKeyWindow]) {
		[window makeKeyAndOrderFront:nil];
	}
}

// wreadPrepareInteractiveMouseDown 内缘竖条点击：聚焦并走 Go 回调，吞掉 Web 事件。
static BOOL wreadPrepareInteractiveMouseDown(NSWindow *window, NSPoint mouse) {
	if (window == NULL) {
		return NO;
	}
	wreadApplyPassThrough(window, NO, NO);
	int noteHit = wreadNoteRailHit(window, mouse);
	if (noteHit == 1) {
		wreadFocusWindow(window);
		wreadLog("note rail notebook cocoa=(%.1f,%.1f)", mouse.x, mouse.y);
		wreadNoteRailNotebookActivated();
		return YES;
	}
	if (noteHit == 2) {
		wreadFocusWindow(window);
		wreadLog("note rail catalog cocoa=(%.1f,%.1f)", mouse.x, mouse.y);
		wreadNoteRailCatalogActivated();
		return YES;
	}
	if (!wreadIsReaderRailPoint(window, mouse)) {
		wreadFocusWindow(window);
		return NO;
	}
	wreadFocusWindow(window);
	wreadLog("reader rail click cocoa=(%.1f,%.1f)", mouse.x, mouse.y);
	wreadReaderRailActivated();
	return YES;
}

static void wreadUpdatePartialPassThrough(void);

// wreadPassthroughRect 阅读区中间可穿透带（屏幕坐标）；靠翻页侧多内缩，避开解读竖条。
static NSRect wreadPassthroughRect(NSWindow *window) {
	NSRect scopeFrame = wreadScopeFrameRect(window);
	if (scopeFrame.size.width <= 0 || scopeFrame.size.height <= 0) {
		return NSMakeRect(0, 0, 0, 0);
	}
	CGFloat top = kWreadEdgeInset;
	CGFloat bottom = kWreadEdgeInset;
	CGFloat left = kWreadEdgeInset;
	CGFloat right = kWreadEdgeInset;
	CGFloat railSide = kWreadReaderRailW + kWreadReaderRailPad + 4.0;
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

// wreadIsInPassthroughZone 鼠标是否在阅读穿透带内。
static BOOL wreadIsInPassthroughZone(NSWindow *window, NSPoint mouse) {
	if (!g_readMode || window == NULL) {
		return NO;
	}
	if (wreadIsChromeUIPoint(window, mouse)) {
		return NO;
	}
	NSRect passthrough = wreadPassthroughRect(window);
	return wreadPointInRect(mouse, passthrough);
}

// wreadCocoaToQuartz 将 NSEvent 屏幕坐标转为 CGEvent / CGWindow 使用的坐标。
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

// wreadPIDForWindowNumber 由窗口号取所属进程 PID。
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

// wreadWindowIgnoresMouse 当前窗口是否处于穿透忽略鼠标状态。
static BOOL wreadWindowIgnoresMouse(NSWindow *window) {
	if (window == NULL) {
		return NO;
	}
	return [window ignoresMouseEvents];
}

// wreadTryPassthroughForward 阅读穿透带内点击：激活下层并补发左键（source 仅用于日志）。
static BOOL wreadTryPassthroughForward(NSWindow *wreadWindow, NSPoint mouse, NSEvent *event,
                                     const char *source) {
	if (wreadWindow == NULL || event == NULL || source == NULL) {
		wreadLog("%s skip: null window/event", source ? source : "?");
		return NO;
	}
	if (!g_readMode) {
		wreadLog("%s skip: not read mode", source);
		return NO;
	}
	if (wreadIsChromeUIPoint(wreadWindow, mouse)) {
		wreadLog("%s skip: chrome ui", source);
		return NO;
	}
	CFAbsoluteTime now = CFAbsoluteTimeGetCurrent();
	if (now - g_lastForwardClick < 0.2) {
		wreadLog("%s skip: debounce %.0fms", source, (now - g_lastForwardClick) * 1000.0);
		return NO;
	}

	BOOL isKey = [wreadWindow isKeyWindow];
	BOOL inZone = wreadIsInPassthroughZone(wreadWindow, mouse);
	BOOL ignores = wreadWindowIgnoresMouse(wreadWindow);
	NSInteger wn = [wreadWindow windowNumber];

	if (!inZone) {
		wreadLog("%s skip: outside passthrough zone", source);
		return NO;
	}
	if (!isKey) {
		wreadLog("%s forward while not key ignores=%d", source, ignores);
	} else if (ignores) {
		wreadLog("%s forward while key+ignores", source);
	} else {
		wreadLog("%s forward while key", source);
	}

	NSInteger belowWN =
	    [NSWindow windowNumberAtPoint:mouse belowWindowWithWindowNumber:wn];
	if (belowWN <= 0) {
		wreadLog("%s fail: no window below wn=%ld at (%.1f,%.1f)", source, (long)wn, mouse.x,
		         mouse.y);
		return NO;
	}
	pid_t pid = 0;
	if (!wreadPIDForWindowNumber((CGWindowID)belowWN, &pid)) {
		wreadLog("%s fail: pid lookup belowWN=%ld", source, (long)belowWN);
		return NO;
	}
	pid_t selfPID = [[NSProcessInfo processInfo] processIdentifier];
	if (pid == selfPID) {
		wreadLog("%s fail: below window is self pid=%d belowWN=%ld", source, (int)pid,
		         (long)belowWN);
		return NO;
	}

	NSRunningApplication *app = [NSRunningApplication runningApplicationWithProcessIdentifier:pid];
	if (app == nil) {
		wreadLog("%s fail: no NSRunningApplication pid=%d", source, (int)pid);
		return NO;
	}

	NSString *appName = [app localizedName] ?: @"?";
	wreadLog("%s activate pid=%d app=%s belowWN=%ld", source, (int)pid, [appName UTF8String],
	         (long)belowWN);
	[app activateWithOptions:NSApplicationActivateAllWindows];
	if (isKey) {
		[wreadWindow resignKeyWindow];
	}

	CGPoint quartz = wreadCocoaToQuartz(mouse);
	CGEventRef down = CGEventCreateMouseEvent(NULL, kCGEventLeftMouseDown, quartz, kCGMouseButtonLeft);
	if (down == NULL) {
		wreadLog("%s fail: CGEventCreateMouseEvent down null quartz=(%.1f,%.1f)", source,
		         quartz.x, quartz.y);
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
	wreadLog("%s ok: posted click quartz=(%.1f,%.1f) flags=0x%llx", source, quartz.x, quartz.y,
	         (unsigned long long)flags);
	return YES;
}

static void wreadRunOnMain(void (^block)(void)) {
	if ([NSThread isMainThread]) {
		block();
		return;
	}
	dispatch_async(dispatch_get_main_queue(), block);
}

static void wreadUpdatePartialPassThrough(void) {
	if (!g_readMode || g_window == NULL) {
		return;
	}
	NSWindow *window = (__bridge NSWindow *)g_window;
	if (![window isVisible]) {
		return;
	}

	if (g_mouseDragging) {
		wreadApplyPassThrough(window, NO, NO);
		return;
	}

	NSPoint mouse = [NSEvent mouseLocation];
	NSRect scopeFrame = wreadScopeFrameRect(window);

	if (wreadIsChromeUIPoint(window, mouse)) {
		wreadApplyPassThrough(window, NO, NO);
		return;
	}
	if (wreadPointInRect(mouse, scopeFrame)) {
		NSRect passthrough = wreadPassthroughRect(window);
		if (passthrough.size.width > 0 && passthrough.size.height > 0 &&
		    wreadPointInRect(mouse, passthrough)) {
			wreadApplyPassThrough(window, YES, YES);
		} else {
			wreadApplyPassThrough(window, NO, NO);
		}
		return;
	}

	wreadApplyPassThrough(window, YES, YES);
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
	NSEventMask mask = NSEventMaskMouseMoved | NSEventMaskLeftMouseDown | NSEventMaskLeftMouseUp |
	                   NSEventMaskRightMouseDown | NSEventMaskLeftMouseDragged | NSEventMaskScrollWheel;
	g_mouseMonitor = [NSEvent addGlobalMonitorForEventsMatchingMask:mask
	                                                         handler:^(NSEvent *event) {
		wreadRunOnMain(^{
			wreadTrackMouseButton(event);
			wreadUpdatePartialPassThrough();
			// ignores=YES 时点击不会进 local monitor，须在 global 补发 Chrome。
			if (g_readMode && g_window != NULL && [event type] == NSEventTypeLeftMouseDown) {
				NSWindow *window = (__bridge NSWindow *)g_window;
				NSPoint mouse = [NSEvent mouseLocation];
				(void)wreadTryPassthroughForward(window, mouse, event, "global");
			}
		});
	}];
	g_localMouseMonitor = [NSEvent addLocalMonitorForEventsMatchingMask:mask
	                                                            handler:^NSEvent *(NSEvent *event) {
		if (g_readMode && g_window != NULL && [event type] == NSEventTypeLeftMouseDown) {
			NSWindow *window = (__bridge NSWindow *)g_window;
			NSPoint mouse = [NSEvent mouseLocation];
			if (wreadPrepareInteractiveMouseDown(window, mouse)) {
				wreadTrackMouseButton(event);
				wreadUpdatePartialPassThrough();
				return nil;
			}
		}
		wreadTrackMouseButton(event);
		wreadUpdatePartialPassThrough();
		if (g_readMode && g_window != NULL && [event type] == NSEventTypeLeftMouseDown) {
			NSWindow *window = (__bridge NSWindow *)g_window;
			NSPoint mouse = [NSEvent mouseLocation];
			if (wreadTryPassthroughForward(window, mouse, event, "local")) {
				return nil;
			}
		}
		return event;
	}];
	if (g_mouseMonitor == NULL) {
		wreadLog("global mouse monitor NULL — 需在 系统设置→隐私与安全性→辅助功能 中允许 wread");
	} else {
		wreadLog("mouse monitors installed global=%p local=%p", g_mouseMonitor, g_localMouseMonitor);
	}
}

void wreadSetPassThroughLayout(CGFloat scopeWidth, CGFloat noteSize, const char *place) {
	g_scopeWidth = scopeWidth;
	g_noteSize = noteSize;
	if (place != NULL) {
		strncpy(g_place, place, sizeof(g_place) - 1);
		g_place[sizeof(g_place) - 1] = '\0';
	}
	wreadRunOnMain(^{
		wreadUpdatePartialPassThrough();
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
		wreadUpdatePartialPassThrough();
		wreadLog("read mode on wn=%ld ax=%d", (long)[window windowNumber],
		         AXIsProcessTrusted() ? 1 : 0);
	});
}
*/
import "C"
import "unsafe"

func setNativePassThrough(nativeWindow unsafe.Pointer, enable bool) {
	C.wreadSetPassThrough(nativeWindow, C.bool(enable))
}

func setNativePassThroughLayout(scopeW, noteSz int, place string) {
	cPlace := C.CString(place)
	defer C.free(unsafe.Pointer(cPlace))
	C.wreadSetPassThroughLayout(C.double(scopeW), C.double(noteSz), cPlace)
}
