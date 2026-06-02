package app

import "github.com/wailsapp/wails/v3/pkg/application"

// SetupWindows 绑定工作区与弹出窗，并注册阅读模式内缘条。
func SetupWindows(s *Service, app *application.App, workspace, popout application.Window, ws *Workspace) {
	s.attach(app, workspace, popout, ws)
	RegisterPassThroughRails(s)
}
