//! A Unix socket external triggers write a short command to, so
//! outside-the-app input sources (the mouse wheel-tilt watcher in
//! felt-desktop-agent today; a wake-word listener later) can ask for a
//! specific action rather than only a generic window toggle. Chosen
//! over piling on more OS signals — Unix only gives two free ones
//! (SIGUSR1 is WebKitGTK's own GC signal, already learned the hard
//! way), and a socket scales to as many named actions as needed.
//!
//! Mario, 2026-09-12: "left wheel -> text command, felt -> voice
//! command, right wheel -> voice command" — three trigger surfaces,
//! two distinct actions (open focused on typing; open and start
//! listening), so "toggle the window" alone wasn't enough anymore.

use std::path::PathBuf;

use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::net::{UnixListener, UnixStream};

use crate::{toggle_main_window, WindowVisible};

pub fn socket_path() -> PathBuf {
    let runtime_dir = std::env::var("XDG_RUNTIME_DIR").unwrap_or_else(|_| "/tmp".to_string());
    PathBuf::from(runtime_dir).join("felt-tray.sock")
}

fn show_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

async fn handle_connection(app: &AppHandle, stream: UnixStream) {
    let mut lines = BufReader::new(stream).lines();
    while let Ok(Some(line)) = lines.next_line().await {
        match line.trim() {
            "toggle" => toggle_main_window(app),
            "show-text" => {
                // A real toggle now, not just "show" — Mario, 2026-09-12:
                // "left wheel still doesn't close". Same WindowVisible
                // flag toggle_main_window uses (see lib.rs), since
                // is_visible() itself isn't trustworthy on Wayfire.
                let visibility = app.state::<WindowVisible>();
                if visibility.get() {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.hide();
                    }
                    visibility.set(false);
                } else {
                    show_window(app);
                    visibility.set(true);
                    let _ = app.emit("felt://focus-text", ());
                }
            }
            "start-voice" => {
                // Also a real toggle now — Mario, 2026-09-12: "nor right
                // wheel stops the mic". A recording already in progress
                // (whether started by this same wheel, the other trigger
                // surfaces, or wake-word once that's enabled) gets ended
                // by a second tilt, via the exact same event the silence
                // monitor uses (audio.rs) — the frontend doesn't need to
                // know which one fired it. Deliberately does NOT show/
                // focus the window either way, unlike "show-text" above —
                // Mario, same day: "make the mic record not pop open the
                // window... without breaking the flow" (e.g. mid-game).
                let recording_state = app.state::<crate::audio::RecordingState>();
                if crate::audio::is_recording(&recording_state) {
                    let _ = app.emit("felt://recording-auto-stopped", ());
                } else {
                    let _ = app.emit("felt://start-voice", ());
                }
            }
            other => log::warn!("trigger socket: unrecognized command {other:?}"),
        }
    }
}

pub async fn run(app: AppHandle) {
    let path = socket_path();
    // A stale socket file from a previous, uncleanly-stopped run blocks
    // binding a fresh one at the same path.
    let _ = std::fs::remove_file(&path);

    let listener = match UnixListener::bind(&path) {
        Ok(listener) => listener,
        Err(err) => {
            log::error!("couldn't bind trigger socket at {path:?}: {err}");
            return;
        }
    };
    log::info!("trigger socket listening at {path:?}");

    loop {
        match listener.accept().await {
            Ok((stream, _)) => {
                let app = app.clone();
                tauri::async_runtime::spawn(async move { handle_connection(&app, stream).await });
            }
            Err(err) => log::error!("trigger socket accept error: {err}"),
        }
    }
}
