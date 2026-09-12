//! Native mic capture (cpal, direct ALSA/PipeWire) — bypasses WebKitGTK's
//! browser-side MediaRecorder entirely. Real 2026-09-12 finding: WebKitGTK
//! on this Linux build reports a live, unmuted mic track and a recorder
//! reaching `state=recording`, but produces zero bytes of actual audio —
//! confirmed (by directly comparing against Firefox on this same machine)
//! to be WebKitGTK's own capture pipeline, not this app, not permissions,
//! not the OS. Capturing natively sidesteps that bug outright rather than
//! chasing it further.

use std::io::Cursor;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use tauri::{AppHandle, Emitter};

// Mario, 2026-09-12: a wheel-tilt/wake-word-triggered recording had no way
// to end itself — it stayed open until someone noticed and clicked the
// manual stop button, and a quiet room's fan noise was enough to look like
// "still talking" to a naive volume gate. RMS (not peak) over each cpal
// buffer, checked against a fixed threshold, is a coarse approximation of
// real voice-activity detection — good enough to distinguish speech from
// room noise/silence without pulling in a real VAD model for this.
// Threshold is a starting guess, not measured against Mario's actual mic
// gain/room noise floor — needs his real-world tuning once he's used it.
const SILENCE_RMS_THRESHOLD: f32 = 0.02;
const SILENCE_TIMEOUT: Duration = Duration::from_secs(2);
const SILENCE_POLL_INTERVAL: Duration = Duration::from_millis(250);

#[derive(Default)]
pub struct RecordingState {
    stream: Mutex<Option<cpal::Stream>>,
    samples: Arc<Mutex<Vec<f32>>>,
    sample_rate: Mutex<u32>,
    channels: Mutex<u16>,
    // Timestamp of the last buffer whose RMS crossed the threshold —
    // None means "recording just started, hasn't been loud yet".
    last_loud: Arc<Mutex<Option<Instant>>>,
    // False the instant either the silence monitor or a manual
    // stop_recording call ends the recording — lets the other one notice
    // and not act twice on the same recording.
    active: Arc<AtomicBool>,
}

#[tauri::command]
pub fn start_recording(app: AppHandle, state: tauri::State<RecordingState>) -> Result<(), String> {
    let host = cpal::default_host();
    let device = host.default_input_device().ok_or("no microphone available")?;
    let config = device.default_input_config().map_err(|e| e.to_string())?;
    let sample_rate = config.sample_rate();
    let channels = config.channels();
    let stream_config: cpal::StreamConfig = config.into();

    let samples = state.samples.clone();
    samples.lock().map_err(|e| e.to_string())?.clear();

    let last_loud = state.last_loud.clone();
    *last_loud.lock().map_err(|e| e.to_string())? = None;
    state.active.store(true, Ordering::SeqCst);

    let callback_samples = samples.clone();
    let callback_last_loud = last_loud.clone();
    let stream = device
        .build_input_stream(
            &stream_config,
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                if let Ok(mut buffer) = callback_samples.lock() {
                    buffer.extend_from_slice(data);
                }
                let rms = (data.iter().map(|s| s * s).sum::<f32>() / data.len().max(1) as f32).sqrt();
                if rms > SILENCE_RMS_THRESHOLD {
                    if let Ok(mut lock) = callback_last_loud.lock() {
                        *lock = Some(Instant::now());
                    }
                }
            },
            |err| log::error!("mic capture error: {err}"),
            None,
        )
        .map_err(|e| e.to_string())?;

    stream.play().map_err(|e| e.to_string())?;

    *state.sample_rate.lock().map_err(|e| e.to_string())? = sample_rate;
    *state.channels.lock().map_err(|e| e.to_string())? = channels;
    *state.stream.lock().map_err(|e| e.to_string())? = Some(stream);

    // Recording start is also "last loud" for timeout purposes — otherwise
    // someone who hasn't started speaking yet at all would get cut off
    // after SILENCE_TIMEOUT instead of getting a fair chance to start.
    *last_loud.lock().map_err(|e| e.to_string())? = Some(Instant::now());

    let active = state.active.clone();
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(SILENCE_POLL_INTERVAL).await;
            if !active.load(Ordering::SeqCst) {
                // Already ended, either by this same check on a previous
                // loop iteration or by the user hitting stop manually.
                return;
            }
            let elapsed = last_loud
                .lock()
                .ok()
                .and_then(|lock| *lock)
                .map(|t| t.elapsed())
                .unwrap_or_default();
            if elapsed > SILENCE_TIMEOUT {
                active.store(false, Ordering::SeqCst);
                let _ = app.emit("felt://recording-auto-stopped", ());
                return;
            }
        }
    });

    Ok(())
}

/// Stops capture and returns the recorded audio as a WAV file's bytes.
#[tauri::command]
pub fn stop_recording(state: tauri::State<RecordingState>) -> Result<Vec<u8>, String> {
    // Tells the silence monitor (if still running) this recording is
    // already over, so it doesn't also fire an auto-stop event for it.
    state.active.store(false, Ordering::SeqCst);

    // Dropping the stream stops capture.
    *state.stream.lock().map_err(|e| e.to_string())? = None;

    let samples = state.samples.lock().map_err(|e| e.to_string())?;
    let spec = hound::WavSpec {
        channels: *state.channels.lock().map_err(|e| e.to_string())?,
        sample_rate: *state.sample_rate.lock().map_err(|e| e.to_string())?,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };

    let mut cursor = Cursor::new(Vec::new());
    {
        let mut writer = hound::WavWriter::new(&mut cursor, spec).map_err(|e| e.to_string())?;
        for &sample in samples.iter() {
            let clamped = (sample.clamp(-1.0, 1.0) * i16::MAX as f32) as i16;
            writer.write_sample(clamped).map_err(|e| e.to_string())?;
        }
        writer.finalize().map_err(|e| e.to_string())?;
    }
    Ok(cursor.into_inner())
}
