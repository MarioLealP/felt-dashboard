import { useCallback, useRef, useState } from "react";

import { invoke } from "@tauri-apps/api/core";

// Inside the packaged Tauri app, recording is done natively (cpal, direct
// ALSA/PipeWire capture in src-tauri/src/audio.rs) instead of the
// browser's MediaRecorder. Real bug found 2026-09-12: WebKitGTK's own
// MediaRecorder reports a live, unmuted track and reaches
// `state=recording`, but produces zero bytes of actual audio — isolated
// (by comparing directly against Firefox on this same machine, which
// captures real audio fine) to WebKitGTK's own capture pipeline, not
// this app, not permissions, not the OS. The browser-tab build (no
// `__TAURI_INTERNALS__`) keeps using the real MediaRecorder, since that
// works fine there.
const isTauri = "__TAURI_INTERNALS__" in window;

export function useMicRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const start = useCallback(async () => {
    if (isTauri) {
      await invoke("start_recording");
      setIsRecording(true);
      return;
    }

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
    if (isTauri) {
      return invoke<number[]>("stop_recording").then((wavBytes) => {
        setIsRecording(false);
        return new Blob([new Uint8Array(wavBytes)], { type: "audio/wav" });
      });
    }

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
