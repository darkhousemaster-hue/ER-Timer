// ════════════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════════════
let state = {
  digits:        ['6','0','0','0'],  // live countdown digits
  resetDigits:   ['6','0','0','0'],  // what Reset returns to (set in settings)
  timerRunning:  false,
  twoRooms:      false,
  managerMode:   false,
  rooms: [
    { currentTextHint: '', currentImageHint: '', phases: [], hintSoundOn: true },
    { currentTextHint: '', currentImageHint: '', phases: [], hintSoundOn: true },
  ],
  presets: [],
  activePresetIndex: null,
  numberFolders: [],
  managerPassword: '',      // empty = not set yet
  roomNames: ['Room 1', 'Room 2'],
  settings: {
    imageMode:       false,
    activeNumFolder: '',
    fontFamily:      'Courier New',
    timerColor:      '#ffffff',
    bgImage:         '',
    hintSound:         '',
    gameoverSound:     '',
    countdownSound:    '',
    countdownTrigger:  0,
    audioDeviceIds:    [[], []],  // [room0 deviceIds, room1 deviceIds]
    displayIndex:      [0, 1],    // primary screen per room
    displayMirrors:    [[], []],  // all selected screens per room
    timerLayout:       null,      // saved digit positions { d0:{left,top}, ... }
    numberSize:        1.0,       // scale multiplier for digit images
  }
}

// ════════════════════════════════════════════════════════
// PATH HELPERS — store relative paths, resolve at runtime
// This makes the app portable across PCs
// ════════════════════════════════════════════════════════
let userDataPath = ''

async function initPaths() {
  userDataPath = await window.api.invoke('get-user-data-path')
}

// Make a path relative to userData if it's inside userData, otherwise keep absolute
function makeRelative(absPath) {
  if (!absPath || !userDataPath) return absPath
  const norm = absPath.replace(/\\/g, '/')
  const base = userDataPath.replace(/\\/g, '/')
  if (norm.startsWith(base)) return '::userData::' + norm.slice(base.length)
  return absPath
}

// Resolve a stored path back to absolute
function resolveAssetPath(p) {
  if (!p) return p
  if (p.startsWith('::userData::'))
    return (userDataPath + p.slice('::userData::'.length)).replace(/\\/g, '/')
  return p
}

// Resolve a number folder path
function resolveNumFolder(p) { return resolveAssetPath(p) }

// ════════════════════════════════════════════════════════
// CUSTOM PROMPT MODAL
// ════════════════════════════════════════════════════════
function showPrompt(message) {
  return new Promise(resolve => {
    const overlay = document.createElement('div')
    overlay.style.cssText = [
      'position:fixed','inset:0','background:rgba(0,0,0,0.4)',
      'z-index:9999','display:flex','align-items:center','justify-content:center'
    ].join(';')
    const box = document.createElement('div')
    box.style.cssText = [
      'background:#fff','border-radius:10px','padding:20px',
      'min-width:280px','max-width:400px',
      'box-shadow:0 8px 32px rgba(0,0,0,0.2)',
      "font-family:'Segoe UI',system-ui,sans-serif"
    ].join(';')
    const label = document.createElement('p')
    label.textContent = message
    label.style.cssText = 'margin:0 0 12px;font-size:13px;color:#1a1a1a;font-weight:500'
    const input = document.createElement('input')
    input.type = 'text'
    input.style.cssText = [
      'width:100%','padding:8px 10px','border:1px solid #ddd','border-radius:7px',
      'font-size:13px','font-family:inherit','outline:none',
      'box-sizing:border-box','margin-bottom:14px'
    ].join(';')
    const btnRow = document.createElement('div')
    btnRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end'
    const btnCancel = document.createElement('button')
    btnCancel.textContent = 'Cancel'
    btnCancel.style.cssText = [
      'padding:7px 14px','border:1px solid #ddd','border-radius:7px',
      'background:#fff','font-size:12px','cursor:pointer','font-family:inherit'
    ].join(';')
    const btnOk = document.createElement('button')
    btnOk.textContent = 'OK'
    btnOk.style.cssText = [
      'padding:7px 14px','border:none','border-radius:7px',
      'background:#1a1a2e','color:#fff','font-size:12px','cursor:pointer','font-family:inherit'
    ].join(';')
    const finish = val => { document.body.removeChild(overlay); resolve(val) }
    btnCancel.onclick = () => finish(null)
    btnOk.onclick     = () => finish(input.value.trim() || null)
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter')  finish(input.value.trim() || null)
      if (e.key === 'Escape') finish(null)
    })
    btnRow.appendChild(btnCancel)
    btnRow.appendChild(btnOk)
    box.appendChild(label)
    box.appendChild(input)
    box.appendChild(btnRow)
    overlay.appendChild(box)
    document.body.appendChild(overlay)
    setTimeout(() => input.focus(), 30)
  })
}

// ════════════════════════════════════════════════════════
// TRACK OPEN ACCORDIONS so re-render restores them
// ════════════════════════════════════════════════════════
// Stored as Set of phase.id and Set of riddle.id
const openPhases  = new Set()
const openRiddles = new Set()

// ════════════════════════════════════════════════════════
// BOOT
// ════════════════════════════════════════════════════════
async function boot() {
  await initPaths()
  const saved = await window.api.invoke('state-load')
  if (saved) {
    Object.assign(state, saved)
    if (!state.resetDigits) state.resetDigits = ['6','0','0','0']
    if (!state.numberFolders) state.numberFolders = []
    if (!state.roomNames) state.roomNames = ['Room 1', 'Room 2']
    if (!('managerPassword' in state)) state.managerPassword = ''
    // Migrate old state where numberFolders was inside settings
    if (state.settings.numberFolders) {
      state.numberFolders = state.settings.numberFolders
      delete state.settings.numberFolders
    }
    while (state.rooms.length < 2)
      state.rooms.push({ currentTextHint: '', currentImageHint: '', phases: [] })
  }
  state.timerRunning = false
  state.managerMode  = false   // always log out on app open
  // Clear all active hints on open — only settings persist
  state.rooms.forEach(r => {
    r.currentTextHint  = ''
    r.currentImageHint = ''
  })
  applyTwoRoomsMode(state.twoRooms)
  applyManagerMode(false)
  applyRoomNames()
  // Restore hint sound toggles
  document.querySelectorAll('.chk-hint-sound-on').forEach(chk => {
    const r = parseInt(chk.dataset.room)
    chk.checked = state.rooms[r].hintSoundOn !== false
  })
  renderDigits()
  renderResetDigits()
  renderPhases(0)
  renderPhases(1)
  applyAllSettings()
  refreshPresetList()
  populateAudioDevices()
  populateDisplayPickers()
  validateNumberFolders()
  setTimeout(() => {
    window.api.send('timer-tick', { digits: state.digits })
    // Push full style including layout to timer windows
    const s = state.settings
    window.api.send('apply-style', {
      imageMode:    s.imageMode,
      numberFolder: s.imageMode ? resolveNumFolder(s.activeNumFolder) : null,
      fontFamily:   s.imageMode ? null : s.fontFamily,
      timerColor:   s.timerColor,
      bgImage:      s.bgImage ? resolveAssetPath(s.bgImage) : null,
      clearBg:      !s.bgImage,
      layout:       s.timerLayout || null,
      numberSize:   s.numberSize  || 1.0,
    })
    ;[0, 1].forEach(r => {
      if (state.rooms[r].currentTextHint)
        window.api.send('hint-text', { roomIndex: r, text: state.rooms[r].currentTextHint })
      if (state.rooms[r].currentImageHint)
        window.api.send('hint-image', { roomIndex: r, src: state.rooms[r].currentImageHint })
    })
  }, 1200)
}

