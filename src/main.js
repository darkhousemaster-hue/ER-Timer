const { app, BrowserWindow, ipcMain, screen, dialog, shell } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')
const fs   = require('fs')

let controlWin  = null
let timerWin1   = null
let timerWin2   = null

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

function createTimerWindow(roomIndex, display) {
  const preload = path.join(__dirname, 'preload.js')
  const { x, y, width, height } = display.workArea
  const win = new BrowserWindow({
    width:  Math.floor(width  * 0.75),
    height: Math.floor(height * 0.85),
    x: x + Math.floor(width  * 0.12),
    y: y + Math.floor(height * 0.08),
    title: `ER Timer — Room ${roomIndex + 1}`,
    icon: path.join(__dirname, '..', 'assets', 'icons', 'icon.png'),
    backgroundColor: '#0a0a12',
    webPreferences: { nodeIntegration: false, contextIsolation: true, preload }
  })
  win.setMenuBarVisibility(false)
  win.setAutoHideMenuBar(true)
  win.loadFile(path.join(__dirname, 'windows', 'timer.html'))
  win.webContents.on('did-finish-load', () => {
    win.webContents.send('init-room', { roomIndex })
  })
  return win
}

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
    webPreferences: { nodeIntegration: false, contextIsolation: true, preload }
  })
  controlWin.loadFile(path.join(__dirname, 'windows', 'control.html'))
  controlWin.on('closed', () => {
    controlWin = null
    timerWin1?.close()
    timerWin2?.close()
  })
}

function openTimerWin2() {
  if (timerWin2 && !timerWin2.isDestroyed()) return
  const displays = screen.getAllDisplays()
  const display  = displays[1] || displays[0]
  timerWin2 = createTimerWindow(1, display)
  timerWin2.on('closed', () => { timerWin2 = null })
  timerWin2.webContents.once('did-finish-load', () => {
    controlWin?.webContents.send('sync-styles-to-win2')
  })
}
function closeTimerWin2() {
  if (timerWin2 && !timerWin2.isDestroyed()) timerWin2.close()
  timerWin2 = null
}

app.whenReady().then(() => {
  const displays = screen.getAllDisplays()
  timerWin1 = createTimerWindow(0, displays[0])
  timerWin1.on('closed', () => { timerWin1 = null })
  createControlWindow()

  // Auto-updater
  autoUpdater.checkForUpdates().catch(() => {})

  autoUpdater.on('update-available', () => {
    dialog.showMessageBox(controlWin, {
      type: 'info',
      title: 'Update Available',
      message: 'A new version of ER Timer is available. Download and install now?',
      buttons: ['Yes', 'Later']
    }).then(r => { if (r.response === 0) autoUpdater.downloadUpdate() })
  })

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox(controlWin, {
      type: 'info',
      title: 'Update Ready',
      message: 'Update downloaded. The app will restart to install it.',
      buttons: ['Restart Now', 'Later']
    }).then(r => { if (r.response === 0) autoUpdater.quitAndInstall() })
  })
})
app.on('window-all-closed', () => app.quit())

function sendToTimer(roomIndex, channel, data) {
  const win = roomIndex === 0 ? timerWin1 : timerWin2
  if (win && !win.isDestroyed()) win.webContents.send(channel, data)
}

ipcMain.on('timer-tick',  (e, data) => {
  timerWin1?.webContents.send('timer-tick', data)
  timerWin2?.webContents.send('timer-tick', data)
})
ipcMain.on('hint-text',  (e, data) => sendToTimer(data.roomIndex, 'hint-text',  data))
ipcMain.on('play-sound', (e, data) => sendToTimer(data.roomIndex, 'play-sound', data))
ipcMain.on('hint-image', (e, data) => sendToTimer(data.roomIndex, 'hint-image', data))
ipcMain.on('hint-clear', (e, data) => sendToTimer(data.roomIndex, 'hint-clear', data))

ipcMain.on('apply-style', (e, data) => {
  timerWin1?.webContents.send('apply-style', data)
  timerWin2?.webContents.send('apply-style', data)
})
ipcMain.on('set-room-count', (e, { count }) => {
  if (count === 2) openTimerWin2()
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
ipcMain.on('set-layout-mode', (e, data) => {
  timerWin1?.webContents.send('set-layout-mode', data)
  timerWin2?.webContents.send('set-layout-mode', data)
})
ipcMain.on('save-layout', (e, data) => {
  controlWin?.webContents.send('save-layout', data)
})
ipcMain.on('layout-mode-done', (e, data) => {
  controlWin?.webContents.send('layout-mode-done', data)
})
ipcMain.on('set-window-display', (e, { roomIndex, displayIndex }) => {
  const win = roomIndex === 0 ? timerWin1 : timerWin2
  if (!win || win.isDestroyed()) return
  const displays = screen.getAllDisplays()
  const display = displays[displayIndex] || displays[0]
  const { x, y, width, height } = display.workArea
  win.setBounds({
    x: x + Math.floor(width * 0.12),
    y: y + Math.floor(height * 0.08),
    width:  Math.floor(width  * 0.75),
    height: Math.floor(height * 0.85)
  })
})
ipcMain.on('set-display-mirrors', (e, { roomIndex, displayIndices }) => {
  const win = roomIndex === 0 ? timerWin1 : timerWin2
  if (!win || win.isDestroyed() || !displayIndices.length) return
  const displays = screen.getAllDisplays()
  const display = displays[displayIndices[0]] || displays[0]
  const { x, y, width, height } = display.workArea
  win.setBounds({
    x: x + Math.floor(width * 0.12),
    y: y + Math.floor(height * 0.08),
    width:  Math.floor(width  * 0.75),
    height: Math.floor(height * 0.85)
  })
})

ipcMain.handle('state-load',         ()      => loadState())
ipcMain.handle('state-save',         (e, s)  => { saveState(s); return true })
ipcMain.handle('get-user-data-path', ()      => app.getPath('userData'))
ipcMain.handle('get-displays', () => {
  return screen.getAllDisplays().map((d, i) => ({
    index: i, id: d.id,
    label: `Display ${i + 1} (${d.size.width}x${d.size.height})`,
    bounds: d.bounds, workArea: d.workArea
  }))
})
ipcMain.handle('open-folder-dialog', async () => {
  const res = await dialog.showOpenDialog(controlWin, { properties: ['openDirectory'] })
  return res.canceled ? null : res.filePaths[0]
})
ipcMain.handle('reveal-folder', (e, p) => shell.openPath(p))
ipcMain.handle('read-image-folder', (e, folderPath) => {
  try {
    const exts = ['.png','.jpg','.jpeg','.gif','.webp','.bmp']
    return fs.readdirSync(folderPath)
      .filter(f => exts.includes(path.extname(f).toLowerCase()))
      .map(f => ({ name: path.basename(f, path.extname(f)), path: path.join(folderPath, f) }))
  } catch { return [] }
})
ipcMain.handle('check-folder-exists', (e, folderPath) => {
  try { return fs.existsSync(folderPath) } catch { return false }
})
ipcMain.handle('create-named-folder', (e, base, name) => {
  const full = path.join(base, name)
  fs.mkdirSync(full, { recursive: true })
  return full
})
ipcMain.handle('get-app-version', () => app.getVersion())

ipcMain.handle('get-number-styles-dir', () => {
  const dir = path.join(app.getPath('userData'), 'number-styles')
  fs.mkdirSync(dir, { recursive: true })
  return dir
})
