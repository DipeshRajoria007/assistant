// assistant-hotkey: Lightweight global hotkey daemon for macOS
// Listens for Ctrl+Space (configurable) and activates the assistant terminal.
// Compile: swiftc -O -o assistant-hotkey hotkey-daemon.swift -framework Cocoa -framework Carbon
// Requires: Accessibility permission in System Settings > Privacy & Security

import Cocoa
import Carbon

// MARK: - Configuration

/// The hotkey combo: modifier flags + key code
/// Default: Ctrl + Space (keyCode 49 = Space)
let hotkeyModifiers: UInt32 = UInt32(controlKey)
let hotkeyKeyCode: UInt32 = 49 // Space bar

// MARK: - Terminal Detection & Activation

/// Find and activate the terminal window running assistant, or launch a new one
func activateAssistant() {
    // Try to find an existing terminal running our process
    let terminals = ["com.apple.Terminal", "com.googlecode.iterm2", "com.mitchellh.ghostty", "dev.warp.Warp-Stable"]

    for bundleId in terminals {
        if let app = NSRunningApplication.runningApplications(withBundleIdentifier: bundleId).first {
            app.activate(options: [.activateAllWindows])
            NSLog("[assistant-hotkey] Activated: \(bundleId)")
            return
        }
    }

    // No terminal running — launch one with the assistant
    launchAssistantInTerminal()
}

func launchAssistantInTerminal() {
    // Try iTerm2 first, then Terminal.app
    let script: String
    if NSWorkspace.shared.urlForApplication(withBundleIdentifier: "com.googlecode.iterm2") != nil {
        script = """
        tell application "iTerm"
            activate
            set newWindow to (create window with default profile command "bun run start")
        end tell
        """
    } else {
        script = """
        tell application "Terminal"
            activate
            do script "cd \(ProcessInfo.processInfo.environment["ASSISTANT_DIR"] ?? "~/code/assistant") && bun run start"
        end tell
        """
    }

    var error: NSDictionary?
    if let appleScript = NSAppleScript(source: script) {
        appleScript.executeAndReturnError(&error)
        if let error = error {
            NSLog("[assistant-hotkey] AppleScript error: \(error)")
        }
    }
}

// MARK: - Global Hotkey Registration (Carbon API)

var hotkeyRef: EventHotKeyRef?

func registerHotkey() {
    let hotkeyID = EventHotKeyID(signature: OSType(0x4153_5354), // "ASST"
                                  id: 1)

    let modifiers = hotkeyModifiers
    let keyCode = hotkeyKeyCode

    var eventType = EventTypeSpec(eventClass: OSType(kEventClassKeyboard),
                                  eventKind: UInt32(kEventHotKeyPressed))

    // Install handler
    let status = InstallEventHandler(
        GetApplicationEventTarget(),
        { (_, event, _) -> OSStatus in
            activateAssistant()
            return noErr
        },
        1,
        &eventType,
        nil,
        nil
    )

    guard status == noErr else {
        NSLog("[assistant-hotkey] Failed to install event handler: \(status)")
        exit(1)
    }

    // Register the hotkey
    let regStatus = RegisterEventHotKey(
        keyCode,
        modifiers,
        hotkeyID,
        GetApplicationEventTarget(),
        0,
        &hotkeyRef
    )

    guard regStatus == noErr else {
        NSLog("[assistant-hotkey] Failed to register hotkey: \(regStatus)")
        exit(1)
    }

    NSLog("[assistant-hotkey] Registered Ctrl+Space globally")
}

// MARK: - Accessibility Check

func checkAccessibility() -> Bool {
    let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue(): true] as CFDictionary
    return AXIsProcessTrustedWithOptions(options)
}

// MARK: - Main

NSLog("[assistant-hotkey] Starting global hotkey daemon...")

if !checkAccessibility() {
    NSLog("[assistant-hotkey] Accessibility permission needed. A dialog should have appeared.")
    NSLog("[assistant-hotkey] Grant permission in System Settings > Privacy & Security > Accessibility")
    // Continue anyway — the dialog prompts the user
}

registerHotkey()

NSLog("[assistant-hotkey] Listening for Ctrl+Space. Press Ctrl+C to stop.")

// Run the event loop
NSApplication.shared.run()
