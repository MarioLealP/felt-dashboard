import { useCallback, useRef, useState } from "react";

// Previously branched to Tauri's native mic capture (cpal, direct
// ALSA/PipeWire) on the packaged desktop build, working around a
// WebKitGTK-on-Linux bug where its own MediaRecorder reported
// `state=recording` on a live track but produced zero bytes of audio
// (found 2026-09-12, isolated against Firefox on the same machine). The
// desktop shell is now pywebview/WebView2 (Windows), which has a working
// MediaRecorder like any other Chromium-family browser, so this always
// uses the plain browser path now — same as the browser-tab build always
// did. Push-to-talk via the global hotkey is handled entirely on the
// Python side (native `sounddevice` capture, no webview involved at all);
// this hook only backs the in-window mic button for manual typed-chat use.
export function useMicRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.start();
    recorderRef.current = recorder;
    setIsRecording(true);
  }, []);

  const stop = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder) {
        resolve(new Blob());
        return;
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        for (const track of recorder.stream.getTracks()) track.stop();
        setIsRecording(false);
        resolve(blob);
      };
      recorder.stop();
    });
  }, []);

  return { isRecording, start, stop } as const;
}
