#import <CoreGraphics/CoreGraphics.h>
#import <Foundation/Foundation.h>
#import <ImageIO/ImageIO.h>
#import <Vision/Vision.h>
#import <stdlib.h>
#import <string.h>

#import "vision_ocr.h"

static char *wread_strdup(const char *s) {
    if (s == NULL) {
        return NULL;
    }
    size_t n = strlen(s) + 1;
    char *out = malloc(n);
    if (out != NULL) {
        memcpy(out, s, n);
    }
    return out;
}

char *wread_ocr_from_path(const char *path, char **errOut) {
    if (path == NULL || path[0] == '\0') {
        if (errOut != NULL) {
            *errOut = wread_strdup("missing image path");
        }
        return NULL;
    }

    @autoreleasepool {
        NSString *pathStr = [NSString stringWithUTF8String:path];
        NSURL *url = [NSURL fileURLWithPath:pathStr];

        CGImageSourceRef source = CGImageSourceCreateWithURL((__bridge CFURLRef)url, NULL);
        if (source == NULL) {
            if (errOut != NULL) {
                *errOut = wread_strdup("invalid image");
            }
            return NULL;
        }

        CGImageRef cgImage = CGImageSourceCreateImageAtIndex(source, 0, NULL);
        CFRelease(source);
        if (cgImage == NULL) {
            if (errOut != NULL) {
                *errOut = wread_strdup("invalid image");
            }
            return NULL;
        }

        VNRecognizeTextRequest *request = [[VNRecognizeTextRequest alloc] init];
        request.recognitionLevel = VNRequestTextRecognitionLevelAccurate;
        request.recognitionLanguages = @[ @"zh-Hans", @"zh-Hant", @"en-US" ];
        request.usesLanguageCorrection = YES;

        VNImageRequestHandler *handler =
            [[VNImageRequestHandler alloc] initWithCGImage:cgImage options:@{}];
        CGImageRelease(cgImage);

        NSError *error = nil;
        if (![handler performRequests:@[ request ] error:&error]) {
            if (errOut != NULL) {
                const char *msg = [[error localizedDescription] UTF8String];
                *errOut = wread_strdup(msg != NULL ? msg : "vision error");
            }
            return NULL;
        }

        NSMutableArray<NSString *> *lines = [NSMutableArray array];
        for (VNRecognizedTextObservation *obs in request.results) {
            VNRecognizedText *candidate = [obs topCandidates:1].firstObject;
            if (candidate.string.length > 0) {
                [lines addObject:candidate.string];
            }
        }

        NSString *result = [lines componentsJoinedByString:@"\n"];
        if (result.length == 0) {
            if (errOut != NULL) {
                *errOut = wread_strdup("no text");
            }
            return NULL;
        }

        return wread_strdup([result UTF8String]);
    }
}

void wread_ocr_free(char *p) {
    free(p);
}
