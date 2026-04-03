// assistant-voice: On-device speech-to-text using Apple's SFSpeechRecognizer
// Compile: swiftc -O -o assistant-voice voice-input.swift -framework Speech -framework AVFoundation
// Requires: Microphone + Speech Recognition permission in System Settings

import AVFoundation
import Foundation
import Speech

// MARK: - Configuration

let maxRecordingDuration: TimeInterval = 30.0  // seconds
let sampleRate: Double = 16000.0

// MARK: - Speech Recognizer

class VoiceInputManager {
    private let speechRecognizer: SFSpeechRecognizer
    private let audioEngine = AVAudioEngine()
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?

    init() {
        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US")) else {
            fputs("Error: Speech recognition not available for this locale.\n", stderr)
            exit(1)
        }
        self.speechRecognizer = recognizer

        if !recognizer.isAvailable {
            fputs("Error: Speech recognition is not available on this device.\n", stderr)
            exit(1)
        }
    }

    func requestPermissions(completion: @escaping (Bool) -> Void) {
        var micGranted = false
        var speechGranted = false
        let group = DispatchGroup()

        // Request microphone permission
        group.enter()
        AVCaptureDevice.requestAccess(for: .audio) { granted in
            micGranted = granted
            group.leave()
        }

        // Request speech recognition permission
        group.enter()
        SFSpeechRecognizer.requestAuthorization { status in
            speechGranted = (status == .authorized)
            group.leave()
        }

        group.notify(queue: .main) {
            if !micGranted {
                fputs("Error: Microphone permission denied.\n", stderr)
            }
            if !speechGranted {
                fputs("Error: Speech recognition permission denied.\n", stderr)
            }
            completion(micGranted && speechGranted)
        }
    }

    func recordAndTranscribe(completion: @escaping (String?) -> Void) {
        // Cancel any ongoing task
        recognitionTask?.cancel()
        recognitionTask = nil

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = false
        request.requiresOnDeviceRecognition = true  // Privacy: stays on device

        self.recognitionRequest = request

        let inputNode = audioEngine.inputNode
        let recordingFormat = inputNode.outputFormat(forBus: 0)

        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { buffer, _ in
            request.append(buffer)
        }

        audioEngine.prepare()

        do {
            try audioEngine.start()
        } catch {
            fputs("Error: Could not start audio engine: \(error.localizedDescription)\n", stderr)
            completion(nil)
            return
        }

        fputs("[listening...]\n", stderr)

        // Set up timeout
        DispatchQueue.main.asyncAfter(deadline: .now() + maxRecordingDuration) { [weak self] in
            self?.stopRecording()
        }

        recognitionTask = speechRecognizer.recognitionTask(with: request) { [weak self] result, error in
            if let result = result, result.isFinal {
                let text = result.bestTranscription.formattedString
                self?.stopRecording()
                completion(text)
                return
            }

            if let error = error {
                // Error code 1110 = no speech detected, which is not a real error
                let nsError = error as NSError
                if nsError.code != 1110 {
                    fputs("Recognition error: \(error.localizedDescription)\n", stderr)
                }
                self?.stopRecording()
                completion(nil)
            }
        }
    }

    func stopRecording() {
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        recognitionRequest?.endAudio()
        recognitionRequest = nil
        recognitionTask = nil
    }
}

// MARK: - Modes

enum Mode: String {
    case single     // Record once, output text, exit
    case listen     // Continuous: wait for Enter, record, output, repeat
}

func parseMode() -> Mode {
    if CommandLine.arguments.contains("--listen") {
        return .listen
    }
    return .single
}

// MARK: - Main

let mode = parseMode()
let manager = VoiceInputManager()
let semaphore = DispatchSemaphore(value: 0)

manager.requestPermissions { granted in
    guard granted else {
        fputs("Permissions not granted. Enable Microphone and Speech Recognition in System Settings.\n", stderr)
        exit(1)
    }

    switch mode {
    case .single:
        fputs("Press Enter to start recording (Ctrl+C to cancel)...\n", stderr)
        let _ = readLine()

        manager.recordAndTranscribe { text in
            if let text = text, !text.isEmpty {
                // Output transcribed text to stdout (for pipe to bun process)
                print(text)
            } else {
                fputs("No speech detected.\n", stderr)
            }
            semaphore.signal()
        }

        // Wait for silence detection / end of speech
        fputs("Speak now... (will stop when you pause)\n", stderr)

    case .listen:
        func listenLoop() {
            fputs("\nPress Enter to speak (or 'q' + Enter to quit)...\n", stderr)
            guard let input = readLine(), input != "q" else {
                semaphore.signal()
                return
            }

            manager.recordAndTranscribe { text in
                if let text = text, !text.isEmpty {
                    print(text)
                    fflush(stdout)
                } else {
                    fputs("No speech detected.\n", stderr)
                }
                // Loop again
                listenLoop()
            }

            fputs("Speak now...\n", stderr)
        }

        listenLoop()
    }
}

semaphore.wait()
