//! Native mic capture (cpal, direct ALSA/PipeWire) — bypasses WebKitGTK's
//! browser-side MediaRecorder entirely. Real 2026-09-12 finding: WebKitGTK
//! on this Linux build reports a live, unmuted mic track and a recorder
//! reaching `state=recording`, but produces zero bytes of actual audio —
//! confirmed (by directly comparing against Firefox on this same machine)
//! to be WebKitGTK's own capture pipeline, not this app, not permissions,
//! not the OS. Capturing natively sidesteps that bug outright rather than
//! chasing it further.

use std::io::Cursor;
use std::sync::{Arc, Mutex};

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};

#[derive(Default)]
pub struct RecordingState {
    stream: Mutex<Option<cpal::Stream>>,
    samples: Arc<Mutex<Vec<f32>>>,
    sample_rate: Mutex<u32>,
    channels: Mutex<u16>,
}

#[tauri::command]
pub fn start_recording(state: tauri::State<RecordingState>) -> Result<(), String> {
    let host = cpal::default_host();
    let device = host.default_input_device().ok_or("no microphone available")?;
    let config = device.default_input_config().map_err(|e| e.to_string())?;
    let sample_rate = config.sample_rate();
    let channels = config.channels();
    let stream_config: cpal::StreamConfig = config.into();

    let samples = state.samples.clone();
    samples.lock().map_err(|e| e.to_string())?.clear();

    let stream = device
        .build_input_stream(
            &stream_config,
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                if let Ok(mut buffer) = samples.lock() {
                    buffer.extend_from_slice(data);
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
    Ok(())
}

/// Stops capture and returns the recorded audio as a WAV file's bytes.
#[tauri::command]
pub fn stop_recording(state: tauri::State<RecordingState>) -> Result<Vec<u8>, String> {
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