let saveTimer = null
function scheduleSave() {
  // If a preset is active, sync current settings back into it automatically
  if (state.activePresetIndex !== null && state.presets[state.activePresetIndex]) {
    state.presets[state.activePresetIndex].settings = JSON.parse(JSON.stringify(state.settings))
  }
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    const toSave = JSON.parse(JSON.stringify(state))
    toSave.timerRunning = false
    window.api.invoke('state-save', toSave)
  }, 600)
}

// ════════════════════════════════════════════════════════
// TIMER ENGINE
// ════════════════════════════════════════════════════════
let timerInterval = null

function digitsToSeconds(d) {
  return (parseInt(d[0])*10 + parseInt(d[1])) * 60
       + (parseInt(d[2])*10 + parseInt(d[3]))
}
function secondsToDigits(s) {
  const mm = Math.floor(s / 60), ss = s % 60
  return [String(Math.floor(mm/10)), String(mm%10),
          String(Math.floor(ss/10)), String(ss%10)]
}

// Track active audio so we can stop them on reset
let countdownAudio = null
let gameoverAudio  = null

function stopCountdownAudio() {
  if (countdownAudio) {
    try { countdownAudio.pause(); countdownAudio.currentTime = 0 } catch {}
    countdownAudio = null
  }
}
function stopGameoverAudio() {
  if (gameoverAudio) {
    try { gameoverAudio.pause(); gameoverAudio.currentTime = 0 } catch {}
    gameoverAudio = null
  }
}
function stopAllSounds() {
  stopCountdownAudio()
  stopGameoverAudio()
}

function startTimer() {
  // Always clear any existing interval first — prevents double-ticking
  clearInterval(timerInterval); timerInterval = null
  if (state.timerRunning) return
  state.timerRunning = true

  function tick() {
    if (!state.timerRunning) return
    let secs = digitsToSeconds(state.digits)
    if (secs <= 0) {
      // Already at zero — stop and play gameover after 500ms
      state.timerRunning = false
      timerInterval = null
      stopCountdownAudio()
      setTimeout(() => {
        if (state.settings.gameoverSound) {
          gameoverAudio = new Audio('file:///' + state.settings.gameoverSound.replace(/\\/g, '/'))
          gameoverAudio.play().catch(() => {})
        }
      }, 500)
      return
    }
    secs--
    state.digits = secondsToDigits(secs)
    renderDigits()
    window.api.send('timer-tick', { digits: state.digits })
    // Countdown sound
    const trigger = parseInt(state.settings.countdownTrigger) || 0
    if (trigger > 0 && secs < trigger && secs >= 0 && state.settings.countdownSound) {
      stopCountdownAudio()
      countdownAudio = new Audio('file:///' + state.settings.countdownSound.replace(/\\/g, '/'))
      countdownAudio.play().catch(() => {})
    }
    scheduleSave()
    // Schedule next tick only if still running
    if (state.timerRunning) timerInterval = setTimeout(tick, 1000)
  }

  timerInterval = setTimeout(tick, 1000)
}

function pauseTimer() {
  clearTimeout(timerInterval); timerInterval = null
  state.timerRunning = false
}

function resetTimer() {
  pauseTimer()
  stopAllSounds()
  state.digits = [...state.resetDigits]
  renderDigits()
  window.api.send('timer-tick', { digits: state.digits })
  scheduleSave()
}

document.getElementById('btn-start').onclick = () => { startTimer(); scheduleSave() }
document.getElementById('btn-pause').onclick = () => { pauseTimer(); scheduleSave() }
document.getElementById('btn-reset').onclick = resetTimer

// ── Live timer digits (top +/- controls) ─────────────
// These only change state.digits, NEVER state.resetDigits
function renderDigits() {
  state.digits.forEach((v, i) => {
    document.getElementById('disp' + i).textContent = v
  })
}
document.querySelectorAll('.dc-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const d   = parseInt(btn.dataset.d)
    const dir = parseInt(btn.dataset.dir)
    state.digits[d] = String((parseInt(state.digits[d]) + dir + 10) % 10)
    // NOTE: does NOT touch state.resetDigits
    renderDigits()
    window.api.send('timer-tick', { digits: state.digits })
    // Stop countdown sound if time is now above the trigger threshold
    const trigger = parseInt(state.settings.countdownTrigger) || 0
    const secs = digitsToSeconds(state.digits)
    if (trigger > 0 && secs >= trigger) stopCountdownAudio()
    scheduleSave()
  })
})

// ── Reset time text input (MM:SS) ────────────────────
function renderResetDigits() {
  const mm = state.resetDigits[0] + state.resetDigits[1]
  const ss = state.resetDigits[2] + state.resetDigits[3]
  const inp = document.getElementById('reset-time-input')
  if (inp) inp.value = mm + ':' + ss
  const lbl = document.getElementById('lbl-reset-current')
  if (lbl) lbl.textContent = 'current: ' + mm + ':' + ss
}

function applyResetTimeInput() {
  const inp = document.getElementById('reset-time-input')
  if (!inp) return
  const val = inp.value.trim()
  // Accept formats: MM:SS or MMSS or M:SS
  const match = val.match(/^(\d{1,2}):?(\d{2})$/)
  if (!match) {
    inp.style.borderColor = '#c44'
    return
  }
  inp.style.borderColor = ''
  const mm = match[1].padStart(2, '0')
  const ss = match[2]
  if (parseInt(ss) > 59) { inp.style.borderColor = '#c44'; return }
  state.resetDigits = [mm[0], mm[1], ss[0], ss[1]]
  renderResetDigits()
  scheduleSave()
}

const resetInput = document.getElementById('reset-time-input')
if (resetInput) {
  // Auto-insert colon for usability
  resetInput.addEventListener('input', e => {
    let v = e.target.value.replace(/[^0-9:]/g, '')
    if (v.length === 2 && !v.includes(':')) v = v + ':'
    e.target.value = v
  })
  resetInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') applyResetTimeInput()
  })
}
const resetApplyBtn = document.getElementById('btn-reset-apply')
if (resetApplyBtn) resetApplyBtn.onclick = applyResetTimeInput

