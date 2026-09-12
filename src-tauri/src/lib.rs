mod audio;
mod portal_register;
mod shortcut;
mod trigger_socket;

use tauri::{
  menu::{CheckMenuItem, Menu, MenuItem},
  tray::TrayIconBuilder,
  webview::WebviewWindowBuilder,
  AppHandle, Manager, WebviewUrl, WindowEvent,
};

pub(crate) fn toggle_main_window(app: &AppHandle) {
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

async fn set_temperature_unit(felt_core_url: &str, unit: &str) {
  let client = reqwest::Client::new();
  let result = client
    .post(format!("{felt_core_url}/v1/settings/temperature-unit"))
    .json(&serde_json::json!({ "unit": unit }))
    .send()
    .await;
  if let Err(err) = result {
    log::error!("couldn't set temperature unit: {err}");
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let _ = dotenvy::dotenv();
  // Same variable name the browser-tab build already reads at build time
  // (src/lib/config.ts) — one place to configure it, not two.
  let felt_core_url =
    std::env::var("VITE_FELT_CORE_URL").unwrap_or_else(|_| "http://localhost:8420".to_string());

  tauri::Builder::default()
    .plugin(tauri_plugin_http::init())
    .manage(audio::RecordingState::default())
    .invoke_handler(tauri::generate_handler![audio::start_recording, audio::stop_recording])
    .setup(move |app| {
      // Always on, not just in debug builds — this is a release binary
      // running as a systemd service; without a logger installed at all,
      // every log::error!/log::info! call in this app (shortcut.rs,
      // audio.rs) was a silent no-op the whole time, which is exactly
      // why the portal shortcut's failures were invisible in
      // `journalctl` (found 2026-09-12 while debugging "keybind still
      // doesn't work" / "nothing happens if i press change keybind").
      app.handle().plugin(
        tauri_plugin_log::Builder::default()
          .level(log::LevelFilter::Info)
          .build(),
      )?;

      // Toggles the chat window open/closed from anywhere (Mario,
      // 2026-09-12: "double click or keybind to pop open the chat", then
      // "keybind doesn't work" for a first attempt via
      // tauri-plugin-global-shortcut — that crate's Linux backend is
      // documented X11-only and genuinely didn't fire here. Mario, when
      // offered "edit Wayfire's config directly" as the fallback: "cant
      // we do a more broad OS independent system instead". The real
      // answer is the portal (see shortcut.rs) — it's the actual
      // Wayland-native standard for this, not tied to this one
      // compositor's config file, and confirmed available here via
      // xdg-desktop-portal-hyprland (which explicitly lists Wayfire in
      // its own supported-compositors list).
      let app_handle = app.handle().clone();
      tauri::async_runtime::spawn(shortcut::run(app_handle));

      // A general-purpose external trigger, separate from the portal
      // keybind above — a Unix socket (see trigger_socket.rs) any
      // process can write a named command to, regardless of whether
      // the portal-based keybind actually works on Mario's compositor.
      // Real use case: "left wheel -> text command, felt -> voice
      // command, right wheel -> voice command" (Mario, 2026-09-12) —
      // three distinct external trigger sources feeding two distinct
      // actions, which a single "toggle" signal can't express. Mario's
      // SteelSeries mouse's wheel-tilt buttons are horizontal-scroll
      // axis events (REL_HWHEEL), not discrete key/button presses, so
      // no ordinary keybinding mechanism (Wayfire's own included) can
      // bind to them directly — felt-desktop-agent's own evdev listener
      // does the direction detection and writes to this socket instead.
      let app_handle_for_socket = app.handle().clone();
      tauri::async_runtime::spawn(trigger_socket::run(app_handle_for_socket));

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
      // so "Show Felt" in the menu is the click-based way in; the portal
      // keybind above is the other.
      let show_item = MenuItem::with_id(app, "show", "Show Felt", true, None::<&str>)?;
      let configure_keybind_item =
        MenuItem::with_id(app, "configure-keybind", "Change keybind...", true, None::<&str>)?;
      let celsius_item = CheckMenuItem::with_id(app, "unit-celsius", "Temperature: Celsius", true, true, None::<&str>)?;
      let fahrenheit_item =
        CheckMenuItem::with_id(app, "unit-fahrenheit", "Temperature: Fahrenheit", true, false, None::<&str>)?;
      let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
      let menu = Menu::with_items(
        app,
        &[
          &show_item,
          &configure_keybind_item,
          &celsius_item,
          &fahrenheit_item,
          &quit_item,
        ],
      )?;

      let felt_core_url_for_menu = felt_core_url.clone();
      let celsius_item_for_menu = celsius_item.clone();
      let fahrenheit_item_for_menu = fahrenheit_item.clone();
      TrayIconBuilder::new()
        .icon(app.default_window_icon().cloned().expect("app icon must exist"))
        .menu(&menu)
        .tooltip("Felt")
        .on_menu_event(move |app: &tauri::AppHandle, event| match event.id.as_ref() {
          "show" => {
            if let Some(window) = app.get_webview_window("main") {
              let _ = window.show();
              let _ = window.set_focus();
            }
          }
          "configure-keybind" => {
            tauri::async_runtime::spawn(shortcut::configure());
          }
          "unit-celsius" => {
            let _ = celsius_item_for_menu.set_checked(true);
            let _ = fahrenheit_item_for_menu.set_checked(false);
            let url = felt_core_url_for_menu.clone();
            tauri::async_runtime::spawn(async move { set_temperature_unit(&url, "celsius").await });
          }
          "unit-fahrenheit" => {
            let _ = celsius_item_for_menu.set_checked(false);
            let _ = fahrenheit_item_for_menu.set_checked(true);
            let url = felt_core_url_for_menu.clone();
            tauri::async_runtime::spawn(async move { set_temperature_unit(&url, "fahrenheit").await });
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
