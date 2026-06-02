package main

import (
	"embed"
	"log"
	"runtime"

	"wread/internal/app"
	"wread/internal/model"
	"wread/internal/ocr"
	"wread/internal/read"
	"wread/internal/store"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
	"github.com/wailsapp/wails/v3/pkg/icons"
)

//go:embed all:frontend/dist
var assets embed.FS

func init() {
	application.RegisterEvent[string]("read:status")
	application.RegisterEvent[string]("read:preview")
	application.RegisterEvent[string]("read:ocr")
	application.RegisterEvent[string]("read:delta")
	application.RegisterEvent[string]("read:error")
	application.RegisterEvent[string]("read:followup")
	application.RegisterEvent[model.SnapDO]("read:done")
	application.RegisterEvent[bool]("overlay:editable")
	application.RegisterEvent[bool]("overlay:readingMode")
	application.RegisterEvent[bool]("layout:docked")
	application.RegisterEvent[int]("layout:sidebarW")
	application.RegisterEvent[string]("layout:notePlace")
	application.RegisterEvent[bool]("focus:note")
	application.RegisterEvent[bool]("layout:notebookListToggle")
	application.RegisterEvent[bool]("layout:catalogToggle")
	application.RegisterEvent[model.SessionDO]("notebook:opened")
	application.RegisterEvent[model.ReaderSettingsDO]("reader:settings")
	application.RegisterEvent[model.CatalogNodeDO]("catalog:changed")
}

func main() {
	log.Printf("Wread v%s starting…", AppVersion)

	dataDir, err := store.DataDir()
	if err != nil {
		log.Fatal(err)
	}
	st, err := store.New(dataDir)
	if err != nil {
		log.Fatal(err)
	}
	defer st.Close()

	engine := read.NewEngine(st, nil)
	svc := app.NewService(AppVersion, st, engine)
	wailsApp := application.New(application.Options{
		Name:        "Wread",
		Description: "AI 桌面伴读助手",
		Services: []application.Service{
			application.NewService(svc),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: false,
			ActivationPolicy: application.ActivationPolicyRegular,
		},
	})
	engine.SetEmitter(func(event string, payload any) {
		wailsApp.Event.Emit(event, payload)
	})

	wsState := st.GetWorkspaceState()
	ws := app.NewWorkspace(svc, wsState)
	wb := ws.InitialWorkspaceBounds()
	pb := ws.InitialPopoutBounds()

	workspace := wailsApp.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:             "workspace",
		Title:            "Wread",
		X:                wb.X,
		Y:                wb.Y,
		Width:            wb.Width,
		Height:           wb.Height,
		MinWidth:         661,
		MinHeight:        180,
		Frameless:        true,
		AlwaysOnTop:      true,
		BackgroundType:   application.BackgroundTypeTransparent,
		BackgroundColour: application.NewRGBA(0, 0, 0, 0),
		URL:              "/",
		Mac: application.MacWindow{
			Backdrop:                application.MacBackdropTransparent,
			TitleBar:                application.MacTitleBarHidden,
			InvisibleTitleBarHeight: 0,
		},
		Windows: application.WindowsWindow{
			HiddenOnTaskbar: true,
		},
	})

	popout := wailsApp.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:             "popout",
		Title:            "Wread 笔记",
		X:                pb.X,
		Y:                pb.Y,
		Width:            pb.Width,
		Height:           pb.Height,
		MinWidth:         320,
		MinHeight:        480,
		AlwaysOnTop:      true,
		Frameless:        true,
		Hidden:           wsState.Docked,
		BackgroundColour: application.NewRGB(18, 18, 24),
		URL:              "/popout",
		Mac: application.MacWindow{
			Backdrop:                application.MacBackdropTransparent,
			TitleBar:                application.MacTitleBarHidden,
			InvisibleTitleBarHeight: 36,
		},
	})

	app.SetupWindows(svc, wailsApp, workspace, popout, ws)

	wailsApp.Event.OnApplicationEvent(events.Common.ApplicationStarted, func(*application.ApplicationEvent) {
		ws.ApplyLayout()
		svc.EnsureOverlayReadMode()
	})

	workspace.RegisterHook(events.Common.WindowDidMove, func(*application.WindowEvent) { svc.SyncWorkspaceBounds() })
	workspace.RegisterHook(events.Common.WindowDidResize, func(*application.WindowEvent) { svc.SyncWorkspaceBounds() })
	popout.RegisterHook(events.Common.WindowDidMove, func(*application.WindowEvent) { svc.SyncPopoutBounds() })
	popout.RegisterHook(events.Common.WindowDidResize, func(*application.WindowEvent) { svc.SyncPopoutBounds() })

	workspace.RegisterKeyBinding("CmdOrCtrl+Shift+S", func(_ application.Window) { svc.FocusSidebar() })
	workspace.RegisterKeyBinding("CmdOrCtrl+Shift+O", func(_ application.Window) { svc.FocusOverlay() })
	workspace.RegisterKeyBinding("CmdOrCtrl+Shift+R", func(_ application.Window) {
		_ = svc.InterpretNow(svc.DefaultRegion())
	})
	popout.RegisterKeyBinding("CmdOrCtrl+Shift+O", func(_ application.Window) { svc.FocusOverlay() })
	popout.RegisterKeyBinding("CmdOrCtrl+Shift+R", func(_ application.Window) {
		_ = svc.InterpretNow(svc.DefaultRegion())
	})

	workspace.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) {
		workspace.Hide()
		e.Cancel()
	})
	popout.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) {
		popout.Hide()
		e.Cancel()
	})

	systemTray := wailsApp.SystemTray.New()
	if runtime.GOOS == "darwin" {
		systemTray.SetTemplateIcon(icons.SystrayMacTemplate)
	}
	systemTray.SetTooltip("Wread v" + AppVersion)

	menu := wailsApp.NewMenu()
	menu.Add("显示开卷").OnClick(func(_ *application.Context) { svc.FocusOverlay() })
	menu.Add("显示笔记").OnClick(func(_ *application.Context) { svc.FocusSidebar() })
	menu.Add("解读当前页").OnClick(func(_ *application.Context) {
		_ = svc.InterpretNow(svc.DefaultRegion())
	})
	menu.AddSeparator()
	menu.Add("退出").OnClick(func(_ *application.Context) { wailsApp.Quit() })
	systemTray.SetMenu(menu)

	workspace.Show()
	if !wsState.Docked {
		popout.Show()
	}

	go ocr.Warmup()

	if err := wailsApp.Run(); err != nil {
		log.Fatal(err)
	}
}
