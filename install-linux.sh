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

# AppImages normally need libfuse2, which Ubuntu 22.04 and newer stopped
# shipping. Installing it needs a password, and locked-down game-master
# machines often have no sudo at all — so when it is missing we unpack the
# AppImage once instead. --appimage-extract is built into the AppImage
# runtime itself and does not use FUSE.
LAUNCH_TARGET="$APP_PATH"
if ! ldconfig -p 2>/dev/null | grep -q 'libfuse\.so\.2'; then
  say "Unpacking (this system has no libfuse2, so no password is needed)…"
  TMP=$(mktemp -d)
  if ( cd "$TMP" && "$APP_PATH" --appimage-extract >/dev/null 2>&1 ) \
     && [ -x "$TMP/squashfs-root/AppRun" ]; then
    rm -rf "$LIB_DIR"
    mkdir -p "$(dirname "$LIB_DIR")"
    mv "$TMP/squashfs-root" "$LIB_DIR"
    LAUNCH_TARGET="$LIB_DIR/AppRun"
    rm -f "$APP_PATH"          # the unpacked copy is what runs from now on
  else
    rm -rf "$TMP"
    echo >&2
    echo "Could not unpack the AppImage, and libfuse2 is missing." >&2
    echo "Ask whoever administers this machine to run:" >&2
    echo >&2
    echo "    sudo apt install -y libfuse2" >&2
    echo >&2
    exit 1
  fi
  rm -rf "$TMP"
fi

say "Adding it to your applications menu…"
fetch_to "https://raw.githubusercontent.com/$REPO/main/assets/icons/linux/512x512.png" \
  "$ICON_DIR/er-timer.png" || true

# One stable command to start it, whichever of the two layouts is in use.
cat > "$LAUNCHER" <<LAUNCH
#!/bin/sh
exec "$LAUNCH_TARGET" --ozone-platform=x11 "\$@"
LAUNCH
chmod +x "$LAUNCHER"

cat > "$DESKTOP_DIR/er-timer.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=ER Timer
Comment=Escape Room dual-room timer
Exec="$LAUNCHER"
Icon=er-timer
Terminal=false
Categories=Utility;
StartupWMClass=ER Timer
DESKTOP
chmod +x "$DESKTOP_DIR/er-timer.desktop"
command -v update-desktop-database >/dev/null && \
  update-desktop-database "$DESKTOP_DIR" >/dev/null 2>&1 || true

say "Done — ER Timer $VERSION is installed"
echo "Start it from your applications menu, or run:"
echo "    $LAUNCHER"
echo
echo "Re-run this installer any time to update."
