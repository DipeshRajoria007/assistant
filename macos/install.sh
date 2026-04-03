#!/bin/bash
# Install the hotkey daemon as a macOS LaunchAgent (starts on login)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PLIST_NAME="com.assistant.hotkey"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
BINARY="$PROJECT_DIR/dist/assistant-hotkey"

# Build first
bash "$SCRIPT_DIR/build.sh"

# Create LaunchAgents dir if needed
mkdir -p "$LAUNCH_AGENTS_DIR"

# Generate plist with correct paths
sed "s|__ASSISTANT_DIR__|$PROJECT_DIR|g" \
    "$SCRIPT_DIR/$PLIST_NAME.plist" \
    > "$LAUNCH_AGENTS_DIR/$PLIST_NAME.plist"

# Load the agent
launchctl unload "$LAUNCH_AGENTS_DIR/$PLIST_NAME.plist" 2>/dev/null || true
launchctl load "$LAUNCH_AGENTS_DIR/$PLIST_NAME.plist"

echo ""
echo "Hotkey daemon installed and running."
echo "Press Ctrl+Space from anywhere to invoke the assistant."
echo ""
echo "Logs: /tmp/assistant-hotkey.log"
echo "To uninstall: bash macos/uninstall.sh"
