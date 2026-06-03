//go:build !darwin

package overlay

import "unsafe"

func setNativePassThrough(_ unsafe.Pointer, _ bool) {}

func setNativePassThroughLayout(_, _, _ int, _ string) {}

func setNativeFrameDragging(_ bool) {}

func turnPageNative(_ unsafe.Pointer) bool { return false }
