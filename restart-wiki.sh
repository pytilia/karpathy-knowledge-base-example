#!/usr/bin/env bash
#
# Restart the project-memory wiki mkdocs server.
#
# Usage: ./restart-wiki.sh
#
# Always runs mkdocs serve detached so the script exits immediately.
# Logs go to /tmp/mkdocs.log. Stop with: pkill -f "mkdocs serve"
#
# mkdocs serves on http://127.0.0.1:8765 (configured in mkdocs.yml).
#
set -euo pipefail

cd "$(dirname "$0")"

if pgrep -f "mkdocs serve" >/dev/null 2>&1; then
  echo "Stopping running mkdocs serve processes..."
  pkill -f "mkdocs serve" || true
  # Wait for the port to be released. Bail after 10 seconds.
  for _ in $(seq 1 10); do
    if ! lsof -i :8765 >/dev/null 2>&1; then break; fi
    sleep 1
  done
fi

# nohup + stdin from /dev/null + disown lets the process survive this shell exiting.
# (setsid isn't available on stock macOS, so we rely on nohup's SIGHUP-ignore behaviour.)
nohup mkdocs serve </dev/null >/tmp/mkdocs.log 2>&1 &
PID=$!
disown "$PID" 2>/dev/null || true

echo "mkdocs serve started (PID $PID). Logs: /tmp/mkdocs.log"
echo "Wiki: http://127.0.0.1:8765"
echo "Stop with: pkill -f \"mkdocs serve\""
