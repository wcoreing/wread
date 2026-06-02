//go:build darwin

package overlay

/*
#include <stdlib.h>
*/
import "C"

// wreadReaderRailActivated 供 pass_darwin 在解读内缘条点击时回调 Go。
//
//export wreadReaderRailActivated
func wreadReaderRailActivated() {
	invokeReaderRailClick()
}

// wreadNoteRailNotebookActivated 笔记本内缘条。
//
//export wreadNoteRailNotebookActivated
func wreadNoteRailNotebookActivated() {
	invokeNoteRailClick(NoteRailNotebook)
}

// wreadNoteRailCatalogActivated 目录内缘条。
//
//export wreadNoteRailCatalogActivated
func wreadNoteRailCatalogActivated() {
	invokeNoteRailClick(NoteRailCatalog)
}
