#ifndef WREAD_VISION_OCR_H
#define WREAD_VISION_OCR_H

char *wread_ocr_from_path(const char *path, char **errOut);
void wread_ocr_free(char *p);

#endif