// ════════════════════════════════════════════════════════
// 2-ROOM MODE
// ════════════════════════════════════════════════════════
function applyTwoRoomsMode(on) {
  state.twoRooms = on
  document.getElementById('chk-two-rooms').checked = on
  document.getElementById('rooms-container').className = on ? 'two-rooms' : 'one-room'
  // Show/hide room-2 device rows in settings
  const r2rows = ['row-room2-audio', 'row-room2-display']
  r2rows.forEach(id => {
    const el = document.getElementById(id)
    if (el) el.style.display = on ? 'flex' : 'none'
  })
  window.api.send('set-room-count', { count: on ? 2 : 1 })
}
document.getElementById('chk-two-rooms').onchange = e => {
  applyTwoRoomsMode(e.target.checked)
  scheduleSave()
}

// ════════════════════════════════════════════════════════
// MANAGER MODE — password protected
// ════════════════════════════════════════════════════════

// Auto-logout after 1 hour of manager mode
let managerLogoutTimer = null
function resetManagerLogoutTimer() {
  clearTimeout(managerLogoutTimer)
  managerLogoutTimer = setTimeout(() => {
    if (state.managerMode) {
      state.managerMode = false
      applyManagerMode()
      scheduleSave()
    }
  }, 60 * 60 * 1000) // 1 hour
}

function applyManagerMode(rerender = true) {
  const on = state.managerMode
  document.body.classList.toggle('manager-mode', on)
  const btn = document.getElementById('btn-manager-toggle')
  if (btn) {
    btn.textContent = on ? '🔓 Manager Mode' : '🔒 Manager Mode'
    btn.style.background = on ? '#0F6E56' : '#1a1a2e'
    btn.style.borderColor = on ? '#0F6E56' : '#1a1a2e'
  }
  // Settings section visibility
  const ss = document.getElementById('styles-sounds')
  if (ss) ss.style.display = on ? '' : 'none'
  // Add phase buttons
  document.querySelectorAll('.btn-add-phase').forEach(b => {
    b.style.display = on ? 'inline-block' : 'none'
  })
  // Room name inputs — show input, hide label in manager mode
  ;[0, 1].forEach(r => {
    const lbl = document.getElementById('room-name-' + r)
    const inp = document.getElementById('room-name-input-' + r)
    if (lbl) lbl.style.display = on ? 'none' : ''
    if (inp) inp.style.display = on ? 'block' : 'none'
  })
  if (rerender) { renderPhases(0); renderPhases(1) }
}

// Show password modal — returns entered value or null
function showPasswordPrompt(title, placeholder, extraBtn) {
  return new Promise(resolve => {
    const overlay = document.createElement('div')
    overlay.style.cssText = [
      'position:fixed','inset:0','background:rgba(0,0,0,0.5)',
      'z-index:9999','display:flex','align-items:center','justify-content:center'
    ].join(';')
    const box = document.createElement('div')
    box.style.cssText = [
      'background:#fff','border-radius:12px','padding:24px',
      'min-width:300px','max-width:420px',
      'box-shadow:0 8px 40px rgba(0,0,0,0.25)',
      "font-family:'Segoe UI',system-ui,sans-serif"
    ].join(';')
    const ttl = document.createElement('p')
    ttl.textContent = title
    ttl.style.cssText = 'margin:0 0 14px;font-size:14px;font-weight:600;color:#1a1a1a'
    const inp = document.createElement('input')
    inp.type = 'password'
    inp.placeholder = placeholder || 'Password'
    inp.style.cssText = [
      'width:100%','padding:9px 11px','border:1px solid #ddd','border-radius:7px',
      'font-size:14px','font-family:inherit','outline:none',
      'box-sizing:border-box','margin-bottom:16px'
    ].join(';')
    const btnRow = document.createElement('div')
    btnRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end'
    const btnCancel = document.createElement('button')
    btnCancel.textContent = 'Cancel'
    btnCancel.style.cssText = 'padding:8px 16px;border:1px solid #ddd;border-radius:7px;background:#fff;font-size:13px;cursor:pointer;font-family:inherit'
    const btnOk = document.createElement('button')
    btnOk.textContent = 'OK'
    btnOk.style.cssText = 'padding:8px 16px;border:none;border-radius:7px;background:#1a1a2e;color:#fff;font-size:13px;cursor:pointer;font-family:inherit'
    const finish = val => { document.body.removeChild(overlay); resolve(val) }
    btnCancel.onclick = () => finish(null)
    btnOk.onclick     = () => finish(inp.value)
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter')  finish(inp.value)
      if (e.key === 'Escape') finish(null)
    })
    btnRow.appendChild(btnCancel)
    if (extraBtn) btnRow.appendChild(extraBtn)
    btnRow.appendChild(btnOk)
    box.appendChild(ttl); box.appendChild(inp); box.appendChild(btnRow)
    overlay.appendChild(box)
    document.body.appendChild(overlay)
    setTimeout(() => inp.focus(), 30)
  })
}

async function changePassword() {
  const oldPw = await showPasswordPrompt('Enter current password:')
  if (oldPw === null) return
  if (oldPw !== state.managerPassword) {
    await showPrompt('Incorrect password.')
    return
  }
  const newPw = await showPasswordPrompt('Enter new password:')
  if (newPw === null) return
  if (!newPw.trim()) { await showPrompt('Password cannot be empty.'); return }
  const confirm = await showPasswordPrompt('Confirm new password:')
  if (confirm !== newPw) { await showPrompt('Passwords do not match.'); return }
  state.managerPassword = newPw
  scheduleSave()
  await showPrompt('Password changed successfully.')
}

document.getElementById('btn-manager-toggle').onclick = async () => {
  if (state.managerMode) {
    // Turn off manager mode
    state.managerMode = false
    applyManagerMode()
    scheduleSave()
    return
  }
  // Turn on — need password
  if (!state.managerPassword) {
    // First time — set a password
    const pw1 = await showPasswordPrompt('No password set. Create a manager password:')
    if (!pw1 || !pw1.trim()) return
    const pw2 = await showPasswordPrompt('Confirm password:')
    if (pw1 !== pw2) { await showPrompt('Passwords do not match.'); return }
    state.managerPassword = pw1
    scheduleSave()
    state.managerMode = true
    applyManagerMode()
    scheduleSave()
    return
  }
  // Password is set — show prompt with Change Password button
  const changePwBtn = document.createElement('button')
  changePwBtn.textContent = 'Change Password'
  changePwBtn.style.cssText = 'padding:8px 16px;border:1px solid #888;border-radius:7px;background:#fff;font-size:13px;cursor:pointer;font-family:inherit'
  let overlayRef = null
  // We need a way to close the current prompt before opening the change flow.
  // Attach a flag to the button so showPasswordPrompt can detect it.
  changePwBtn.dataset.action = 'change'
  const pw = await new Promise(resolve => {
    changePwBtn.onclick = async () => {
      // Remove the current overlay
      const overlays = document.querySelectorAll('[data-pw-overlay]')
      overlays.forEach(o => o.remove())
      resolve('__change__')
    }
    showPasswordPrompt('Enter manager password:', 'Password', changePwBtn).then(resolve)
  })
  if (pw === null) return
  if (pw === '__change__') { await changePassword(); return }
  if (pw !== state.managerPassword) {
    await showPrompt('Incorrect password.')
    return
  }
  state.managerMode = true
  applyManagerMode()
  resetManagerLogoutTimer()
  scheduleSave()
}

