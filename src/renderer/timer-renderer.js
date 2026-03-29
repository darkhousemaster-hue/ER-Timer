let myRoomIndex = 0
let digits      = ['6','0','0','0']
let imageMode   = false
let imageCache  = {}
let timerColor  = 'white'
let layoutMode  = false
let currentNumberSize = 1.0

const DEFAULT_POS = {
  d0:        { left: 41,   top: 50 },
  d1:        { left: 45.5, top: 50 },
  'colon-el':{ left: 50,   top: 50 },
  d2:        { left: 54.5, top: 50 },
  d3:        { left: 59,   top: 50 },
}
let positions = JSON.parse(JSON.stringify(DEFAULT_POS))

const ELEMENTS = ['d0','d1','colon-el','d2','d3']
const LABELS   = { d0:'MM tens', d1:'MM units', 'colon-el':':', d2:'SS tens', d3:'SS units' }

const els = {
  d:         [0,1,2,3].map(i => document.getElementById('d'+i)),
  colon:     document.getElementById('colon-el'),
  hintText:  document.getElementById('hint-text'),
  hintImage: document.getElementById('hint-image'),
  hintImg:   document.getElementById('hint-img-el'),
  blank:     document.getElementById('blank-overlay'),
  bg:        document.getElementById('bg'),
  display:   document.getElementById('timer-display'),
}

// ── Number size ───────────────────────────────────────
const BASE_DIGIT_SIZE = 40.8
const BASE_COLON_SIZE = 19.8

function applyNumberSize(scale) {
  currentNumberSize = scale  // remember for after pool rebuilds
  const ds = (BASE_DIGIT_SIZE * scale).toFixed(2)
  const cs = (BASE_COLON_SIZE * scale).toFixed(2)
  let style = document.getElementById('dynamic-size')
  if (!style) {
    style = document.createElement('style')
    style.id = 'dynamic-size'
    document.head.appendChild(style)
  }
  style.textContent = [
    `.digit img { height: ${ds}vmin !important; }`,
    `.digit { font-size: ${(BASE_DIGIT_SIZE * 0.78 * scale).toFixed(2)}vmin !important; }`,
    `.colon img { height: ${cs}vmin !important; }`,
    `.colon { font-size: ${(BASE_COLON_SIZE * 0.79 * scale).toFixed(2)}vmin !important; }`,
  ].join('\n')
}

// ── Positions ─────────────────────────────────────────
function applyPositions() {
  ELEMENTS.forEach(id => {
    const el  = document.getElementById(id)
    const pos = positions[id] || DEFAULT_POS[id]
    el.style.left = pos.left + '%'
    el.style.top  = pos.top  + '%'
  })
}

// ── Pre-rendered image pool ───────────────────────────
// For each digit slot we pre-create one <img> per possible value
// and just show/hide the right one — no DOM creation on every tick.
// imgPool[slotId][value] = <img element>
let imgPool = {}

function buildImgPool() {
  // Build for digits 0-9 and colon
  const digitSlots = ['d0','d1','d2','d3']
  const values = ['0','1','2','3','4','5','6','7','8','9']

  digitSlots.forEach(slotId => {
    const el = document.getElementById(slotId)
    // Remove any existing pool images
    el.querySelectorAll('img.pool-img').forEach(i => i.remove())
    imgPool[slotId] = {}
    values.forEach(v => {
      if (!imageCache[v]) return
      const img = document.createElement('img')
      img.src = imageCache[v]
      img.className = 'pool-img'
      img.style.display = 'none'
      el.appendChild(img)
      imgPool[slotId][v] = img
    })
  })

  // Colon pool
  const colonEl = document.getElementById('colon-el')
  colonEl.querySelectorAll('img.pool-img').forEach(i => i.remove())
  imgPool['colon-el'] = {}
  if (imageCache['colon']) {
    const img = document.createElement('img')
    img.src = imageCache['colon']
    img.className = 'pool-img'
    img.style.cssText = 'display:none;width:auto;object-fit:contain'
    colonEl.appendChild(img)
    imgPool['colon-el']['colon'] = img
  }
}

// ── Render ────────────────────────────────────────────
function renderDigit(el, value) {
  el.className = 'digit'
  if (!imageMode) {
    // Hide all pool images, show text
    el.querySelectorAll('img.pool-img').forEach(i => { i.style.display = 'none' })
    // Set text via a text node to avoid clearing pool images
    let tn = el.querySelector('.digit-text')
    if (!tn) { tn = document.createElement('span'); tn.className = 'digit-text'; el.appendChild(tn) }
    tn.textContent = value
    tn.style.display = ''
    return
  }
  // Hide text node
  const tn = el.querySelector('.digit-text')
  if (tn) tn.style.display = 'none'
  // Show the right pool image, hide others
  const pool = imgPool[el.id] || {}
  let found = false
  Object.entries(pool).forEach(([k, img]) => {
    if (k === value) { img.style.display = ''; found = true }
    else              img.style.display = 'none'
  })
  if (!found) el.classList.add('error')
}

