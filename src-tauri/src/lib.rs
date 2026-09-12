use tauri::{webview::WebviewWindowBuilder, WebviewUrl};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_http::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // Outbound calls to felt-core go through tauri-plugin-http (see
      // src/lib/api.ts) — a native Rust request, not the webview's own
      // fetch — so the page's own origin (the default `tauri://` custom
      // scheme) no longer matters for those calls. An earlier attempt
      // served the app over a real http://localhost origin instead
      // (tauri-plugin-localhost) specifically to route around a
      // webview-fetch bug; with fetch no longer used for felt-core
      // calls, the default scheme is back to being fine, and dropping
      // the extra plugin removes an "app.security" tradeoff (its own
      // docs call it "considerable security risk") for no remaining
      // benefit.
      let main_window = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
        .title("Felt")
        .inner_size(800.0, 600.0)
        .resizable(true)
        .build()?;

      // WebKitGTK denies getUserMedia (mic access, needed for Felt's
      // voice-chat button) by default on Linux — wry/Tauri don't wire
      // up a permission-request handler for this out of the box
      // (confirmed 2026-09-12: the mic button failed with a WebKit
      // NotAllowedError in the packaged app). Auto-allow it ourselves;
      // this is a single-user local app talking to Mario's own
      // felt-voice, not a multi-origin browser where blanket-allowing
      // media would be a real risk.
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

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
