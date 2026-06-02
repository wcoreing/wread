//go:build darwin

package overlay

/*
#include <stdlib.h>
*/
import "C"
import (
	"log"
	"os"
	"strings"
)

// wreadPassLog 供 pass_darwin C 代码输出日志；设 WREAD_PASS_DEBUG=1 可看全部 skip 明细。
//
//export wreadPassLog
func wreadPassLog(cmsg *C.char) {
	if cmsg == nil {
		return
	}
	msg := C.GoString(cmsg)
	if strings.Contains(msg, " skip:") && os.Getenv("WREAD_PASS_DEBUG") == "" {
		return
	}
	log.Printf("[wread:pass] %s", msg)
}
