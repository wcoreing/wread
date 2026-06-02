#!/usr/bin/env bash
# Wread 开发模式（Wails v3，不要用 wails dev）
set -euo pipefail
cd "$(dirname "$0")"

WAILS3="${WAILS3:-$HOME/go/bin/wails3}"
if ! command -v "$WAILS3" >/dev/null 2>&1; then
  echo "未找到 wails3，请先安装："
  echo "  go install github.com/wailsapp/wails/v3/cmd/wails3@latest"
  exit 1
fi

if command -v task >/dev/null 2>&1; then
  exec task dev
fi

exec "$WAILS3" dev -config ./build/config.yml -port "${WAILS_VITE_PORT:-9245}"
