const { app, BrowserWindow, ipcMain, screen, dialog, shell } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')
const fs   = require('fs')

let controlWin  = null
let timerWin1   = null
let timerWin2   = null

// Mirror windows per room: mirrorWins[roomIndex] = [BrowserWindow, ...]
const mirrorWins = { 0: [], 1: [] }

const USER_DATA = app.getPath('userData')
const DATA_PATH = path.join(USER_DATA, 'state.json')

function loadState() {
  try { return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')) }
  catch { return null }
}
function saveState(state) {
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true })
  fs.writeFileSync(DATA_PATH, JSON.stringify(state, null, 2))
}

// Send to a specific room's main window + all its mirrors
function sendToRoom(roomIndex, channel, data) {
  const win = roomIndex === 0 ? timerWin1 : timerWin2
  if (win && !win.isDestroyed()) win.webContents.send(channel, data)
  mirrorWins[roomIndex].forEach(w => {
    if (w && !w.isDestroyed()) w.webContents.send(channel, data)
  })
}

// Send to ALL rooms and mirrors (timer-tick, apply-style)
function sendToAll(channel, data) {
  sendToRoom(0, channel, data)
  sendToRoom(1, channel, data)
}

function createTimerWindow(roomIndex, display, savedBounds, fullscreen) {
  const preload = path.join(__dirname, 'preload.js')
  const { x, y, width, height } = display.workArea
  const bounds = savedBounds || {
    width:  Math.floor(width  * 0.75),
    height: Math.floor(height * 0.85),
    x: x + Math.floor(width  * 0.12),
    y: y + Math.floor(height * 0.08),
  }
  const win = new BrowserWindow({
    ...bounds,
    title: `ER Timer — Room ${roomIndex + 1}`,
    icon: path.join(__dirname, '..', 'assets', 'icons', 'icon.png'),
    backgroundColor: '#0a0a12',
    webPreferences: { nodeIntegration: false, contextIsolation: true, preload }
  })
  win.setMenuBarVisibility(false)
  win.setAutoHideMenuBar(true)
  if (fullscreen) win.setFullScreen(true)
  win.loadFile(path.join(__dirname, 'windows', 'timer.html'))
  win.webContents.on('did-finish-load', () => {
    win.webContents.send('init-room', { roomIndex })
  })
  return win
}

// Create a mirror window for a given room on a specific display
function createMirrorWindow(roomIndex, display) {
  const preload = path.join(__dirname, 'preload.js')
  const { x, y, width, height } = display.workArea
  const win = new BrowserWindow({
    x, y, width, height,
    title: `ER Timer — Room ${roomIndex + 1} (Mirror)`,
    icon: path.join(__dirname, '..', 'assets', 'icons', 'icon.png'),
    backgroundColor: '#0a0a12',
    webPreferences: { nodeIntegration: false, contextIsolation: true, preload }
  })
  win.setMenuBarVisibility(false)
  win.setAutoHideMenuBar(true)
  win.loadFile(path.join(__dirname, 'windows', 'timer.html'))
  win.webContents.on('did-finish-load', () => {
    // Init with roomIndex so hints are filtered correctly
    win.webContents.send('init-room', { roomIndex })
    // Push current styles from control window
    controlWin?.webContents.send('sync-styles-to-room', { roomIndex })
  })
  win.on('closed', () => {
    // Remove from mirrorWins array when closed
    mirrorWins[roomIndex] = mirrorWins[roomIndex].filter(w => w !== win)
  })
  return win
}

function closeAllMirrors(roomIndex) {
  mirrorWins[roomIndex].forEach(w => { if (!w.isDestroyed()) w.close() })
  mirrorWins[roomIndex] = []
}

function openTimerWin2(savedBounds, fullscreen) {
  if (timerWin2 && !timerWin2.isDestroyed()) return
  const displays = screen.getAllDisplays()
  // Use saved bounds display if available, otherwise second display or first
  const display = displays[1] || displays[0]
  timerWin2 = createTimerWindow(1, display, savedBounds, fullscreen)
  timerWin2.on('closed', () => {
    timerWin2 = null
    closeAllMirrors(1)
  })
  timerWin2.webContents.once('did-finish-load', () => {
    controlWin?.webContents.send('sync-styles-to-room', { roomIndex: 1 })
  })
}

function closeTimerWin2() {
  closeAllMirrors(1)
  if (timerWin2 && !timerWin2.isDestroyed()) timerWin2.close()
  timerWin2 = null
}