function renderColon() {
  const colonEl = els.colon
  // Always ensure a .digit-text span exists for the text fallback
  let tn = colonEl.querySelector('.digit-text')
  if (!tn) {
    tn = document.createElement('span')
    tn.className = 'digit-text'
    colonEl.appendChild(tn)
  }
  if (!imageMode) {
    colonEl.querySelectorAll('img.pool-img').forEach(i => { i.style.display = 'none' })
    tn.textContent = ':'
    tn.style.display = ''
    return
  }
  // Image mode — hide text span, show pool image or fall back to text
  tn.style.display = 'none'
  const img = imgPool['colon-el']?.['colon']
  if (img) {
    img.style.display = ''
  } else {
    // No colon image — show text fallback
    tn.textContent = ':'
    tn.style.display = ''
  }
}

function renderAll() {
  const colorMap = { white:'#ffffff', red:'#ff4444', green:'#5DCAA5', yellow:'#f0c040' }
  const hex = colorMap[timerColor] || timerColor || '#ffffff'
  els.display.style.color = hex
  els.display.className = ''
  digits.forEach((v, i) => renderDigit(els.d[i], v))
  renderColon()
}


async function loadImageFolder(folderPath) {
  const files = await window.api.invoke('read-image-folder', folderPath)
  imageCache = {}
  files.forEach(f => {
    imageCache[f.name] = 'file:///' + f.path.replace(/\\/g, '/')
  })
  buildImgPool()
  const allImgs = Object.values(imgPool)
    .flatMap(pool => Object.values(pool))
  await Promise.all(allImgs.map(img =>
    img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r })
  ))
  // Always re-apply numberSize after pool rebuild so all images are the right size
  applyNumberSize(currentNumberSize)
  renderAll()
}

// ── Layout mode — multi-select drag ──────────────────
// Selected elements set
let selected = new Set()

// Undo/redo history — each entry is a full snapshot of positions
const undoStack = []
const redoStack = []
const MAX_HISTORY = 50

function pushHistory() {
  undoStack.push(JSON.stringify(positions))
  if (undoStack.length > MAX_HISTORY) undoStack.shift()
  redoStack.length = 0  // clear redo on new action
}

function undoLayout() {
  if (!undoStack.length) return
  redoStack.push(JSON.stringify(positions))
  positions = JSON.parse(undoStack.pop())
  applyPositions()
  window.api.send('save-layout', { positions })
}

function redoLayout() {
  if (!redoStack.length) return
  undoStack.push(JSON.stringify(positions))
  positions = JSON.parse(redoStack.pop())
  applyPositions()
  window.api.send('save-layout', { positions })
}

// Ctrl+Z / Ctrl+Y and arrow key shortcuts (only active in layout mode)
document.addEventListener('keydown', e => {
  if (!layoutMode) return
  if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undoLayout(); return }
  if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redoLayout(); return }

  // Arrow keys move selected elements
  // Normal: 0.5% per press  |  Shift: 0.1% (fine)  |  Ctrl: 2% (coarse)
  const arrows = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown']
  if (!arrows.includes(e.key)) return
  if (!selected.size) return
  e.preventDefault()

  const step = e.ctrlKey ? 2 : e.shiftKey ? 0.1 : 0.5
  const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
  const dy = e.key === 'ArrowUp'   ? -step : e.key === 'ArrowDown'  ? step : 0

  pushHistory()
  selected.forEach(sid => {
    const el = document.getElementById(sid)
    const newLeft = Math.max(0, Math.min(100, positions[sid].left + dx))
    const newTop  = Math.max(0, Math.min(100, positions[sid].top  + dy))
    el.style.left = newLeft + '%'
    el.style.top  = newTop  + '%'
    positions[sid] = { left: newLeft, top: newTop }
  })
  window.api.send('save-layout', { positions })
})

// Rubber-band selection box
let selBox = null
let selStart = null

