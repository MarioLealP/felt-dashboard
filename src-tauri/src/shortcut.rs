//! Toggling the chat window via a global keybind — through the
//! `xdg-desktop-portal` GlobalShortcuts interface, not a compositor-
//! specific mechanism. The `global-hotkey` crate (what
//! `tauri-plugin-global-shortcut` uses) is documented X11-only on
//! Linux and confirmed (Mario, 2026-09-12: "keybind doesn't work") not
//! to fire on this Wayfire/Wayland session. The portal is the actual
//! Wayland-native, compositor-independent standard for this — it's
//! implemented here by `xdg-desktop-portal-hyprland` (confirmed
//! running, and its own `UseIn` list explicitly names Wayfire
//! alongside Hyprland/sway/river, not just Hyprland). It also comes
//! with a real benefit `global-hotkey` never had: the portal's own
//! `configure_shortcuts()` opens the desktop's native rebind UI, so
//! Mario can actually change the key combo without this app touching
//! his Wayfire config file at all.
//!
//! `run()` and `configure()` each open their own portal session rather
//! than sharing one (ashpd's `Session` type isn't nameable outside the
//! crate, so it can't be stashed in app state) — both bind the same
//! shortcut ID, which the portal backend keys on per app + ID, so the
//! user's chosen trigger persists across sessions either way.

use ashpd::desktop::global_shortcuts::{GlobalShortcuts, NewShortcut};
use futures_util::StreamExt;
use tauri::AppHandle;

use crate::portal_register;
use crate::toggle_main_window;

const TOGGLE_SHORTCUT_ID: &str = "toggle-felt";

pub async fn run(app: AppHandle) {
    // Real error hit 2026-09-12: "org.freedesktop.portal.Error.NotAllowed:
    // An app id is required" — GlobalShortcuts (and other app-id-gated
    // portals) reject a plain native binary unless it first registers
    // its identity via org.freedesktop.host.portal.Registry.Register.
    // That registration is per-D-Bus-connection, so GlobalShortcuts has
    // to be built on the *same* connection the registration happened
    // on (with_connection), not a fresh one from GlobalShortcuts::new().
    let connection = match portal_register::register().await {
        Ok(connection) => connection,
        Err(err) => {
            log::error!("couldn't register app with the portal: {err}");
            return;
        }
    };
    let shortcuts = match GlobalShortcuts::with_connection(connection).await {
        Ok(shortcuts) => shortcuts,
        Err(err) => {
            log::error!("GlobalShortcuts portal unavailable: {err}");
            return;
        }
    };

    let session = match shortcuts.create_session(Default::default()).await {
        Ok(session) => session,
        Err(err) => {
            log::error!("couldn't create GlobalShortcuts session: {err}");
            return;
        }
    };
    let new_shortcut =
        NewShortcut::new(TOGGLE_SHORTCUT_ID, "Show/hide Felt").preferred_trigger(Some("<Control><Alt>f"));
    // bind_shortcuts() only starts a portal Request — submitting it isn't
    // the same as it succeeding. The real 2026-09-12 bug: this was never
    // checked, so a rejected/failed bind (or a backend with no working
    // consent UI at all) looked identical to a working one from here.
    // .response() is what actually waits for and reports the outcome.
    let bind_request = match shortcuts
        .bind_shortcuts(&session, &[new_shortcut], None, Default::default())
        .await
    {
        Ok(request) => request,
        Err(err) => {
            log::error!("couldn't submit the Felt toggle shortcut bind request: {err}");
            return;
        }
    };
    match bind_request.response() {
        Ok(response) => log::info!("shortcut bind response: {response:?}"),
        Err(err) => {
            log::error!("shortcut bind request failed: {err}");
            return;
        }
    }

    let mut activated = match shortcuts.receive_activated().await {
        Ok(stream) => stream,
        Err(err) => {
            log::error!("couldn't listen for shortcut activations: {err}");
            return;
        }
    };

    while let Some(event) = activated.next().await {
        if event.shortcut_id() == TOGGLE_SHORTCUT_ID {
            toggle_main_window(&app);
        }
    }
}

/// Opens the desktop's own native shortcut-rebinding UI — used by the
/// tray menu's "Change keybind..." item.
pub async fn configure() {
    let connection = match portal_register::register().await {
        Ok(connection) => connection,
        Err(err) => {
            log::error!("couldn't register app with the portal: {err}");
            return;
        }
    };
    let shortcuts = match GlobalShortcuts::with_connection(connection).await {
        Ok(shortcuts) => shortcuts,
        Err(err) => {
            log::error!("GlobalShortcuts portal unavailable: {err}");
            return;
        }
    };
    let session = match shortcuts.create_session(Default::default()).await {
        Ok(session) => session,
        Err(err) => {
            log::error!("couldn't create GlobalShortcuts session: {err}");
            return;
        }
    };
    let new_shortcut =
        NewShortcut::new(TOGGLE_SHORTCUT_ID, "Show/hide Felt").preferred_trigger(Some("<Control><Alt>f"));
    let bind_request = match shortcuts
        .bind_shortcuts(&session, &[new_shortcut], None, Default::default())
        .await
    {
        Ok(request) => request,
        Err(err) => {
            log::error!("couldn't submit the Felt toggle shortcut bind request: {err}");
            return;
        }
    };
    if let Err(err) = bind_request.response() {
        log::error!("shortcut bind request failed: {err}");
        return;
    }
    log::info!("opening the shortcut config UI...");
    if let Err(err) = shortcuts.configure_shortcuts(&session, None, Default::default()).await {
        log::error!("couldn't open the shortcut config UI: {err}");
    } else {
        log::info!("shortcut config UI request completed");
    }
}
