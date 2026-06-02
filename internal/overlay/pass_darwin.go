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
static CGFloat g_splitterHit = 7.0;
static CGFloat g_splitterPad = 3.0;
static CGFloat g_readerRailW = 38.0;
static CGFloat g_readerRailH = 92.0;
static CGFloat g_readerRailPad = 8.0;
static CGFloat g_noteRailW = 38.0;
static CGFloat g_noteRailBtnH = 82.0;
static CGFloat g_noteRailGap = 10.0;
static CGFloat g_railSideExtra = 4.0;

static bool g_readMode = false;
static bool g_mouseDragging = false;
static void *g_window = NULL;
static CFAbsoluteTime g_lastForwardClick = 0;
static id g_mouseMonitor = NULL;
static id g_localMouseMonitor = NULL;
static CGFloat g_scopeWidth = 640.0;
static CGFloat g_noteSize = 0.0;
static char g_place[16] = "right";

void wreadSetPassMetrics(double toolbarH, double edgeInset, double splitterHit, double splitterPad,
                        double readerRailW, double readerRailH, double readerRailPad,
                        double noteRailW, double noteRailBtnH, double noteRailGap,
                        double railSideExtra) {
	g_toolbarH = toolbarH;
	g_edgeInset = edgeInset;
	g_splitterHit = splitterHit;
	g_splitterPad = splitterPad;
	g_readerRailW = readerRailW;
	g_readerRailH = readerRailH;
	g_readerRailPad = readerRailPad;
	g_noteRailW = noteRailW;
	g_noteRailBtnH = noteRailBtnH;
	g_noteRailGap = noteRailGap;
	g_railSideExtra = railSideExtra;
}

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
		                  frame.origin.y + frame.size.height - g_noteSize - g_toolbarH,
		                  frame.size.width,
		                  g_toolbarH);
	}
	if (wreadPlaceIs("bottom")) {
		return NSMakeRect(frame.origin.x,
		                  frame.origin.y + g_noteSize,
		                  frame.size.width,
		                  g_toolbarH);
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
	                  frame.origin.y + frame.size.height - g_toolbarH,
	                  w,
	                  g_toolbarH);
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
	} else if (g_noteSize > 0.0) {
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

static NSRect wreadSplitterRect(NSWindow *window) {
	if (g_noteSize <= 0.0) {
		return NSMakeRect(0, 0, 0, 0);
	}
	NSRect frame = wreadWindowFrame(window);
	if (wreadPlaceIs("left")) {
		return NSMakeRect(frame.origin.x + g_noteSize - g_splitterPad, frame.origin.y, g_splitterHit,
		                  frame.size.height);
	}
	if (wreadPlaceIs("top")) {
		return NSMakeRect(frame.origin.x,
		                  frame.origin.y + frame.size.height - g_noteSize - g_splitterPad,
		                  frame.size.width,
		                  g_splitterHit);
	}
	if (wreadPlaceIs("bottom")) {
		return NSMakeRect(frame.origin.x, frame.origin.y + g_noteSize - g_splitterPad,
		                  frame.size.width, g_splitterHit);
	}
	return NSMakeRect(frame.origin.x + g_scopeWidth - g_splitterPad, frame.origin.y, g_splitterHit,
	                  frame.size.height);
}

static NSRect wreadReaderRailRect(NSWindow *window) {
	if (g_noteSize <= 0.0) {
		return NSMakeRect(0, 0, 0, 0);
	}
	NSRect scope = wreadScopeFrameRect(window);
	if (scope.size.width <= 0.0 || scope.size.height <= 0.0) {
		return NSMakeRect(0, 0, 0, 0);
	}
	CGFloat railW = g_readerRailW;
	CGFloat railH = g_readerRailH;
	if (railH > scope.size.height) {
		railH = scope.size.height;
	}
	CGFloat y = scope.origin.y + (scope.size.height - railH) * 0.5;
	if (wreadPlaceIs("top")) {
		CGFloat x = scope.origin.x + (scope.size.width - railW) * 0.5;
		CGFloat bottomY = scope.origin.y + scope.size.height - railH;
		return NSInsetRect(NSMakeRect(x, bottomY, railW, railH), -g_readerRailPad, -g_readerRailPad);
	}
	if (wreadPlaceIs("bottom")) {
		CGFloat x = scope.origin.x + (scope.size.width - railW) * 0.5;
		return NSInsetRect(NSMakeRect(x, scope.origin.y, railW, railH), -g_readerRailPad,
		                  -g_readerRailPad);
	}
	if (wreadPlaceIs("left")) {
		return NSInsetRect(NSMakeRect(scope.origin.x, y, railW, railH), -g_readerRailPad,
		                  -g_readerRailPad);
	}
	CGFloat rightX = scope.origin.x + scope.size.width - railW;
	return NSInsetRect(NSMakeRect(rightX, y, railW, railH), -g_readerRailPad, -g_readerRailPad);
}

static NSRect wreadNoteRailStackRect(NSWindow *window) {
	if (g_noteSize <= 0.0) {
		return NSMakeRect(0, 0, 0, 0);
	}
	NSRect note = wreadNotePaneRect(window);
	if (note.size.width <= 0.0 || note.size.height <= 0.0) {
		return NSMakeRect(0, 0, 0, 0);
	}
	CGFloat stackH = g_noteRailBtnH * 2.0 + g_noteRailGap;
	CGFloat railW = g_noteRailW;
	CGFloat y = note.origin.y + (note.size.height - stackH) * 0.5;
	CGFloat x = note.origin.x;
	if (wreadPlaceIs("left")) {
		x = note.origin.x + note.size.width - railW;
	}
	if (wreadPlaceIs("top")) {
		x = note.origin.x + (note.size.width - stackH) * 0.5;
		y = note.origin.y;
		return NSInsetRect(NSMakeRect(x, y, stackH, railW), -g_readerRailPad, -g_readerRailPad);
	}
	if (wreadPlaceIs("bottom")) {
		x = note.origin.x + (note.size.width - stackH) * 0.5;
		y = note.origin.y + note.size.height - railW;
		return NSInsetRect(NSMakeRect(x, y, stackH, railW), -g_readerRailPad, -g_readerRailPad);
	}
	return NSInsetRect(NSMakeRect(x, y, railW, stackH), -g_readerRailPad, -g_readerRailPad);
}

// wreadIsChromeUIPoint 笔记/顶栏/分割条/内缘竖条（不穿透、不 Post）；竖条由 Web onClick 处理。
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
	if (wreadPointInRect(mouse, wreadSplitterRect(window))) {
		return YES;
	}
	if (wreadPointInRect(mouse, wreadReaderRailRect(window))) {
		return YES;
	}
	if (wreadPointInRect(mouse, wreadNoteRailStackRect(window))) {
		return YES;
	}
	return NO;
}

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

