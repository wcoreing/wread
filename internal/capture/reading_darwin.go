//go:build darwin

package capture

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework CoreGraphics -framework AppKit -framework ImageIO -framework ScreenCaptureKit
#import <AppKit/AppKit.h>
#import <CoreGraphics/CoreGraphics.h>
#import <ImageIO/ImageIO.h>
#import <ScreenCaptureKit/ScreenCaptureKit.h>

static CGWindowID wreadWindowID(void *win) {
    if (win == NULL) {
        return 0;
    }
    NSWindow *w = (__bridge NSWindow *)win;
    CGWindowID id = (CGWindowID)[w windowNumber];
    return id > 0 ? id : 0;
}

static CGRect wreadDisplayBoundsTopLeft(CGDirectDisplayID displayID) {
    CGRect b = CGDisplayBounds(displayID);
    CGRect main = CGDisplayBounds(CGMainDisplayID());
    return CGRectMake(b.origin.x, main.size.height - (b.origin.y + b.size.height), b.size.width, b.size.height);
}

static int wreadEncodePNG(CGImageRef image, unsigned char **outData, size_t *outLen) {
    CFMutableDataRef data = CFDataCreateMutable(kCFAllocatorDefault, 0);
    if (data == NULL) {
        return 0;
    }
    CGImageDestinationRef dest = CGImageDestinationCreateWithData(data, CFSTR("public.png"), 1, NULL);
    if (dest == NULL) {
        CFRelease(data);
        return 0;
    }
    CGImageDestinationAddImage(dest, image, NULL);
    bool ok = CGImageDestinationFinalize(dest);
    CFRelease(dest);
    if (!ok) {
        CFRelease(data);
        return 0;
    }
    CFIndex len = CFDataGetLength(data);
    unsigned char *buf = (unsigned char *)malloc((size_t)len);
    if (buf == NULL) {
        CFRelease(data);
        return 0;
    }
    CFDataGetBytes(data, CFRangeMake(0, len), buf);
    CFRelease(data);
    *outData = buf;
    *outLen = (size_t)len;
    return 1;
}

static BOOL wreadShouldExclude(CGWindowID wid, CGWindowID *ids, int count) {
    for (int i = 0; i < count; i++) {
        if (wid == ids[i]) {
            return YES;
        }
    }
    return NO;
}

static int wreadCaptureExcludingWindows(int x, int y, int w, int h,
                                        void **excludeWins, int excludeCount,
                                        unsigned char **outData, size_t *outLen) {
    if (outData == NULL || outLen == NULL || w <= 0 || h <= 0) {
        return 0;
    }
    *outData = NULL;
    *outLen = 0;

    CGWindowID stackIDs[8];
    int excludeN = 0;
    for (int i = 0; i < excludeCount && i < 8; i++) {
        CGWindowID id = wreadWindowID(excludeWins[i]);
        if (id != 0) {
            stackIDs[excludeN++] = id;
        }
    }
    CGWindowID *excludeIDs = (CGWindowID *)malloc((size_t)excludeN * sizeof(CGWindowID));
    if (excludeN > 0 && excludeIDs == NULL) {
        return 0;
    }
    for (int i = 0; i < excludeN; i++) {
        excludeIDs[i] = stackIDs[i];
    }

    dispatch_semaphore_t sem = dispatch_semaphore_create(0);
    __block int ok = 0;

    [SCShareableContent getShareableContentWithCompletionHandler:^(SCShareableContent *content, NSError *error) {
        @autoreleasepool {
            if (error != nil || content == nil) {
                dispatch_semaphore_signal(sem);
                return;
            }

            SCDisplay *target = nil;
            CGRect targetBounds = CGRectZero;
            for (SCDisplay *display in content.displays) {
                CGRect b = wreadDisplayBoundsTopLeft(display.displayID);
                if (x >= (int)b.origin.x && y >= (int)b.origin.y &&
                    x + w <= (int)(b.origin.x + b.size.width) &&
                    y + h <= (int)(b.origin.y + b.size.height)) {
                    target = display;
                    targetBounds = b;
                    break;
                }
            }
            if (target == nil) {
                for (SCDisplay *display in content.displays) {
                    if (display.displayID == CGMainDisplayID()) {
                        target = display;
                        targetBounds = wreadDisplayBoundsTopLeft(display.displayID);
                        break;
                    }
                }
            }
            if (target == nil) {
                dispatch_semaphore_signal(sem);
                return;
            }

            NSMutableArray<SCWindow *> *exclude = [NSMutableArray array];
            for (SCWindow *sw in content.windows) {
                if (wreadShouldExclude(sw.windowID, excludeIDs, excludeN)) {
                    [exclude addObject:sw];
                }
            }

            SCContentFilter *filter = [[SCContentFilter alloc] initWithDisplay:target excludingWindows:exclude];
            SCStreamConfiguration *config = [[SCStreamConfiguration alloc] init];
            config.sourceRect = CGRectMake((CGFloat)(x - (int)targetBounds.origin.x),
                                           (CGFloat)(y - (int)targetBounds.origin.y),
                                           (CGFloat)w, (CGFloat)h);
            config.width = w;
            config.height = h;
            config.showsCursor = NO;

            [SCScreenshotManager captureImageWithFilter:filter
                                          configuration:config
                                      completionHandler:^(CGImageRef image, NSError *capErr) {
                @autoreleasepool {
                    if (capErr == nil && image != NULL) {
                        ok = wreadEncodePNG(image, outData, outLen);
                    }
                    dispatch_semaphore_signal(sem);
                }
            }];
        }
    }];

    dispatch_semaphore_wait(sem, DISPATCH_TIME_FOREVER);
    dispatch_release(sem);
    free(excludeIDs);
    return ok;
}
*/
import "C"
import (
	"fmt"
	"unsafe"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// SupportsBelowWindowCapture macOS 可在不隐藏框选层的情况下截屏。
func SupportsBelowWindowCapture() bool {
	return true
}

// CaptureReadingArea 截取阅读区域，排除 Wread 自身窗口。
func CaptureReadingArea(rect application.Rect, belowWindow unsafe.Pointer, exclude ...unsafe.Pointer) ([]byte, error) {
	if belowWindow == nil {
		return nil, fmt.Errorf("overlay 窗口未就绪")
	}
	if rect.Width <= 0 || rect.Height <= 0 {
		return nil, fmt.Errorf("截屏区域无效")
	}

	wins := append([]unsafe.Pointer{belowWindow}, exclude...)
	cWins := make([]unsafe.Pointer, len(wins))
	copy(cWins, wins)

	var outData *C.uchar
	var outLen C.size_t
	ok := C.wreadCaptureExcludingWindows(
		C.int(rect.X), C.int(rect.Y), C.int(rect.Width), C.int(rect.Height),
		&cWins[0], C.int(len(cWins)),
		&outData, &outLen,
	)
	if ok == 0 || outData == nil || outLen == 0 {
		return nil, fmt.Errorf("排除窗口截屏失败")
	}
	defer C.free(unsafe.Pointer(outData))

	data := C.GoBytes(unsafe.Pointer(outData), C.int(outLen))
	if len(data) == 0 {
		return nil, fmt.Errorf("截屏结果为空")
	}
	return data, nil
}
