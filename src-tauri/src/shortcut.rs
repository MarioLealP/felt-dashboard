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

use crate::toggle_main_window;

const TOGGLE_SHORTCUT_ID: &str = "toggle-felt";

pub async fn run(app: AppHandle) {
    let shortcuts = match GlobalShortcuts::new().await {
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
    if let Err(err) = shortcuts
        .bind_shortcuts(&session, &[new_shortcut], None, Default::default())
        .await
    {
        log::error!("couldn't bind the Felt toggle shortcut: {err}");
        return;
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
    let shortcuts = match GlobalShortcuts::new().await {
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
    if let Err(err) = shortcuts
        .bind_shortcuts(&session, &[new_shortcut], None, Default::default())
        .await
    {
        log::error!("couldn't bind the Felt toggle shortcut: {err}");
        return;
    }
    if let Err(err) = shortcuts.configure_shortcuts(&session, None, Default::default()).await {
        log::error!("couldn't open the shortcut config UI: {err}");
    }
}