// ════════════════════════════════════════════════════════
// ROOM NAMES
// ════════════════════════════════════════════════════════
function applyRoomNames() {
  ;[0, 1].forEach(r => {
    const name = state.roomNames[r] || ('Room ' + (r + 1))
    const lbl  = document.getElementById('room-name-' + r)
    const inp  = document.getElementById('room-name-input-' + r)
    if (lbl) lbl.textContent = name
    if (inp) inp.value = name
  })
}

;[0, 1].forEach(r => {
  const inp = document.getElementById('room-name-input-' + r)
  if (!inp) return
  inp.addEventListener('input', () => {
    state.roomNames[r] = inp.value || ('Room ' + (r + 1))
    const lbl = document.getElementById('room-name-' + r)
    if (lbl) lbl.textContent = state.roomNames[r]
    scheduleSave()
  })
})

// ════════════════════════════════════════════════════════
// FULLSCREEN
// ════════════════════════════════════════════════════════
document.getElementById('btn-fs-0').onclick = () =>
  window.api.send('toggle-fullscreen', { roomIndex: 0 })
document.getElementById('btn-fs-1').onclick = () =>
  window.api.send('toggle-fullscreen', { roomIndex: 1 })

// ════════════════════════════════════════════════════════
// TEXT HINTS
// ════════════════════════════════════════════════════════
document.querySelectorAll('.btn-hint-send').forEach(btn => {
  btn.onclick = () => sendTextHint(parseInt(btn.dataset.room))
})
document.querySelectorAll('.btn-hint-del').forEach(btn => {
  btn.onclick = () => deleteTextHint(parseInt(btn.dataset.room))
})
document.querySelectorAll('.hint-input').forEach(inp => {
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') sendTextHint(parseInt(inp.dataset.room))
  })
})
function sendTextHint(roomIndex) {
  const inp  = document.querySelector(`.hint-input[data-room='${roomIndex}']`)
  const text = inp.value.trim()
  if (!text) return
  state.rooms[roomIndex].currentTextHint = text
  window.api.send('hint-text', { roomIndex, text })
  if (state.rooms[roomIndex].hintSoundOn !== false)
    playSound(state.settings.hintSound, roomIndex)
  scheduleSave()
}
function deleteTextHint(roomIndex) {
  const inp = document.querySelector(`.hint-input[data-room='${roomIndex}']`)
  inp.value = ''
  state.rooms[roomIndex].currentTextHint = ''
  window.api.send('hint-text', { roomIndex, text: '' })
  scheduleSave()
}

// ════════════════════════════════════════════════════════
// HINT SOUND CONTROLS (per room, not behind manager mode)
// ════════════════════════════════════════════════════════
document.querySelectorAll('.chk-hint-sound-on').forEach(chk => {
  const r = parseInt(chk.dataset.room)
  chk.checked = state.rooms[r].hintSoundOn !== false
  chk.onchange = () => {
    state.rooms[r].hintSoundOn = chk.checked
    scheduleSave()
  }
})
document.querySelectorAll('.btn-test-hint-sound').forEach(btn => {
  btn.onclick = () => {
    if (state.settings.hintSound)
      playSound(state.settings.hintSound, parseInt(btn.dataset.room))
  }
})

// ════════════════════════════════════════════════════════
// REMOVE HINT
// ════════════════════════════════════════════════════════
document.querySelectorAll('.btn-remove-hint').forEach(btn => {
  btn.onclick = () => removeActiveImageHint(parseInt(btn.dataset.room))
})

document.querySelectorAll('.btn-remove-all').forEach(btn => {
  btn.onclick = () => {
    const roomIndex = parseInt(btn.dataset.room)
    // Clear text hint
    const inp = document.querySelector(`.hint-input[data-room='${roomIndex}']`)
    if (inp) inp.value = ''
    state.rooms[roomIndex].currentTextHint  = ''
    state.rooms[roomIndex].currentImageHint = ''
    window.api.send('hint-text',  { roomIndex, text: '' })
    window.api.send('hint-clear', { roomIndex })
    document.querySelectorAll(`#phases-${roomIndex} .hint-thumb.selected`)
      .forEach(el => el.classList.remove('selected'))
    scheduleSave()
  }
})
function removeActiveImageHint(roomIndex) {
  state.rooms[roomIndex].currentImageHint = ''
  document.querySelectorAll(`#phases-${roomIndex} .hint-thumb.selected`)
    .forEach(el => el.classList.remove('selected'))
  window.api.send('hint-clear', { roomIndex })
  scheduleSave()
}

// ════════════════════════════════════════════════════════
// PICTURE HINTS — Phase > Riddle > Images
// ════════════════════════════════════════════════════════
function genId() { return '_' + Math.random().toString(36).slice(2, 9) }

document.getElementById('phases-0').parentElement
  .querySelector('.btn-add-phase').addEventListener('click', () => addPhase(0))
document.getElementById('phases-1').parentElement
  .querySelector('.btn-add-phase').addEventListener('click', () => addPhase(1))

async function addPhase(roomIndex) {
  const name = await showPrompt('Phase name:')
  if (!name) return
  state.rooms[roomIndex].phases.push({ id: genId(), name, riddles: [] })
  renderPhases(roomIndex)
  scheduleSave()
}

function renderPhases(roomIndex) {
  const container = document.getElementById('phases-' + roomIndex)
  container.innerHTML = ''
  state.rooms[roomIndex].phases.forEach(phase => {
    container.appendChild(buildPhaseEl(phase, roomIndex))
  })
}

function managerBtn(label) {
  const btn = document.createElement('button')
  btn.textContent = label
  btn.style.cssText = [
    'padding:4px 9px','font-size:11px','border:1px solid #ddd',
    'border-radius:6px','background:#fff','cursor:pointer',
    'font-family:inherit','margin:5px 0',
    'display:' + (state.managerMode ? 'inline-block' : 'none')
  ].join(';')
  return btn
}