static BOOL wreadIgnoresAtScreenPoint(NSWindow *window, NSPoint mouse) {
	if (!g_readMode || window == NULL || g_mouseDragging) {
		return NO;
	}
	if (wreadIsChromeUIPoint(window, mouse)) {
		return NO;
	}
	NSRect scopeFrame = wreadScopeFrameRect(window);
	if (wreadPointInRect(mouse, scopeFrame)) {
		NSRect passthrough = wreadPassthroughRect(window);
		return passthrough.size.width > 0 && passthrough.size.height > 0 &&
		       wreadPointInRect(mouse, passthrough);
	}
	return YES;
}

static BOOL wreadInPassthroughBand(NSWindow *window, NSPoint mouse) {
	if (!g_readMode || window == NULL || wreadIsChromeUIPoint(window, mouse)) {
		return NO;
	}
	return wreadPointInRect(mouse, wreadPassthroughRect(window));
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
	pid_t selfPID = [[NSProcessInfo processInfo] processIdentifier];
	NSRunningApplication *selfApp =
	    [NSRunningApplication runningApplicationWithProcessIdentifier:selfPID];
	if (selfApp != nil) {
		[selfApp activateWithOptions:NSApplicationActivateIgnoringOtherApps];
	}
	[wreadWindow makeKeyAndOrderFront:nil];
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
	if (!g_readMode || !wreadInPassthroughBand(wreadWindow, mouse)) {
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
	wreadLog("%s ok post+refocus quartz=(%.1f,%.1f)", source, quartz.x, quartz.y);
	wreadScheduleRefocusWread(wreadWindow);
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
	if (!g_readMode || g_window == NULL) {
		return;
	}
	NSWindow *window = (__bridge NSWindow *)g_window;
	if (![window isVisible]) {
		return;
	}
	BOOL ignore = wreadIgnoresAtScreenPoint(window, [NSEvent mouseLocation]);
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
	NSEventMask mask = NSEventMaskMouseMoved | NSEventMaskLeftMouseDown | NSEventMaskLeftMouseUp |
	                   NSEventMaskLeftMouseDragged | NSEventMaskScrollWheel;
	g_mouseMonitor = [NSEvent addGlobalMonitorForEventsMatchingMask:mask
	                                                         handler:^(NSEvent *event) {
		wreadRunOnMain(^{
			wreadTrackMouseButton(event);
			wreadUpdateIgnoresFromMouse();
			if (g_readMode && g_window != NULL && [event type] == NSEventTypeLeftMouseDown) {
				NSWindow *window = (__bridge NSWindow *)g_window;
				NSPoint mouse = [NSEvent mouseLocation];
				BOOL posted = wreadTryPassthroughForward(window, mouse, event, "global");
				if (!posted && wreadIgnoresAtScreenPoint(window, mouse)) {
					wreadScheduleRefocusWread(window);
				}
			}
		});
	}];
	g_localMouseMonitor = [NSEvent addLocalMonitorForEventsMatchingMask:mask
	                                                            handler:^NSEvent *(NSEvent *event) {
		wreadTrackMouseButton(event);
		wreadUpdateIgnoresFromMouse();
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
		wreadLog("global monitor NULL — 需在 辅助功能 中允许 wread");
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
