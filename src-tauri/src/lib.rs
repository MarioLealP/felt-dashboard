mod audio;

use tauri::{
  menu::{Menu, MenuItem},
  tray::TrayIconBuilder,
  webview::WebviewWindowBuilder,
  Manager, WebviewUrl, WindowEvent,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // Toggles the chat window open/closed from anywhere (Mario, 2026-09-12:
  // "double click or keybind to pop open the chat" — double-click isn't
  // available on Linux, tray-icon click events are documented as
  // unsupported there, so this keybind is the actual way in, alongside
  // the tray menu's "Show Felt" item).
  let toggle_shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyF);

  tauri::Builder::default()
    .plugin(tauri_plugin_http::init())
    .plugin(
      tauri_plugin_global_shortcut::Builder::new()
        .with_handler(move |app, shortcut, event| {
          if shortcut == &toggle_shortcut && event.state() == ShortcutState::Pressed {
            if let Some(window) = app.get_webview_window("main") {
              let visible = window.is_visible().unwrap_or(false);
              if visible {
                let _ = window.hide();
              } else {
                let _ = window.show();
                let _ = window.set_focus();
              }
            }
          }
        })
        .build(),
    )
    .manage(audio::RecordingState::default())
    .invoke_handler(tauri::generate_handler![audio::start_recording, audio::stop_recording])
    .setup(move |app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      app.global_shortcut().register(toggle_shortcut)?;

      // Outbound calls to felt-core go through tauri-plugin-http (see
      // src/lib/api.ts) — a native Rust request, not the webview's own
      // fetch — so the page's own origin (the default `tauri://` custom
      // scheme) no longer matters for those calls.
      let main_window = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
        .title("Felt")
        .inner_size(800.0, 600.0)
        .resizable(true)
        .build()?;

      // WebKitGTK denies getUserMedia (mic access) by default on Linux —
      // wry/Tauri don't wire up a permission-request handler for this out
      // of the box (confirmed 2026-09-12: the mic button failed with a
      // WebKit NotAllowedError in the packaged app). Auto-allow it
      // ourselves; this is a single-user local app talking to Mario's own
      // felt-voice, not a multi-origin browser where blanket-allowing
      // media would be a real risk. (Actual mic *capture* has since moved
      // to native cpal in audio.rs — see there for why — but the webview
      // still needs this to not immediately error out on the getUserMedia
      // call the existing browser-tab code path makes.)
      main_window.with_webview(|webview| {
        #[cfg(target_os = "linux")]
        {
          use webkit2gtk::{PermissionRequestExt, WebViewExt};
          webview.inner().connect_permission_request(|_view, request| {
            request.allow();
            true
          });
        }
      })?;

      // Tray icon — this app now lives in the tray rather than being a
      // window you keep open (Mario, 2026-09-12). Linux tray icons don't
      // emit click/double-click events (a documented Tauri limitation),
      // so "Show Felt" in the menu is the click-based way in; the global
      // keybind above is the other.
      let show_item = MenuItem::with_id(app, "show", "Show Felt", true, None::<&str>)?;
      let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
      let menu = Menu::with_items(app, &[&show_item, &quit_item])?;
      TrayIconBuilder::new()
        .icon(app.default_window_icon().cloned().expect("app icon must exist"))
        .menu(&menu)
        .tooltip("Felt")
        .on_menu_event(|app: &tauri::AppHandle, event| match event.id.as_ref() {
          "show" => {
            if let Some(window) = app.get_webview_window("main") {
              let _ = window.show();
              let _ = window.set_focus();
            }
          }
          "quit" => app.exit(0),
          _ => {}
        })
        .build(app)?;

      Ok(())
    })
    .on_window_event(|window, event| {
      // Closing the window hides it instead of quitting the app — the
      // app itself only exits via the tray menu's Quit.
      if let WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
        let _ = window.hide();
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