ELEMENTS.forEach(id => {
  const el = document.getElementById(id)
  el.dataset.label = LABELS[id] || id

  // Click to toggle selection (without dragging)
  el.addEventListener('mousedown', e => {
    if (!layoutMode) return
    e.stopPropagation()
    e.preventDefault()

    const startX = e.clientX
    const startY = e.clientY
    let moved = false
    let historyPushed = false

    // Snapshot start positions of ALL selected elements
    const startPositions = {}
    ELEMENTS.forEach(sid => {
      startPositions[sid] = { ...positions[sid] }
    })

    function onMove(e) {
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      if (!moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) moved = true
      if (!moved) return
      if (!historyPushed) { pushHistory(); historyPushed = true }

      // If clicking an unselected element, select it and deselect others
      if (!selected.has(id)) {
        selected.forEach(sid => document.getElementById(sid)?.classList.remove('sel'))
        selected.clear()
        selected.add(id)
        el.classList.add('sel')
        ELEMENTS.forEach(sid => { startPositions[sid] = { ...positions[sid] } })
      }

      const dxPct = dx / window.innerWidth  * 100
      const dyPct = dy / window.innerHeight * 100

      // Shift-snap: align top to the median top of all unselected elements
      // Also snaps to screen vertical centre (50%) when close
      let snapTop = null
      const guide = document.getElementById('snap-guide')
      const vguide = document.getElementById('snap-guide-v')
      if (e.shiftKey) {
        const unselectedTops = ELEMENTS
          .filter(sid => !selected.has(sid))
          .map(sid => positions[sid].top)
        if (unselectedTops.length) {
          const sorted = [...unselectedTops].sort((a, b) => a - b)
          snapTop = sorted[Math.floor(sorted.length / 2)]
          if (guide) {
            guide.style.top     = snapTop + 'vh'
            guide.style.display = 'block'
          }
        }
        // Also show vertical centre guide
        if (vguide) vguide.style.display = 'block'
      } else {
        if (guide)  guide.style.display  = 'none'
        if (vguide) vguide.style.display = 'none'
      }

      selected.forEach(sid => {
        const sp  = startPositions[sid]
        const sel = document.getElementById(sid)
        const newLeft = Math.max(0, Math.min(100, sp.left + dxPct))
        const newTop  = snapTop !== null ? snapTop
                      : Math.max(0, Math.min(100, sp.top + dyPct))
        sel.style.left = newLeft + '%'
        sel.style.top  = newTop  + '%'
        positions[sid] = { left: newLeft, top: newTop }
      })
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup',   onUp)
      if (!moved) {
        // Toggle selection on click
        if (selected.has(id)) {
          selected.delete(id)
          el.classList.remove('sel')
        } else {
          selected.add(id)
          el.classList.add('sel')
        }
      }
      const g  = document.getElementById('snap-guide')
      const gv = document.getElementById('snap-guide-v')
      if (g)  g.style.display  = 'none'
      if (gv) gv.style.display = 'none'
      window.api.send('save-layout', { positions })
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup',   onUp)
  })
})

// Click on background = rubber-band select
document.addEventListener('mousedown', e => {
  if (!layoutMode) return
  // If clicked on a digit/colon, that's handled above
  if (ELEMENTS.some(id => document.getElementById(id).contains(e.target))) return
  if (e.target.closest('#layout-bar')) return

  // Deselect all
  selected.forEach(id => document.getElementById(id)?.classList.remove('sel'))
  selected.clear()

  selStart = { x: e.clientX, y: e.clientY }
  selBox = document.createElement('div')
  selBox.id = 'sel-box'
  selBox.style.cssText = [
    'position:fixed','border:2px dashed rgba(255,255,255,0.8)',
    'background:rgba(255,255,255,0.1)','z-index:500','pointer-events:none'
  ].join(';')
  document.body.appendChild(selBox)

  function onMove(e) {
    const x = Math.min(e.clientX, selStart.x)
    const y = Math.min(e.clientY, selStart.y)
    const w = Math.abs(e.clientX - selStart.x)
    const h = Math.abs(e.clientY - selStart.y)
    selBox.style.left   = x + 'px'
    selBox.style.top    = y + 'px'
    selBox.style.width  = w + 'px'
    selBox.style.height = h + 'px'

    // Hit-test each element
    const r1 = { x, y, right: x + w, bottom: y + h }
    ELEMENTS.forEach(id => {
      const el = document.getElementById(id)
      const r2 = el.getBoundingClientRect()
      const hit = r2.left < r1.right && r2.right > r1.x &&
                  r2.top  < r1.bottom && r2.bottom > r1.y
      if (hit) { selected.add(id); el.classList.add('sel') }
      else     { selected.delete(id); el.classList.remove('sel') }
    })
  }

  function onUp() {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup',   onUp)
    selBox?.remove(); selBox = null; selStart = null
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup',   onUp)
})

document.getElementById('layout-done').onclick    = () => window.api.send('layout-mode-done', {})
document.getElementById('btn-layout-undo').onclick = () => undoLayout()
document.getElementById('btn-layout-redo').onclick = () => redoLayout()

// Centre button — moves selected elements to screen centre
// as a group, preserving their arrangement relative to each other
document.getElementById('btn-layout-centre').onclick = () => {
  const targets = selected.size > 0 ? [...selected] : [...ELEMENTS]
  if (!targets.length) return
  pushHistory()

  // Find bounding box of the group
  const lefts = targets.map(id => positions[id].left)
  const tops  = targets.map(id => positions[id].top)
  const minL = Math.min(...lefts)
  const maxL = Math.max(...lefts)
  const minT = Math.min(...tops)
  const maxT = Math.max(...tops)

  // Current group centre
  const groupCentreL = (minL + maxL) / 2
  const groupCentreT = (minT + maxT) / 2

  // Shift needed to move group centre to screen centre (50%, 50%)
  const dL = 50 - groupCentreL
  const dT = 50 - groupCentreT

  targets.forEach(id => {
    const el = document.getElementById(id)
    const newLeft = Math.max(0, Math.min(100, positions[id].left + dL))
    const newTop  = Math.max(0, Math.min(100, positions[id].top  + dT))
    el.style.left = newLeft + '%'
    el.style.top  = newTop  + '%'
    positions[id] = { left: newLeft, top: newTop }
  })
  window.api.send('save-layout', { positions })
}

// ── IPC ───────────────────────────────────────────────
window.api.on('init-room', data => { myRoomIndex = data.roomIndex })

window.api.on('timer-tick', data => { digits = data.digits; renderAll() })

let hintTextTimeout = null
let hintImageTimeout = null

window.api.on('hint-text', data => {
  if (data.roomIndex !== myRoomIndex) return
  clearTimeout(hintTextTimeout)
  if (data.text) {
    els.hintText.textContent   = data.text
    els.hintText.style.display = 'block'
    // Auto-clear after 10 seconds
    hintTextTimeout = setTimeout(() => {
      els.hintText.style.display = 'none'
      els.hintText.textContent   = ''
    }, 10000)
  } else {
    els.hintText.style.display = 'none'
    els.hintText.textContent   = ''
  }
})

window.api.on('hint-image', data => {
  if (data.roomIndex !== myRoomIndex) return
  clearTimeout(hintImageTimeout)
  if (data.src) {
    els.hintImg.src             = data.src
    els.hintImage.style.display = 'block'
    // Auto-clear after 10 seconds
    hintImageTimeout = setTimeout(() => {
      els.hintImage.style.display = 'none'
      els.hintImg.src             = ''
    }, 10000)
  } else {
    els.hintImage.style.display = 'none'
    els.hintImg.src             = ''
  }
})

window.api.on('hint-clear', data => {
  if (data.roomIndex !== myRoomIndex) return
  clearTimeout(hintImageTimeout)
  els.hintImage.style.display = 'none'
  els.hintImg.src             = ''
})

window.api.on('apply-style', async data => {
  if (data.bgColor) els.bg.style.background = data.bgColor
  if (data.bgImage) els.bg.style.backgroundImage =
    `url('file:///${data.bgImage.replace(/\\/g, '/')}')`
  if (data.clearBg) { els.bg.style.backgroundImage = ''; els.bg.style.background = '' }
  if (data.timerColor) { timerColor = data.timerColor; renderAll() }
  if (data.fontFamily) els.display.style.fontFamily = data.fontFamily
  if (data.imageMode !== undefined) {
    imageMode = data.imageMode
    if (imageMode && data.numberFolder) {
      await loadImageFolder(data.numberFolder)
      return  // numberFolder already handled, skip the check below
    }
    else renderAll()
  }
  if (data.numberFolder && imageMode) await loadImageFolder(data.numberFolder)
  if (data.layout)     { positions = data.layout; applyPositions() }
  if (data.numberSize !== undefined) applyNumberSize(data.numberSize)
})

window.api.on('set-layout-mode', data => {
  layoutMode = data.on
  document.body.classList.toggle('layout-mode', data.on)
  els.display.style.pointerEvents = data.on ? 'all' : 'none'
  if (!data.on) {
    selected.forEach(id => document.getElementById(id)?.classList.remove('sel'))
    selected.clear()
  }
})

window.api.on('play-sound', async data => {
  if (!data.filePath) return
  try {
    const audio = new Audio('file:///' + data.filePath.replace(/\\/g, '/'))
    if (data.deviceId && audio.setSinkId) await audio.setSinkId(data.deviceId)
    audio.play().catch(() => {})
  } catch {
    const audio = new Audio('file:///' + data.filePath.replace(/\\/g, '/'))
    audio.play().catch(() => {})
  }
})

// Clear the bare ':' text node that comes from the HTML
// so it never shows alongside the image or span
;(function clearColonTextNode() {
  const colonEl = document.getElementById('colon-el')
  colonEl.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) node.remove()
  })
})()

applyPositions()
renderAll()
