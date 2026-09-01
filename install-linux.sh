#!/usr/bin/env bash
# ER Timer — Linux installer
#
#   curl -fsSL https://raw.githubusercontent.com/darkhousemaster-hue/ER-Timer/main/install-linux.sh | bash
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

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

say "Looking up the latest ER Timer release…"
API="https://api.github.com/repos/$REPO/releases/latest"
URL=$(curl -fsSL "$API" \
  | grep -o '"browser_download_url": *"[^"]*\.AppImage"' \
  | head -1 | cut -d'"' -f4 || true)

if [ -z "$URL" ]; then
  echo "No Linux build found on the latest release." >&2
  echo "Releases before v2.7.0 are Windows-only — check that a newer one exists:" >&2
  echo "  https://github.com/$REPO/releases" >&2
  exit 1
fi

VERSION=$(basename "$URL" | sed -E 's/.*[ -]([0-9]+\.[0-9]+\.[0-9]+)\.AppImage/\1/')
say "Downloading ER Timer $VERSION…"
mkdir -p "$BIN_DIR" "$ICON_DIR" "$DESKTOP_DIR"
curl -fL --progress-bar -o "$APP_PATH.part" "$URL"
mv "$APP_PATH.part" "$APP_PATH"
chmod +x "$APP_PATH"          # the executable bit is lost in transit

say "Adding it to your applications menu…"
curl -fsSL -o "$ICON_DIR/er-timer.png" \
  "https://raw.githubusercontent.com/$REPO/main/assets/icons/linux/512x512.png" || true

cat > "$DESKTOP_DIR/er-timer.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=ER Timer
Comment=Escape Room dual-room timer
Exec="$APP_PATH" --ozone-platform=x11
Icon=er-timer
Terminal=false
Categories=Utility;
StartupWMClass=ER Timer
DESKTOP
chmod +x "$DESKTOP_DIR/er-timer.desktop"
command -v update-desktop-database >/dev/null && \
  update-desktop-database "$DESKTOP_DIR" >/dev/null 2>&1 || true

# AppImages need libfuse2, which Ubuntu 22.04 and newer no longer ship.
if ! ldconfig -p 2>/dev/null | grep -q 'libfuse\.so\.2'; then
  say "One more thing"
  echo "AppImages need the libfuse2 library, which your distribution does not"
  echo "install by default. This is the only step that needs a password:"
  echo
  echo "    sudo apt install -y libfuse2"
  echo
  echo "Without it the app will not start."
fi

say "Done — ER Timer $VERSION is installed"
echo "Start it from your applications menu, or run:"
echo "    $APP_PATH"
echo
echo "Re-run this installer any time to update."