function buildPhaseEl(phase, roomIndex) {
  const wrap = document.createElement('div')
  wrap.className = 'phase-item'

  const hdr = document.createElement('div')
  hdr.className = 'phase-header'
  hdr.style.cursor = 'pointer'

  const toggle = document.createElement('span')
  toggle.className = 'phase-toggle'
  toggle.textContent = '▶'

  const nameEl = document.createElement('span')
  nameEl.className = 'phase-name'
  nameEl.textContent = phase.name

  const delBtn = managerBtn('✕')
  delBtn.style.color = '#c44'
  delBtn.onclick = async e => {
    e.stopPropagation()
    const confirmed = await showPrompt(`Type DELETE to confirm removing "${phase.name}":`)
    if (confirmed !== 'DELETE') return
    state.rooms[roomIndex].phases = state.rooms[roomIndex].phases.filter(p => p.id !== phase.id)
    openPhases.delete(phase.id)
    renderPhases(roomIndex)
    scheduleSave()
  }

  const body = document.createElement('div')
  body.className = 'phase-body'

  // Restore open state
  if (openPhases.has(phase.id)) {
    body.classList.add('open')
    toggle.classList.add('open')
  }

  hdr.addEventListener('click', e => {
    if (e.target === delBtn) return
    const open = body.classList.toggle('open')
    toggle.classList.toggle('open', open)
    // Track open state so re-render preserves it
    if (open) openPhases.add(phase.id)
    else openPhases.delete(phase.id)
  })

  hdr.appendChild(toggle)
  hdr.appendChild(nameEl)
  hdr.appendChild(delBtn)

  const addRiddleBtn = managerBtn('+ Add Riddle')
  addRiddleBtn.onclick = async () => {
    const name = await showPrompt('Riddle name:')
    if (!name) return
    phase.riddles.push({ id: genId(), name, hints: [] })
    openPhases.add(phase.id)  // keep phase open after adding riddle
    renderPhases(roomIndex)
    scheduleSave()
  }
  body.appendChild(addRiddleBtn)

  phase.riddles.forEach(riddle => {
    body.appendChild(buildRiddleEl(riddle, phase, roomIndex))
  })

  wrap.appendChild(hdr)
  wrap.appendChild(body)
  return wrap
}

function buildRiddleEl(riddle, phase, roomIndex) {
  const wrap = document.createElement('div')
  wrap.className = 'riddle-item'

  const hdr = document.createElement('div')
  hdr.className = 'riddle-header'
  hdr.style.cursor = 'pointer'

  const toggle = document.createElement('span')
  toggle.className = 'riddle-toggle'
  toggle.textContent = '▶'

  const nameEl = document.createElement('span')
  nameEl.className = 'riddle-name'
  nameEl.textContent = riddle.name

  const delBtn = managerBtn('✕')
  delBtn.style.color = '#c44'
  delBtn.onclick = async e => {
    e.stopPropagation()
    const confirmed = await showPrompt(`Type DELETE to confirm removing "${riddle.name}":`)
    if (confirmed !== 'DELETE') return
    phase.riddles = phase.riddles.filter(r => r.id !== riddle.id)
    openRiddles.delete(riddle.id)
    renderPhases(roomIndex)
    scheduleSave()
  }

  const body = document.createElement('div')
  body.className = 'riddle-body'

  // Restore open state
  if (openRiddles.has(riddle.id)) {
    body.classList.add('open')
    toggle.classList.add('open')
  }

  hdr.addEventListener('click', e => {
    if (e.target === delBtn) return
    const open = body.classList.toggle('open')
    toggle.classList.toggle('open', open)
    if (open) openRiddles.add(riddle.id)
    else openRiddles.delete(riddle.id)
  })

  hdr.appendChild(toggle)
  hdr.appendChild(nameEl)
  hdr.appendChild(delBtn)

  // Add Hint — file picker, multiple selection allowed
  const addHintBtn = managerBtn('+ Add Hint')
  addHintBtn.onclick = () => {
    const inp = document.createElement('input')
    inp.type = 'file'
    inp.accept = 'image/*'
    inp.multiple = true
    inp.onchange = e => {
      Array.from(e.target.files).forEach(file => {
        if (!riddle.hints.includes(file.path)) riddle.hints.push(file.path)
      })
      // Keep both phase AND riddle open after adding images
      openPhases.add(phase.id)
      openRiddles.add(riddle.id)
      renderPhases(roomIndex)
      scheduleSave()
    }
    inp.click()
  }
  body.appendChild(addHintBtn)

  const thumbs = document.createElement('div')
  thumbs.className = 'hint-thumbs'

  // dragSrc at riddle scope — shared across all images
  let dragSrc = null

  riddle.hints.forEach((imgPath, idx) => {
    const src = 'file:///' + imgPath.replace(/\\/g, '/')

    // Wrapper div holds the image and the delete button
    const wrap = document.createElement('div')
    wrap.className = 'hint-thumb-wrap'
    wrap.dataset.idx = idx

    const img = document.createElement('img')
    img.className = 'hint-thumb'
    img.src = src
    img.dataset.idx = idx
    if (state.rooms[roomIndex].currentImageHint === src) img.classList.add('selected')

    img.addEventListener('click', () => {
      document.querySelectorAll(`#phases-${roomIndex} .hint-thumb.selected`)
        .forEach(el => el.classList.remove('selected'))
      img.classList.add('selected')
      state.rooms[roomIndex].currentImageHint = src
      window.api.send('hint-image', { roomIndex, src })
      if (state.rooms[roomIndex].hintSoundOn !== false)
        playSound(state.settings.hintSound, roomIndex)
      scheduleSave()
    })

    // Delete button (top-right corner, manager mode only via CSS)
    const delBtn = document.createElement('button')
    delBtn.className = 'hint-thumb-del'
    delBtn.textContent = '✕'
    delBtn.title = 'Delete image'
    delBtn.addEventListener('click', e => {
      e.stopPropagation()
      riddle.hints.splice(idx, 1)
      // If deleted image was the active hint, clear it
      if (state.rooms[roomIndex].currentImageHint === src) {
        state.rooms[roomIndex].currentImageHint = ''
        window.api.send('hint-clear', { roomIndex })
      }
      openPhases.add(phase.id)
      openRiddles.add(riddle.id)
      renderPhases(roomIndex)
      scheduleSave()
    })

    // Drag on the wrapper so the whole tile drags
    wrap.draggable = true
    wrap.addEventListener('dragstart', e => {
      if (!state.managerMode) { e.preventDefault(); return }
      dragSrc = idx
      setTimeout(() => { wrap.style.opacity = '0.4' }, 0)
    })
    wrap.addEventListener('dragend', () => {
      wrap.style.opacity = '1'
      thumbs.querySelectorAll('.drag-placeholder').forEach(el => el.remove())
    })

    wrap.appendChild(img)
    wrap.appendChild(delBtn)
    thumbs.appendChild(wrap)
  })

  // Attach dragover and drop to the CONTAINER, not individual images.
  // This way the placeholder div never steals the drop target.
  thumbs.addEventListener('dragover', e => {
    if (!state.managerMode || dragSrc === null) return
    e.preventDefault()
    // Find which image we are hovering over by hit-testing
    const imgs = [...thumbs.querySelectorAll('.hint-thumb-wrap')]
    let targetImg = null
    for (const im of imgs) {
      const r = im.getBoundingClientRect()
      if (e.clientX >= r.left && e.clientX <= r.right &&
          e.clientY >= r.top  && e.clientY <= r.bottom) {
        targetImg = im; break
      }
    }
    thumbs.querySelectorAll('.drag-placeholder').forEach(el => el.remove())
    if (!targetImg || parseInt(targetImg.dataset.idx) === dragSrc) return
    const ph = document.createElement('div')
    ph.className = 'drag-placeholder'
    const targetIdx = parseInt(targetImg.dataset.idx)
    if (targetIdx > dragSrc) thumbs.insertBefore(ph, targetImg.nextSibling)
    else thumbs.insertBefore(ph, targetImg)
  })

  thumbs.addEventListener('dragleave', e => {
    if (!thumbs.contains(e.relatedTarget))
      thumbs.querySelectorAll('.drag-placeholder').forEach(el => el.remove())
  })

  thumbs.addEventListener('drop', e => {
    e.preventDefault()
    thumbs.querySelectorAll('.drag-placeholder').forEach(el => el.remove())
    if (dragSrc === null) return
    // Find drop target image by position
    const imgs = [...thumbs.querySelectorAll('.hint-thumb-wrap')]
    let dropIdx = null
    for (const im of imgs) {
      const r = im.getBoundingClientRect()
      if (e.clientX >= r.left && e.clientX <= r.right &&
          e.clientY >= r.top  && e.clientY <= r.bottom) {
        dropIdx = parseInt(im.dataset.idx); break
      }
    }
    if (dropIdx === null || dropIdx === dragSrc) { dragSrc = null; return }
    const moved = riddle.hints.splice(dragSrc, 1)[0]
    riddle.hints.splice(dropIdx, 0, moved)
    dragSrc = null
    openPhases.add(phase.id)
    openRiddles.add(riddle.id)
    renderPhases(roomIndex)
    scheduleSave()
  })

  body.appendChild(thumbs)
  wrap.appendChild(hdr)
  wrap.appendChild(body)
  return wrap
}

