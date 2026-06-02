//go:build !darwin

package overlay

import "unsafe"

func setNativePassThrough(_ unsafe.Pointer, _ bool) {}

func setNativePassThroughLayout(_, _ int, _ string) {}
