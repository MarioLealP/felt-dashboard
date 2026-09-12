//! Registers this app's identity with `xdg-desktop-portal`, a
//! prerequisite for app-id-gated portals (GlobalShortcuts among them)
//! on `xdg-desktop-portal` 1.20+. Real error hit 2026-09-12:
//! `org.freedesktop.portal.Error.NotAllowed: An app id is required` —
//! Flatpak apps get an app id for free from their sandbox; a plain
//! native binary like this one has to call
//! `org.freedesktop.host.portal.Registry.Register` itself first. Not
//! wrapped by `ashpd` (as of 0.13.13), so this is a raw `zbus` call
//! against the documented interface.

pub const APP_ID: &str = "com.clockmost.felt";

/// Opens the session bus connection and registers this app's identity
/// on it, returning the connection so callers construct their portal
/// proxies (e.g. `GlobalShortcuts::with_connection`) on the *same*
/// connection — registration is per-connection (per D-Bus unique
/// name), so a portal proxy opened on a different connection wouldn't
/// see it.
pub async fn register() -> zbus::Result<zbus::Connection> {
    let connection = zbus::Connection::session().await?;
    connection
        .call_method(
            Some("org.freedesktop.portal.Desktop"),
            "/org/freedesktop/portal/desktop",
            Some("org.freedesktop.host.portal.Registry"),
            "Register",
            &(APP_ID, std::collections::HashMap::<String, zbus::zvariant::Value>::new()),
        )
        .await?;
    Ok(connection)
}