// ════════════════════════════════════════════════════════
// SETTINGS
// ════════════════════════════════════════════════════════
const chkNumImages = document.getElementById('chk-num-images')
const numImgOn     = document.getElementById('num-img-on')
const numImgOff    = document.getElementById('num-img-off')
const selNumFolder = document.getElementById('sel-num-folder')

function normPath(p) { return (p || '').replace(/\\/g, '/').toLowerCase() }

function refreshNumFolderList() {
  selNumFolder.innerHTML = '<option value="">— choose folder —</option>'
  state.numberFolders.forEach(f => {
    const opt = document.createElement('option')
    opt.value = f.path  // store relative
    opt.textContent = f.name
    if (normPath(f.path) === normPath(state.settings.activeNumFolder)) opt.selected = true
    selNumFolder.appendChild(opt)
  })
}

chkNumImages.onchange = e => {
  state.settings.imageMode = e.target.checked
  numImgOn.style.display  = e.target.checked ? 'flex' : 'none'
  numImgOff.style.display = e.target.checked ? 'none' : 'flex'
  window.api.send('apply-style', {
    imageMode:    e.target.checked,
    numberFolder: e.target.checked ? state.settings.activeNumFolder : null,
    fontFamily:   e.target.checked ? null : state.settings.fontFamily
  })
  scheduleSave()
}
selNumFolder.onchange = e => {
  const val = e.target.value
  state.settings.activeNumFolder = val
  if (!val) {
    // No folder selected — turn image mode off, timer shows errors
    state.settings.imageMode = false
    chkNumImages.checked = false
    numImgOn.style.display  = 'none'
    numImgOff.style.display = 'flex'
    window.api.send('apply-style', { imageMode: false, numberFolder: null })
  } else {
    window.api.send('apply-style', { numberFolder: resolveNumFolder(val) })
  }
  scheduleSave()
}
document.getElementById('btn-new-num-folder').onclick = async () => {
  const name = await showPrompt('Name for this number style:')
  if (!name) return
  // Always create inside assets/number-styles — no folder picker needed
  const base = await window.api.invoke('get-number-styles-dir')
  const full = await window.api.invoke('create-named-folder', base, name)
  const relFull = makeRelative(full)
  state.numberFolders.push({ name, path: relFull })
  state.settings.activeNumFolder = relFull
  refreshNumFolderList()
  await window.api.invoke('reveal-folder', full)
  scheduleSave()
}
document.getElementById('btn-open-num-folder').onclick = async () => {
  if (state.settings.activeNumFolder)
    await window.api.invoke('reveal-folder', resolveAssetPath(state.settings.activeNumFolder))
}

// Delete selected number folder from the list
document.getElementById('btn-del-num-folder').onclick = async () => {
  const active = state.settings.activeNumFolder
  if (!active) return
  const folder = state.numberFolders.find(f => f.path === active)
  if (!folder) return
  const confirmed = await showPrompt(`Type DELETE to remove folder "${folder.name}" from list:`)
  if (confirmed !== 'DELETE') return
  state.numberFolders = state.numberFolders.filter(f => f.path !== active)
  state.settings.activeNumFolder = ''
  state.settings.imageMode = false
  chkNumImages.checked = false
  numImgOn.style.display  = 'none'
  numImgOff.style.display = 'flex'
  window.api.send('apply-style', { imageMode: false, numberFolder: null })
  refreshNumFolderList()
  scheduleSave()
}

// Validate number folders on boot — remove any whose path no longer exists
async function validateNumberFolders() {
  const valid = []
  for (const f of state.numberFolders) {
    const resolved = resolveAssetPath(f.path)
    const exists = await window.api.invoke('check-folder-exists', resolved)
    if (exists) valid.push(f)
  }
  if (valid.length !== state.numberFolders.length) {
    state.numberFolders = valid
    // If active folder was removed, clear it
    const stillActive = valid.find(f => f.path === state.settings.activeNumFolder)
    if (!stillActive) {
      state.settings.activeNumFolder = ''
      state.settings.imageMode = false
    }
    refreshNumFolderList()
    scheduleSave()
  }
}
document.getElementById('sel-font').onchange = e => {
  state.settings.fontFamily = e.target.value
  window.api.send('apply-style', { fontFamily: e.target.value })
  scheduleSave()
}

// ── Number size +/- ──────────────────────────────────
function applyNumberSize(size) {
  state.settings.numberSize = Math.round(size * 10) / 10
  document.getElementById('lbl-numsize').textContent =
    state.settings.numberSize.toFixed(1) + '×'
  window.api.send('apply-style', { numberSize: state.settings.numberSize })
  scheduleSave()
}
document.getElementById('btn-numsize-up').onclick = () =>
  applyNumberSize((state.settings.numberSize || 1.0) + 0.1)
document.getElementById('btn-numsize-down').onclick = () =>
  applyNumberSize(Math.max(0.1, (state.settings.numberSize || 1.0) - 0.1))

document.getElementById('btn-bg-image').onclick = () => {
  const inp = document.createElement('input')
  inp.type = 'file'; inp.accept = 'image/*'
  inp.onchange = e => {
    const file = e.target.files[0]
    if (!file) return
    state.settings.bgImage = file.path
    window.api.send('apply-style', { bgImage: file.path })
    scheduleSave()
  }
  inp.click()
}
document.getElementById('btn-bg-clear').onclick = () => {
  state.settings.bgImage = ''
  window.api.send('apply-style', { clearBg: true })
  scheduleSave()
}
const colorPicker = document.getElementById('sel-timer-color')
const colorLabel  = document.getElementById('lbl-timer-color')
colorPicker.oninput = e => {
  const hex = e.target.value
  colorLabel.textContent = hex
  state.settings.timerColor = hex
  window.api.send('apply-style', { timerColor: hex })
  scheduleSave()
}

