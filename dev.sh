#!/usr/bin/env bash
# Wread 开发模式（Wails v3）
set -euo pipefail
cd "$(dirname "$0")"

echo "[wread] 安装前端依赖..."
npm install --prefix frontend

WAILS3=""
if command -v wails3 >/dev/null 2>&1; then
  WAILS3=wails3
elif [ -x "${GOPATH:-$HOME/go}/bin/wails3" ]; then
  WAILS3="${GOPATH:-$HOME/go}/bin/wails3"
else
  echo "[wread] 未找到 wails3，请先安装："
  echo "  go install github.com/wailsapp/wails/v3/cmd/wails3@latest"
  echo "  并确保 \$GOPATH/bin 或 ~/go/bin 在 PATH 中"
  exit 1
fi

PORT="${WAILS_VITE_PORT:-9245}"
echo "[wread] 启动开发模式 (wails3 dev)..."
exec "$WAILS3" dev -config ./build/config.yml -port "$PORT" "$@"
