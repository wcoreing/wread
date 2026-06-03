@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo [wread] 安装前端依赖...
call npm install --prefix frontend
if errorlevel 1 (
  echo [wread] npm install 失败
  exit /b 1
)

set "WAILS3="
where wails3 >nul 2>&1 && set "WAILS3=wails3"
if not defined WAILS3 if exist "%USERPROFILE%\go\bin\wails3.exe" set "WAILS3=%USERPROFILE%\go\bin\wails3.exe"
if not defined WAILS3 if defined GOPATH if exist "%GOPATH%\bin\wails3.exe" set "WAILS3=%GOPATH%\bin\wails3.exe"
if not defined WAILS3 (
  echo [wread] 未找到 wails3，请先安装：
  echo   go install github.com/wailsapp/wails/v3/cmd/wails3@latest
  echo   并将 %%USERPROFILE%%\go\bin 加入 PATH
  exit /b 1
)

if not defined WAILS_VITE_PORT set "WAILS_VITE_PORT=9245"

echo [wread] 启动开发模式 (wails3 dev)...
"%WAILS3%" dev -config ./build/config.yml -port %WAILS_VITE_PORT%
exit /b %errorlevel%