const SOUND_CLEAR_BTNS = {
  hintSound: 'btn-hint-sound-clear',
  gameoverSound: 'btn-gameover-sound-clear',
  countdownSound: 'btn-countdown-sound-clear',
}
function pickSound(labelId, stateKey) {
  const inp = document.createElement('input')
  inp.type = 'file'; inp.accept = 'audio/*'
  inp.onchange = e => {
    const file = e.target.files[0]
    if (!file) return
    state.settings[stateKey] = makeRelative(file.path)
    document.getElementById(labelId).textContent = file.name
    const clearBtn = SOUND_CLEAR_BTNS[stateKey]
    if (clearBtn) document.getElementById(clearBtn).style.display = 'inline-block'
    scheduleSave()
  }
  inp.click()
}
document.getElementById('btn-hint-sound').onclick =
  () => pickSound('lbl-hint-sound', 'hintSound')
document.getElementById('btn-gameover-sound').onclick =
  () => pickSound('lbl-gameover-sound', 'gameoverSound')
document.getElementById('btn-countdown-sound').onclick =
  () => pickSound('lbl-countdown-sound', 'countdownSound')

// Sound clear buttons
function clearSound(labelId, clearBtnId, stateKey) {
  state.settings[stateKey] = ''
  document.getElementById(labelId).textContent = 'No file'
  document.getElementById(clearBtnId).style.display = 'none'
  scheduleSave()
}
document.getElementById('btn-hint-sound-clear').onclick =
  () => clearSound('lbl-hint-sound', 'btn-hint-sound-clear', 'hintSound')
document.getElementById('btn-gameover-sound-clear').onclick =
  () => clearSound('lbl-gameover-sound', 'btn-gameover-sound-clear', 'gameoverSound')
document.getElementById('btn-countdown-sound-clear').onclick =
  () => clearSound('lbl-countdown-sound', 'btn-countdown-sound-clear', 'countdownSound')

document.getElementById('inp-countdown-trigger').oninput = e => {
  state.settings.countdownTrigger = parseInt(e.target.value) || 0
  scheduleSave()
}

async function populateAudioDevices() {
  const devices = await navigator.mediaDevices.enumerateDevices()
  const outputs = devices.filter(d => d.kind === 'audiooutput')

  // Ensure audioDeviceIds is always a 2-element array of arrays
  if (!Array.isArray(state.settings.audioDeviceIds[0]))
    state.settings.audioDeviceIds = [[], []]

  ;[0, 1].forEach(roomIdx => {
    const list = document.getElementById('audio-device-list-' + roomIdx)
    if (!list) return
    list.innerHTML = ''
    outputs.forEach(dev => {
      const row = document.createElement('div')
      row.className = 'audio-device-item'
      const chk = document.createElement('input')
      chk.type = 'checkbox'; chk.value = dev.deviceId
      chk.checked = (state.settings.audioDeviceIds[roomIdx] || []).includes(dev.deviceId)
      chk.onchange = () => {
        state.settings.audioDeviceIds[roomIdx] =
          [...list.querySelectorAll('input:checked')].map(i => i.value)
        scheduleSave()
      }
      const lbl = document.createElement('label')
      lbl.textContent = dev.label || 'Output ' + dev.deviceId.slice(0, 6)
      row.appendChild(chk); row.appendChild(lbl)
      list.appendChild(row)
    })
  })
}

async function populateDisplayPickers() {
  const displays = await window.api.invoke('get-displays')
  if (!Array.isArray(state.settings.displayMirrors))
    state.settings.displayMirrors = [[], []]

  ;[0, 1].forEach(roomIdx => {
    const list = document.getElementById('display-device-list-' + roomIdx)
    if (!list) return
    list.innerHTML = ''
    const selected = state.settings.displayMirrors[roomIdx] || []
    displays.forEach(d => {
      const row = document.createElement('div')
      row.className = 'audio-device-item'
      const chk = document.createElement('input')
      chk.type = 'checkbox'
      chk.value = d.index
      chk.checked = selected.includes(d.index)
      chk.onchange = () => {
        state.settings.displayMirrors[roomIdx] =
          [...list.querySelectorAll('input:checked')].map(i => parseInt(i.value))
        // Move the window to the first selected display
        const indices = state.settings.displayMirrors[roomIdx]
        if (indices.length) {
          window.api.send('set-display-mirrors', {
            roomIndex: roomIdx, displayIndices: indices
          })
        }
        scheduleSave()
      }
      const lbl = document.createElement('label')
      lbl.textContent = d.label
      row.appendChild(chk)
      row.appendChild(lbl)
      list.appendChild(row)
    })
  })
}

// Send sound to a specific room's timer window with its assigned device
function playSound(filePath, roomIndex = -1) {
  if (!filePath) return
  filePath = resolveAssetPath(filePath)
  if (roomIndex >= 0) {
    // Route through the timer window so it uses the room's audio device
    const deviceIds = state.settings.audioDeviceIds[roomIndex] || []
    const deviceId  = deviceIds[0] || ''
    window.api.send('play-sound', { roomIndex, filePath, deviceId })
  } else {
    // Broadcast to all active rooms (e.g. game-over, countdown)
    const rooms = state.twoRooms ? [0, 1] : [0]
    rooms.forEach(r => {
      const deviceIds = state.settings.audioDeviceIds[r] || []
      window.api.send('play-sound', { roomIndex: r, filePath, deviceId: deviceIds[0] || '' })
    })
  }
}

// ════════════════════════════════════════════════════════
// PRESETS
// ════════════════════════════════════════════════════════

// Default blank settings — used when creating a new preset from scratch
const DEFAULT_SETTINGS = {
  imageMode:        false,
  activeNumFolder:  '',
  fontFamily:       'Courier New',
  timerColor:       '#ffffff',
  bgImage:          '',
  hintSound:        '',
  gameoverSound:    '',
  countdownSound:   '',
  countdownTrigger: 0,
  audioDeviceIds:   [[], []],
  displayIndex:     [0, 1],
  displayMirrors:   [[], []],
  timerLayout:      null,
  numberSize:       1.0,
}

function refreshPresetList() {
  const sel = document.getElementById('sel-preset')
  sel.innerHTML = '<option value="">— no preset —</option>'
  state.presets.forEach((p, i) => {
    const opt = document.createElement('option')
    opt.value = i
    opt.textContent = p.name
    if (i === state.activePresetIndex) opt.selected = true
    sel.appendChild(opt)
  })
  // Update the indicator showing which preset is active
  const lbl = document.getElementById('lbl-active-preset')
  if (lbl) {
    const p = state.presets[state.activePresetIndex]
    lbl.textContent = p ? `Editing: ${p.name}` : ''
  }
}

