package app

import "github.com/wailsapp/wails/v3/pkg/application"

// SetupWindows 绑定工作区、弹出窗与 Pill。
func SetupWindows(s *Service, app *application.App, workspace, popout, pill application.Window, ws *Workspace) {
	s.attach(app, workspace, popout, pill, ws)
}
