#!/bin/bash
# Build all macOS Swift binaries
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="$SCRIPT_DIR/../dist"

mkdir -p "$OUT_DIR"

echo "Building assistant-hotkey..."
swiftc -O \
    -o "$OUT_DIR/assistant-hotkey" \
    "$SCRIPT_DIR/hotkey-daemon.swift" \
    -framework Cocoa \
    -framework Carbon \
    2>&1

echo "Building assistant-voice..."
swiftc -O \
    -o "$OUT_DIR/assistant-voice" \
    "$SCRIPT_DIR/voice-input.swift" \
    -framework Speech \
    -framework AVFoundation \
    2>&1

echo ""
echo "Built:"
echo "  $OUT_DIR/assistant-hotkey  (global hotkey: Ctrl+Space)"
echo "  $OUT_DIR/assistant-voice   (speech-to-text)"
echo ""
echo "Usage:"
echo "  ./dist/assistant-hotkey              # Start hotkey daemon"
echo "  ./dist/assistant-voice               # Record once, output text"
echo "  ./dist/assistant-voice --listen      # Continuous listen mode"