app.whenReady().then(() => {
  const saved = loadState()
  const wb = saved?.windowBounds || {}
  const displays = screen.getAllDisplays()

  // Restore timer1 on saved display, default to first display
  const t1Display = displays[0]
  timerWin1 = createTimerWindow(0, t1Display, wb.timer1, wb.timer1Fullscreen)
  timerWin1.on('closed', () => {
    timerWin1 = null
    closeAllMirrors(0)
  })

  // Restore room 2 if it was open
  if (saved?.twoRooms) {
    openTimerWin2(wb.timer2, wb.timer2Fullscreen)
  }

  createControlWindow()

  // Restore mirror windows after a short delay (so control window is ready to sync styles)
  setTimeout(() => {
    if (saved?.settings?.displayMirrors) {
      ;[0, 1].forEach(roomIdx => {
        const indices = saved.settings.displayMirrors[roomIdx] || []
        // Skip index 0 (that's the main window), open mirrors for indices 1+
        indices.slice(1).forEach(di => {
          const display = displays[di] || displays[0]
          if (roomIdx === 1 && (!timerWin2 || timerWin2.isDestroyed())) return
          const win = createMirrorWindow(roomIdx, display)
          mirrorWins[roomIdx].push(win)
        })
      })
    }
  }, 1500)

  // Auto-updater
  if (app.isPackaged) {
    const log = require('electron-log')
    autoUpdater.logger = log
    autoUpdater.logger.transports.file.level = 'info'
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on('checking-for-update', () =>
      controlWin?.webContents.send('updater-status', 'Checking for updates...'))
    autoUpdater.on('update-not-available', () =>
      controlWin?.webContents.send('updater-status', 'Up to date'))
    autoUpdater.on('error', () =>
      controlWin?.webContents.send('updater-status', 'Update check failed'))
    autoUpdater.on('update-available', info => {
      controlWin?.webContents.send('updater-status', '')
      dialog.showMessageBox(controlWin, {
        type: 'info', title: 'Update Available',
        message: `ER Timer v${info.version} is available. Download now?`,
        buttons: ['Yes, Download', 'Later']
      }).then(r => { if (r.response === 0) autoUpdater.downloadUpdate() })
    })
    autoUpdater.on('download-progress', p =>
      controlWin?.webContents.send('updater-status', `Downloading... ${Math.round(p.percent)}%`))
    autoUpdater.on('update-downloaded', () => {
      controlWin?.webContents.send('updater-status', '')
      dialog.showMessageBox(controlWin, {
        type: 'info', title: 'Update Ready',
        message: 'Update downloaded. Restart now to install?',
        buttons: ['Restart Now', 'Later']
      }).then(r => { if (r.response === 0) autoUpdater.quitAndInstall(false, true) })
    })
    setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 3000)
  }
})

// Close all windows when control window closes
app.on('window-all-closed', () => app.quit())

function createControlWindow() {
  const preload = path.join(__dirname, 'preload.js')
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  controlWin = new BrowserWindow({
    width:  Math.floor(width  * 0.34),
    height: Math.floor(height * 0.88),
    x: Math.floor(width * 0.01),
    y: Math.floor(height * 0.06),
    title: 'ER Timer — Control',
    icon: path.join(__dirname, '..', 'assets', 'icons', 'icon.png'),
    backgroundColor: '#f4f4f1',
    autoHideMenuBar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true, preload }
  })
  controlWin.setMenuBarVisibility(false)
  controlWin.loadFile(path.join(__dirname, 'windows', 'control.html'))
  controlWin.on('closed', () => {
    controlWin = null
    // Close all timer windows and mirrors
    closeAllMirrors(0)
    closeAllMirrors(1)
    timerWin1?.close()
    timerWin2?.close()
  })
}

// IPC routing
ipcMain.on('timer-tick',  (e, data) => sendToAll('timer-tick', data))
ipcMain.on('hint-text',  (e, data) => sendToRoom(data.roomIndex, 'hint-text',  data))
ipcMain.on('play-sound', (e, data) => sendToRoom(data.roomIndex, 'play-sound', data))
ipcMain.on('hint-image', (e, data) => sendToRoom(data.roomIndex, 'hint-image', data))
ipcMain.on('hint-clear', (e, data) => sendToRoom(data.roomIndex, 'hint-clear', data))
ipcMain.on('apply-style', (e, data) => sendToAll('apply-style', data))

ipcMain.on('set-room-count', (e, { count, savedBounds, fullscreen }) => {
  if (count === 2) openTimerWin2(savedBounds, fullscreen)
  else closeTimerWin2()
})

