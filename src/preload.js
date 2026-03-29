const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  send: (channel, data) => {
    const allowed = [
      'timer-tick', 'hint-text', 'hint-image', 'hint-clear',
      'apply-style', 'set-room-count', 'toggle-fullscreen',
      'play-sound', 'set-window-display', 'set-display-mirrors',
      'save-layout', 'layout-mode-done', 'set-layout-mode'
    ]
    if (allowed.includes(channel)) ipcRenderer.send(channel, data)
  },
  invoke: (channel, ...args) => {
    const allowed = [
      'state-load', 'state-save', 'open-folder-dialog',
      'reveal-folder', 'read-image-folder', 'create-named-folder',
      'get-number-styles-dir', 'get-displays', 'get-user-data-path',
      'check-folder-exists', 'get-app-version', 'get-window-bounds',
      'rename-folder'
    ]
    if (allowed.includes(channel)) return ipcRenderer.invoke(channel, ...args)
  },
  on: (channel, cb) => {
    const allowed = [
      'timer-tick', 'hint-text', 'hint-image', 'hint-clear',
      'apply-style', 'init-room', 'play-sound',
      'sync-styles-to-win2', 'set-layout-mode',
      'save-layout', 'layout-mode-done', 'updater-status'
    ]
    if (allowed.includes(channel))
      ipcRenderer.on(channel, (event, data) => cb(data))
  },
  off: channel => ipcRenderer.removeAllListeners(channel),
  getVersion: () => ipcRenderer.invoke('get-app-version')
})
