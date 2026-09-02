#!/usr/bin/env bash
# ER Timer — Linux installer
#
#   curl -fsSL https://raw.githubusercontent.com/darkhousemaster-hue/ER-Timer/main/install-linux.sh | bash
#
# No curl? Use wget instead:
#   wget -q -O - https://raw.githubusercontent.com/darkhousemaster-hue/ER-Timer/main/install-linux.sh | bash
#
# Downloads the latest release, puts it in your home folder, sets the
# permissions and adds it to the applications menu. No sudo needed:
# nothing is written outside your own home directory.
# Run it again any time to update to the newest version.

set -euo pipefail

REPO="darkhousemaster-hue/ER-Timer"
BIN_DIR="$HOME/.local/bin"
ICON_DIR="$HOME/.local/share/icons/hicolor/512x512/apps"
DESKTOP_DIR="$HOME/.local/share/applications"
APP_PATH="$BIN_DIR/ER-Timer.AppImage"
LIB_DIR="$HOME/.local/lib/er-timer"
LAUNCHER="$BIN_DIR/er-timer"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

# Some distributions ship curl, some ship wget, some ship both. Use whichever
# is there rather than making the user install a download tool first.
WGET_PROGRESS=""
if command -v curl >/dev/null 2>&1; then
  DL=curl
elif command -v wget >/dev/null 2>&1; then
  DL=wget
  if wget --help 2>&1 | grep -q -- '--show-progress'; then
    WGET_PROGRESS="--show-progress"
  fi
else
  echo "This installer needs either curl or wget, and neither is installed." >&2
  echo "Install one of them first, then run the installer again:" >&2
  echo >&2
  echo "    sudo apt install -y curl        # Debian, Ubuntu, Mint" >&2
  echo "    sudo dnf install -y curl        # Fedora" >&2
  echo "    sudo pacman -S curl             # Arch, Manjaro" >&2
  exit 1
fi

# fetch URL -> stdout
fetch() {
  if [ "$DL" = curl ]; then curl -fsSL "$1"; else wget -q -O - "$1"; fi
}

# fetch_to URL FILE — quiet, for small files
fetch_to() {
  if [ "$DL" = curl ]; then curl -fsSL -o "$2" "$1"; else wget -q -O "$2" "$1"; fi
}

# download URL FILE — with a progress bar, for the big one
download() {
  if [ "$DL" = curl ]; then
    curl -fL --progress-bar -o "$2" "$1"
  else
    # shellcheck disable=SC2086
    wget -q $WGET_PROGRESS -O "$2" "$1"
  fi
}

say "Looking up the latest ER Timer release…"
API="https://api.github.com/repos/$REPO/releases/latest"
URL=$(fetch "$API" \
  | grep -o '"browser_download_url": *"[^"]*\.AppImage"' \
  | head -1 | cut -d'"' -f4 || true)

if [ -z "$URL" ]; then
  echo "No Linux build found on the latest release." >&2
  echo "Releases before v2.7.0 are Windows-only — check that a newer one exists:" >&2
  echo "  https://github.com/$REPO/releases" >&2
  exit 1
fi

VERSION=$(basename "$URL" | sed -E 's/.*[ .-]([0-9]+\.[0-9]+\.[0-9]+)\.AppImage/\1/')
say "Downloading ER Timer $VERSION…"
mkdir -p "$BIN_DIR" "$ICON_DIR" "$DESKTOP_DIR"
download "$URL" "$APP_PATH.part"
mv "$APP_PATH.part" "$APP_PATH"
chmod +x "$APP_PATH"          # the executable bit is lost in transit

# An AppImage mounts itself with libfuse2, which Ubuntu 22.04 and newer stopped
# shipping. Installing it needs a password that locked-down game-master machines
# may not have, so fall back to the AppImage runtime unpacking itself into a
# temp directory. Costs about a second at startup, and unlike unpacking the
# AppImage ourselves it still sets APPIMAGE, which the updater needs.
#
# This is the environment variable rather than the --appimage-extract-and-run
# flag on purpose. After installing an update, electron-updater relaunches the
# AppImage with no arguments at all, so a flag would be lost and the new copy
# would die on missing FUSE. The variable is inherited by that relaunch.
EXTRACT_LINE=""
if ! ldconfig -p 2>/dev/null | grep -q 'libfuse\.so\.2'; then
  EXTRACT_LINE="export APPIMAGE_EXTRACT_AND_RUN=1"
fi

# Installers before 3.0.0 unpacked into ~/.local/lib/er-timer. Nothing runs
# from there any more, and it is ~300 MB.
rm -rf "$LIB_DIR"

say "Adding it to your applications menu…"
fetch_to "https://raw.githubusercontent.com/$REPO/main/assets/icons/linux/512x512.png" \
  "$ICON_DIR/er-timer.png" || true

# One stable command to start it, whichever way it turns out to run.
cat > "$LAUNCHER" <<LAUNCH
#!/bin/sh
# --ozone-platform=x11 routes through XWayland on Wayland desktops. Native
# Wayland forbids an app from positioning its own windows, which would break
# always-on-top, the minimise button and putting the timer on the right screen.
#
# --no-sandbox because chrome-sandbox has to be root-owned with mode 4755,
# which needs a password these machines may not have, and Ubuntu 24.04 blocks
# the unprivileged user-namespace sandbox Chromium would otherwise fall back
# to, so Electron aborts on startup. The app only ever loads local files.
#
# The same thing is set as an environment variable as well as a flag, because
# after installing an update electron-updater relaunches the AppImage with no
# arguments at all. Flags are lost there; the environment is inherited.
export ELECTRON_DISABLE_SANDBOX=1
$EXTRACT_LINE
exec "$APP_PATH" --ozone-platform=x11 --no-sandbox "\$@"
LAUNCH
chmod +x "$LAUNCHER"

cat > "$DESKTOP_DIR/er-timer.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=ER Timer
Comment=Escape Room dual-room timer
Exec="$LAUNCHER"
Icon=$ICON_DIR/er-timer.png
Terminal=false
Categories=Utility;
StartupWMClass=er-timer
DESKTOP
chmod +x "$DESKTOP_DIR/er-timer.desktop"
command -v update-desktop-database >/dev/null && \
  update-desktop-database "$DESKTOP_DIR" >/dev/null 2>&1 || true
command -v gtk-update-icon-cache >/dev/null && \
  gtk-update-icon-cache -f -t "$HOME/.local/share/icons/hicolor" >/dev/null 2>&1 || true

# A shortcut on the desktop itself. xdg-user-dir knows the localised folder
# name (Schreibtisch, Bureau, ...); fall back to English if it is missing.
DESKTOP_FOLDER=$(xdg-user-dir DESKTOP 2>/dev/null || true)
[ -n "$DESKTOP_FOLDER" ] || DESKTOP_FOLDER="$HOME/Desktop"
if [ -d "$DESKTOP_FOLDER" ]; then
  cp "$DESKTOP_DIR/er-timer.desktop" "$DESKTOP_FOLDER/er-timer.desktop"
  chmod +x "$DESKTOP_FOLDER/er-timer.desktop"
  # GNOME will not run a desktop file it has not been told to trust.
  command -v gio >/dev/null && \
    gio set "$DESKTOP_FOLDER/er-timer.desktop" metadata::trusted true >/dev/null 2>&1 || true
fi

say "Done — ER Timer $VERSION is installed"
echo "Start it from the applications menu or the desktop shortcut, or run:"
echo "    $LAUNCHER"
echo
echo "Re-run this installer any time to update."