ipcMain.on('toggle-fullscreen', (e, { roomIndex }) => {
  const win = roomIndex === 0 ? timerWin1 : timerWin2
  if (!win) return
  const going = !win.isFullScreen()
  win.setFullScreen(going)
  win.setMenuBarVisibility(false)
  win.setAutoHideMenuBar(true)
})

ipcMain.on('set-layout-mode', (e, data) => sendToAll('set-layout-mode', data))
ipcMain.on('save-layout', (e, data)      => controlWin?.webContents.send('save-layout', data))
ipcMain.on('layout-mode-done', (e, data) => controlWin?.webContents.send('layout-mode-done', data))

// Update display mirrors for a room
ipcMain.on('set-display-mirrors', (e, { roomIndex, displayIndices }) => {
  const sourceWin = roomIndex === 0 ? timerWin1 : timerWin2
  if (!sourceWin || sourceWin.isDestroyed()) return

  // Close all existing mirrors for this room
  closeAllMirrors(roomIndex)

  const displays = screen.getAllDisplays()

  displayIndices.forEach((di, i) => {
    const display = displays[di] || displays[0]
    const { x, y, width, height } = display.workArea
    if (i === 0) {
      // First selected display = move the main window there
      sourceWin.setBounds({
        x: x + Math.floor(width * 0.12),
        y: y + Math.floor(height * 0.08),
        width:  Math.floor(width  * 0.75),
        height: Math.floor(height * 0.85)
      })
    } else {
      // Additional displays = open mirror windows
      const win = createMirrorWindow(roomIndex, display)
      mirrorWins[roomIndex].push(win)
    }
  })
})

// Control asks us to push styles to a specific room (used after mirror opens)
ipcMain.on('push-styles-to-room', (e, { roomIndex, data }) => {
  sendToRoom(roomIndex, 'apply-style', data)
})

// Save window bounds for restoration on next launch
ipcMain.handle('get-window-bounds', () => ({
  timer1:           timerWin1 && !timerWin1.isDestroyed() ? timerWin1.getBounds() : null,
  timer1Fullscreen: timerWin1?.isFullScreen() || false,
  timer2:           timerWin2 && !timerWin2.isDestroyed() ? timerWin2.getBounds() : null,
  timer2Fullscreen: timerWin2?.isFullScreen() || false,
}))

ipcMain.handle('state-load',            ()      => loadState())
ipcMain.handle('state-save',            (e, s)  => { saveState(s); return true })
ipcMain.handle('get-user-data-path',    ()      => app.getPath('userData'))
ipcMain.handle('get-app-version',       ()      => app.getVersion())
ipcMain.handle('get-displays', () => screen.getAllDisplays().map((d, i) => ({
  index: i, id: d.id,
  label: `Display ${i + 1} (${d.size.width}x${d.size.height})`,
  bounds: d.bounds, workArea: d.workArea
})))
ipcMain.handle('open-folder-dialog', async () => {
  const res = await dialog.showOpenDialog(controlWin, { properties: ['openDirectory'] })
  return res.canceled ? null : res.filePaths[0]
})
ipcMain.handle('reveal-folder',       (e, p)         => shell.openPath(p))
ipcMain.handle('check-folder-exists', (e, p)         => { try { return fs.existsSync(p) } catch { return false } })
ipcMain.handle('read-image-folder', (e, folderPath) => {
  try {
    const exts = ['.png','.jpg','.jpeg','.gif','.webp','.bmp']
    return fs.readdirSync(folderPath)
      .filter(f => exts.includes(path.extname(f).toLowerCase()))
      .map(f => ({ name: path.basename(f, path.extname(f)), path: path.join(folderPath, f) }))
  } catch { return [] }
})
ipcMain.handle('create-named-folder', (e, base, name) => {
  const full = path.join(base, name)
  fs.mkdirSync(full, { recursive: true })
  return full
})
ipcMain.handle('rename-folder', (e, oldPath, newName) => {
  const dir  = path.dirname(oldPath)
  const newPath = path.join(dir, newName)
  fs.renameSync(oldPath, newPath)
  return newPath
})
// Manual update check triggered from settings button
ipcMain.on('check-for-updates', () => {
  if (app.isPackaged) {
    autoUpdater.checkForUpdates().catch(err => {
      controlWin?.webContents.send('updater-status', 'Update check failed')
    })
  } else {
    controlWin?.webContents.send('updater-status', 'Updates only work in built app')
  }
})

ipcMain.handle('get-number-styles-dir', () => {
  const dir = path.join(app.getPath('userData'), 'number-styles')
  fs.mkdirSync(dir, { recursive: true })
  return dir
})