// Load a preset — copies its settings into state and applies them
document.getElementById('sel-preset').onchange = e => {
  const idx = parseInt(e.target.value)
  if (isNaN(idx)) {
    state.activePresetIndex = null
    // Reset to clean defaults so the UI reflects a blank state
    state.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
    applyAllSettings()
    populateAudioDevices()
    populateDisplayPickers()
    refreshPresetList()
    scheduleSave()
    return
  }
  state.activePresetIndex = idx
  Object.assign(state.settings, JSON.parse(JSON.stringify(state.presets[idx].settings)))
  // If the saved activeNumFolder path doesn't match any known folder exactly,
  // try to match by folder name (handles app being moved or reinstalled)
  if (state.settings.activeNumFolder) {
    const exact = state.numberFolders.find(
      f => normPath(f.path) === normPath(state.settings.activeNumFolder)
    )
    if (!exact) {
      const savedName = state.settings.activeNumFolder.replace(/\\/g,'/').split('/').pop()
      const byName = state.numberFolders.find(f => f.name === savedName)
      if (byName) state.settings.activeNumFolder = byName.path
    }
  }
  applyAllSettings()
  populateAudioDevices()
  populateDisplayPickers()
  validateNumberFolders()
  refreshPresetList()
  scheduleSave()
}

// Delete the currently active preset
document.getElementById('btn-delete-preset').onclick = async () => {
  if (state.activePresetIndex === null) return
  const p = state.presets[state.activePresetIndex]
  if (!p) return
  const confirmed = await showPrompt(`Type DELETE to confirm removing preset "${p.name}":`)
  if (confirmed !== 'DELETE') return
  state.presets.splice(state.activePresetIndex, 1)
  state.activePresetIndex = null
  refreshPresetList()
  scheduleSave()
}

// Create new preset — resets to defaults first so you build from a clean slate
document.getElementById('btn-create-preset').onclick = async () => {
  const name = await showPrompt('Preset name:')
  if (!name) return
  // Reset to clean defaults
  state.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
  const newIdx = state.presets.length
  state.presets.push({ name, settings: JSON.parse(JSON.stringify(state.settings)) })
  state.activePresetIndex = newIdx
  applyAllSettings()
  populateAudioDevices()
  populateDisplayPickers()
  validateNumberFolders()
  refreshPresetList()
  scheduleSave()
}

function applyAllSettings() {
  const s = state.settings
  chkNumImages.checked = s.imageMode
  numImgOn.style.display  = s.imageMode ? 'flex' : 'none'
  numImgOff.style.display = s.imageMode ? 'none' : 'flex'
  document.getElementById('sel-font').value = s.fontFamily
  const cp = document.getElementById('sel-timer-color')
  const cl = document.getElementById('lbl-timer-color')
  // Handle old keyword values from saved state
  const colorMap = { white:'#ffffff', red:'#ff4444', green:'#5DCAA5', yellow:'#f0c040' }
  const hex = colorMap[s.timerColor] || s.timerColor || '#ffffff'
  if (cp) cp.value = hex
  if (cl) cl.textContent = hex
  document.getElementById('lbl-hint-sound').textContent =
    s.hintSound ? s.hintSound.split(/[/\\]/).pop() : 'No file'
  document.getElementById('btn-hint-sound-clear').style.display =
    s.hintSound ? 'inline-block' : 'none'
  document.getElementById('lbl-gameover-sound').textContent =
    s.gameoverSound ? s.gameoverSound.split(/[/\\]/).pop() : 'No file'
  document.getElementById('btn-gameover-sound-clear').style.display =
    s.gameoverSound ? 'inline-block' : 'none'
  document.getElementById('lbl-countdown-sound').textContent =
    s.countdownSound ? s.countdownSound.split(/[/\\]/).pop() : 'No file'
  document.getElementById('btn-countdown-sound-clear').style.display =
    s.countdownSound ? 'inline-block' : 'none'
  const triggerInp = document.getElementById('inp-countdown-trigger')
  if (triggerInp) triggerInp.value = s.countdownTrigger || 0
  document.getElementById('lbl-numsize').textContent =
    (s.numberSize || 1.0).toFixed(1) + '×'
  refreshNumFolderList()
  window.api.send('apply-style', {
    imageMode:    s.imageMode,
    numberFolder: s.imageMode ? resolveNumFolder(s.activeNumFolder) : null,
    fontFamily:   s.imageMode ? null : s.fontFamily,
    timerColor:   s.timerColor,
    bgImage:      s.bgImage ? resolveAssetPath(s.bgImage) : null,
    clearBg:      !s.bgImage,
    layout:       s.timerLayout || null,
    numberSize:   s.numberSize  || 1.0,
  })
}

// ════════════════════════════════════════════════════════
// STYLE SYNC — main asks us to re-push styles when win2 loads
// ════════════════════════════════════════════════════════
window.api.on('sync-styles-to-win2', () => {
  const s = state.settings
  window.api.send('apply-style', {
    imageMode:    s.imageMode,
    numberFolder: s.imageMode ? resolveNumFolder(s.activeNumFolder) : null,
    fontFamily:   s.imageMode ? null : s.fontFamily,
    timerColor:   s.timerColor,
    bgImage:      s.bgImage ? resolveAssetPath(s.bgImage) : null,
    clearBg:      !s.bgImage,
    layout:       s.timerLayout || null,
    numberSize:   s.numberSize  || 1.0,
  })
})

// ════════════════════════════════════════════════════════
// LAYOUT MODE
// ════════════════════════════════════════════════════════
let layoutModeActive = false

document.getElementById('btn-layout').onclick = () => {
  layoutModeActive = true
  window.api.send('set-layout-mode', { on: true })
}

// Timer window Done button clicked — exit layout mode
window.api.on('layout-mode-done', () => {
  layoutModeActive = false
  window.api.send('set-layout-mode', { on: false })
})

// Timer window saved new positions — persist them
window.api.on('save-layout', data => {
  state.settings.timerLayout = data.positions
  scheduleSave()
})

// ════════════════════════════════════════════════════════
// BOOT
// ════════════════════════════════════════════════════════
window.api.getVersion().then(v => {
  const el = document.getElementById('lbl-version')
  if (el) el.textContent = 'ER Timer v' + v
})

// Show update status in the bottom bar
let updaterHideTimer = null
window.api.on('updater-status', msg => {
  const bar = document.getElementById('update-status')
  if (!bar) return
  clearTimeout(updaterHideTimer)
  if (msg) {
    bar.textContent = '🔄 ' + msg
    bar.style.display = 'block'
    // Auto-hide non-critical messages after 3 seconds
    const autoHide = ['Checking for updates...', 'Up to date', 'Update check failed']
    if (autoHide.some(s => msg.includes(s))) {
      updaterHideTimer = setTimeout(() => { bar.style.display = 'none' }, 3000)
    }
  } else {
    bar.style.display = 'none'
  }
})
boot()
