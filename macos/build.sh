#!/bin/bash
# Build the hotkey daemon binary
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

echo "Built: $OUT_DIR/assistant-hotkey"
echo ""
echo "To start the hotkey daemon:"
echo "  ./dist/assistant-hotkey"
echo ""
echo "Then press Ctrl+Space from anywhere to invoke the assistant."
