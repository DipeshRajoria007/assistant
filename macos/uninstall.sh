#!/bin/bash
# Uninstall the hotkey daemon LaunchAgent
set -euo pipefail

PLIST_NAME="com.assistant.hotkey"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"

if [ -f "$PLIST_PATH" ]; then
    launchctl unload "$PLIST_PATH" 2>/dev/null || true
    rm "$PLIST_PATH"
    echo "Hotkey daemon uninstalled."
else
    echo "Hotkey daemon not installed."
fi
