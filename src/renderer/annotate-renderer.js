// Annotation editor — draw on a picture hint before sending it to the players.
// The stage mimics the player screen so the GM sees the final result.

let init      = null       // { roomIndex, imageDataUrl, style }
let shapes    = []         // committed shapes, redrawn on every change
let current   = null       // shape being drawn right now
let tool      = 'pen'
let color     = '#ff3b30'
let uiWidth   = 13        // middle of the size slider
let drawing   = false
let selected  = -1         // index into shapes, for the move/edit tool
let moving    = null       // { i, lastX, lastY } while dragging a shape

const stage = document.getElementById('stage')
const base  = document.getElementById('base')
const cv    = document.getElementById('paint')
const ctx   = cv.getContext('2d')
const btnSend = document.getElementById('btn-send')

// The drawing surface is deliberately not tied to the picture's own size.
// Small pictures get a supersampled surface so arrows, circles and text stay
// smooth once the player screen blows them up; huge ones are capped so the
// exported PNG stays a sane size.
const MIN_EDGE = 1600
const MAX_EDGE = 2400

// Stroke widths are picked in UI units but drawn in surface pixels. Basing
// this on the long edge keeps a line equally thick on portrait and landscape.
function scale() { return Math.max(cv.width, cv.height) / 1400 }

// ── Init ──────────────────────────────────────────────
window.api.on('annotate-init', data => {
  init = data
  const bg = data.style && data.style.bgImage
  if (bg) stage.style.backgroundImage = `url('file:///${bg.replace(/\\/g, '/')}')`

  base.onload = () => {
    const w = base.naturalWidth  || 1200
    const h = base.naturalHeight || 800
    const long = Math.max(w, h)
    let f = 1
    if (long < MIN_EDGE)      f = MIN_EDGE / long   // supersample small pictures
    else if (long > MAX_EDGE) f = MAX_EDGE / long   // cap very large ones
    cv.width  = Math.round(w * f)
    cv.height = Math.round(h * f)
    fitFrame()
    redraw()
    btnSend.disabled = false
  }
  base.onerror = () => {
    document.getElementById('hint-note').textContent = 'Could not load that picture.'
    btnSend.disabled = true
  }
  btnSend.disabled = true
  base.src = data.imageDataUrl
})

// Size the picture the way the player screen does: contained within
// 90% x 88% of the screen, scaled up if it is small. Sizing the <img>
// explicitly keeps the drawing canvas exactly on top of it.
function fitFrame() {
  if (!base.naturalWidth) return
  const PAD = 10   // #frame padding, both sides
  const availW = stage.clientWidth  * 0.90 - PAD
  const availH = stage.clientHeight * 0.88 - PAD
  const r = Math.min(availW / base.naturalWidth, availH / base.naturalHeight)
  base.style.width  = Math.max(1, Math.round(base.naturalWidth  * r)) + 'px'
  base.style.height = Math.max(1, Math.round(base.naturalHeight * r)) + 'px'
  placeTextInput()   // keep an open text box on its spot
}
window.addEventListener('resize', fitFrame)

// ── Drawing ───────────────────────────────────────────
function pointFrom(e) {
  const r = cv.getBoundingClientRect()
  return {
    x: (e.clientX - r.left) * (cv.width  / r.width),
    y: (e.clientY - r.top)  * (cv.height / r.height),
  }
}

// Shift constrains: square boxes, circles, 45° lines and arrows
function constrain(s, shift) {
  if (!shift) return s
  const dx = s.x2 - s.x1, dy = s.y2 - s.y1
  if (s.type === 'arrow' || s.type === 'line') {
    const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4)
    const len = Math.hypot(dx, dy)
    s.x2 = s.x1 + Math.cos(a) * len
    s.y2 = s.y1 + Math.sin(a) * len
  } else {
    const d = Math.max(Math.abs(dx), Math.abs(dy))
    s.x2 = s.x1 + Math.sign(dx || 1) * d
    s.y2 = s.y1 + Math.sign(dy || 1) * d
  }
  return s
}

// ── Selecting and moving ──────────────────────────────
function textMetrics(s) {
  const fs = textFontPx(s.width)
  ctx.font = `700 ${fs}px "Segoe UI", Arial, sans-serif`
  return { w: ctx.measureText(s.text || '').width, h: fs * 1.25 }
}

function shapeBounds(s) {
  if (s.type === 'text') {
    const m = textMetrics(s)
    return { x1: s.x, y1: s.y, x2: s.x + m.w, y2: s.y + m.h }
  }
  if (s.type === 'number') {
    const r = Math.max(10, s.width * 2.2 * scale())
    return { x1: s.x - r, y1: s.y - r, x2: s.x + r, y2: s.y + r }
  }
  if (s.type === 'pen' || s.type === 'marker') {
    const xs = s.pts.map(p => p.x), ys = s.pts.map(p => p.y)
    return { x1: Math.min(...xs), y1: Math.min(...ys),
             x2: Math.max(...xs), y2: Math.max(...ys) }
  }
  return { x1: Math.min(s.x1, s.x2), y1: Math.min(s.y1, s.y2),
           x2: Math.max(s.x1, s.x2), y2: Math.max(s.y1, s.y2) }
}

// Topmost shape under the pointer, or -1
function hitTest(p) {
  for (let i = shapes.length - 1; i >= 0; i--) {
    const b = shapeBounds(shapes[i])
    const pad = Math.max(10 * scale(), (shapes[i].width || 4) * scale())
    if (p.x >= b.x1 - pad && p.x <= b.x2 + pad &&
        p.y >= b.y1 - pad && p.y <= b.y2 + pad) return i
  }
  return -1
}

function translateShape(s, dx, dy) {
  if (s.type === 'pen' || s.type === 'marker') s.pts.forEach(pt => { pt.x += dx; pt.y += dy })
  else if (s.type === 'text' || s.type === 'number') { s.x += dx; s.y += dy }
  else { s.x1 += dx; s.y1 += dy; s.x2 += dx; s.y2 += dy }
}

// Dashed marquee around the selected shape (never part of the export)
function drawSelection() {
  if (selected < 0 || selected >= shapes.length) return
  const b = shapeBounds(shapes[selected])
  const pad = 6 * scale()
  const x = b.x1 - pad, y = b.y1 - pad
  const w = (b.x2 - b.x1) + pad * 2, h = (b.y2 - b.y1) + pad * 2
  ctx.save()
  ctx.lineWidth = Math.max(1, 1.5 * scale())
  ctx.strokeStyle = 'rgba(0,0,0,0.65)'
  ctx.strokeRect(x, y, w, h)
  ctx.setLineDash([9 * scale(), 6 * scale()])
  ctx.strokeStyle = 'rgba(255,255,255,0.95)'
  ctx.strokeRect(x, y, w, h)
  ctx.restore()
}

// ── Text tool ─────────────────────────────────────────
// Typing happens in a real input sitting on the picture, so the GM sees
// where the words land before committing them to the drawing.
let textInput = null

function textFontPx(uiw) { return Math.max(10, uiw * 5 * scale()) }
function displayScale()  { return cv.getBoundingClientRect().width / cv.width }

// Keep the typing box exactly where the words will land, at exactly the
// size they will end up, and only as wide as what has been typed so far.
function placeTextInput() {
  if (!textInput) return
  const ds = displayScale()
  const fsCanvas = textFontPx(textInput._w)     // size on the picture
  const fsScreen = fsCanvas * ds                // the same size on screen
  // Measure with the very font the canvas will draw with, so the box and
  // the finished text are the same width to the pixel.
  ctx.save()
  ctx.font = `700 ${fsCanvas}px "Segoe UI", Arial, sans-serif`
  const m     = ctx.measureText(textInput.value || 'Hg')
  const asc   = m.fontBoundingBoxAscent  || fsCanvas * 0.75
  const desc  = m.fontBoundingBoxDescent || fsCanvas * 0.25
  const textW = ctx.measureText(textInput.value || '').width * ds
  ctx.restore()
  // Making the box exactly ascent+descent tall, with the same line-height,
  // puts the typed baseline where the canvas will draw it, so the words do
  // not jump when the box goes away.
  const boxH = (asc + desc) * ds
  const st = textInput.style
  st.fontSize   = fsScreen + 'px'
  st.lineHeight = boxH + 'px'
  st.height     = boxH + 'px'
  st.width      = Math.max(fsScreen * 0.55, textW) + 'px'
  // -1 for the border, so the glyphs sit where they will be drawn
  st.left = (5 + textInput._ix * ds - 1) + 'px'
  st.top  = (5 + textInput._iy * ds - 1) + 'px'
}

function commitText() {
  if (!textInput) return
  const t = textInput
  textInput = null                       // clear first: removing fires blur
  const value = t.value.trim()
  const shape = { type: 'text', color: t._c, width: t._w, x: t._ix, y: t._iy, text: value }
  t.remove()
  // Editing an existing one? Put it back where it was in the stacking order.
  // Emptying the box is how you delete a piece of text.
  if (value && t._idx >= 0) shapes.splice(Math.min(t._idx, shapes.length), 0, shape)
  else if (value)           shapes.push(shape)
  redraw()
}

// Escape: throw away the typing. If we were editing, restore the original.
function cancelText() {
  if (!textInput) return
  const t = textInput
  textInput = null
  t.remove()
  if (t._orig && t._idx >= 0) shapes.splice(Math.min(t._idx, shapes.length), 0, t._orig)
  redraw()
}

// Reopen an existing text shape for editing, in place
function editTextShape(i) {
  const s = shapes[i]
  if (!s || s.type !== 'text') return
  shapes.splice(i, 1)          // lifted out while editing; re-added on commit
  selected = -1
  redraw()
  beginTextEntry({ x: s.x, y: s.y }, { index: i, orig: s })
}

function beginTextEntry(p, edit) {
  commitText()                            // finish any text already open
  const c = edit ? edit.orig.color : color
  const w = edit ? edit.orig.width : uiWidth
  const inp = document.createElement('input')
  inp.type = 'text'
  inp.id = 'text-entry'
  inp.value = edit ? edit.orig.text : ''
  inp._ix = p.x; inp._iy = p.y; inp._c = c; inp._w = w
  inp._idx = edit ? edit.index : -1
  inp._orig = edit ? edit.orig : null
  // No padding and content-box sizing: the box is the text, nothing more
  inp.style.cssText = [
    'position:absolute', 'z-index:5',
    'padding:0', 'margin:0', 'outline:none', 'box-sizing:content-box',
    'font-family:"Segoe UI",Arial,sans-serif', 'font-weight:700',
    `color:${c}`,
    'background:rgba(0,0,0,0.35)',
    'border:1px dashed rgba(255,255,255,0.85)', 'border-radius:3px',
  ].join(';')
  inp.addEventListener('input', placeTextInput)   // hug the text as it is typed
  // Keep keystrokes away from the editor's own shortcuts
  inp.addEventListener('keydown', e => {
    e.stopPropagation()
    if (e.key === 'Enter')  commitText()
    if (e.key === 'Escape') cancelText()
  })
  inp.addEventListener('blur', () => commitText())
  document.getElementById('frame').appendChild(inp)
  textInput = inp            // must be set before placing/committing
  placeTextInput()
  setTimeout(() => { inp.focus(); inp.select() }, 0)
}

cv.addEventListener('pointerdown', e => {
  if (!init || e.button !== 0) return
  const hit = pointFrom(e)

  // Move tool: pick up whatever is under the pointer (text opens for editing)
  if (tool === 'move') {
    const i = hitTest(hit)
    selected = i
    if (i >= 0) {
      cv.setPointerCapture(e.pointerId)
      moving = { i, lastX: hit.x, lastY: hit.y, moved: false }
    }
    redraw()
    return
  }

  // Text tool: clicking existing text edits it instead of stacking a new one
  if (tool === 'text') {
    const i = hitTest(hit)
    if (i >= 0 && shapes[i].type === 'text') editTextShape(i)
    else beginTextEntry(hit)
    return
  }

  // Numbered markers drop straight onto the picture, one click each.
  // The next number is worked out from what is already there, so undo
  // and delete never leave a gap in the sequence.
  if (tool === 'number') {
    const next = shapes.reduce((m, s) => s.type === 'number' ? Math.max(m, s.n) : m, 0) + 1
    shapes.push({ type: 'number', color, width: uiWidth, x: hit.x, y: hit.y, n: next })
    redraw()
    return
  }

  cv.setPointerCapture(e.pointerId)
  drawing = true
  const p = pointFrom(e)
  current = (tool === 'pen' || tool === 'marker')
    ? { type: tool, color, width: uiWidth, pts: [p] }
    : { type: tool, color, width: uiWidth, x1: p.x, y1: p.y, x2: p.x, y2: p.y }
  redraw()
})

cv.addEventListener('pointermove', e => {
  if (moving) {
    const p = pointFrom(e)
    const dx = p.x - moving.lastX, dy = p.y - moving.lastY
    if (dx || dy) moving.moved = true
    translateShape(shapes[moving.i], dx, dy)
    moving.lastX = p.x; moving.lastY = p.y
    redraw()
    return
  }
  if (!drawing || !current) return
  const p = pointFrom(e)
  if (current.type === 'pen' || current.type === 'marker') current.pts.push(p)
  else {
    current.x2 = p.x; current.y2 = p.y
    // Shift bends a curved arrow the other way instead of snapping its angle
    if (current.type === 'curve') current.flip = e.shiftKey
    else constrain(current, e.shiftKey)
  }
  redraw()
})

function finishStroke() {
  // A click with the move tool that never dragged and landed on text = edit it
  if (moving) {
    const { i, moved } = moving
    moving = null
    if (!moved && shapes[i] && shapes[i].type === 'text') editTextShape(i)
    return
  }
  if (!drawing) return
  drawing = false
  if (current) {
    // Ignore accidental taps that produced nothing visible
    const isDot = (current.type === 'pen' || current.type === 'marker')
      ? current.pts.length < 2
      : Math.hypot(current.x2 - current.x1, current.y2 - current.y1) < 3
    if (!isDot) shapes.push(current)
  }
  current = null
  redraw()
}
cv.addEventListener('pointerup', finishStroke)
cv.addEventListener('pointercancel', finishStroke)

// ── Rendering ─────────────────────────────────────────
function drawShape(s) {
  const w = s.width * scale()
  ctx.strokeStyle = s.color
  ctx.fillStyle   = s.color
  ctx.lineWidth   = w
  ctx.lineCap     = 'round'
  ctx.lineJoin    = 'round'

  if (s.type === 'text') {
    const fs = textFontPx(s.width)
    ctx.save()
    ctx.font = `700 ${fs}px "Segoe UI", Arial, sans-serif`
    ctx.textBaseline = 'top'
    ctx.miterLimit = 2
    // Dark halo keeps any colour readable over a busy photo
    ctx.strokeStyle = 'rgba(0,0,0,0.85)'
    ctx.lineWidth   = Math.max(2, fs / 7)
    ctx.strokeText(s.text, s.x, s.y)
    ctx.fillStyle = s.color
    ctx.fillText(s.text, s.x, s.y)
    ctx.restore()
    return
  }
  // Numbered marker — a filled disc with the step number inside
  if (s.type === 'number') {
    const r = Math.max(10, s.width * 2.2 * scale())
    ctx.save()
    ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2)
    ctx.fillStyle = s.color; ctx.fill()
    ctx.lineWidth = Math.max(2, r / 7)
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.stroke()
    ctx.fillStyle = '#fff'
    ctx.font = `700 ${r * 1.15}px "Segoe UI", Arial, sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(String(s.n), s.x, s.y)
    ctx.restore()
    return
  }
  // Highlighter — wide and see-through so the picture still reads underneath
  if (s.type === 'marker') {
    if (s.pts.length < 2) return
    ctx.save()
    ctx.globalAlpha = 0.35
    ctx.lineWidth = w * 3.2
    ctx.beginPath()
    ctx.moveTo(s.pts[0].x, s.pts[0].y)
    s.pts.forEach(p => ctx.lineTo(p.x, p.y))
    ctx.stroke()
    ctx.restore()
    return
  }
  if (s.type === 'line') {
    ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke()
    return
  }
  if (s.type === 'fillrect') {
    ctx.fillRect(Math.min(s.x1, s.x2), Math.min(s.y1, s.y2),
                 Math.abs(s.x2 - s.x1), Math.abs(s.y2 - s.y1))
    return
  }
  // Curved arrow — bows to one side of the straight line between the ends
  if (s.type === 'curve') {
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1
    const len = Math.hypot(dx, dy) || 1
    const nx = -dy / len, ny = dx / len
    const bow = len * 0.28 * (s.flip ? -1 : 1)
    const cx = (s.x1 + s.x2) / 2 + nx * bow
    const cy = (s.y1 + s.y2) / 2 + ny * bow
    const head = Math.max(w * 3.2, 12 * scale())
    // The head points along the curve's tangent where it ends
    const ang = Math.atan2(s.y2 - cy, s.x2 - cx)
    ctx.beginPath()
    ctx.moveTo(s.x1, s.y1)
    ctx.quadraticCurveTo(cx, cy,
      s.x2 - Math.cos(ang) * head * 0.8, s.y2 - Math.sin(ang) * head * 0.8)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(s.x2, s.y2)
    ctx.lineTo(s.x2 - Math.cos(ang - 0.42) * head, s.y2 - Math.sin(ang - 0.42) * head)
    ctx.lineTo(s.x2 - Math.cos(ang + 0.42) * head, s.y2 - Math.sin(ang + 0.42) * head)
    ctx.closePath(); ctx.fill()
    return
  }
  if (s.type === 'pen') {
    if (s.pts.length < 2) return
    ctx.beginPath()
    ctx.moveTo(s.pts[0].x, s.pts[0].y)
    s.pts.forEach(p => ctx.lineTo(p.x, p.y))
    ctx.stroke()
    return
  }
  if (s.type === 'rect') {
    ctx.strokeRect(
      Math.min(s.x1, s.x2), Math.min(s.y1, s.y2),
      Math.abs(s.x2 - s.x1), Math.abs(s.y2 - s.y1))
    return
  }
  if (s.type === 'ellipse') {
    const cx = (s.x1 + s.x2) / 2, cy = (s.y1 + s.y2) / 2
    const rx = Math.abs(s.x2 - s.x1) / 2, ry = Math.abs(s.y2 - s.y1) / 2
    if (rx < 1 || ry < 1) return
    ctx.beginPath()
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
    ctx.stroke()
    return
  }
  if (s.type === 'arrow') {
    const ang  = Math.atan2(s.y2 - s.y1, s.x2 - s.x1)
    const head = Math.max(w * 3.2, 12 * scale())
    // Stop the shaft just short of the tip so the head stays crisp
    ctx.beginPath()
    ctx.moveTo(s.x1, s.y1)
    ctx.lineTo(s.x2 - Math.cos(ang) * head * 0.8, s.y2 - Math.sin(ang) * head * 0.8)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(s.x2, s.y2)
    ctx.lineTo(s.x2 - Math.cos(ang - 0.42) * head, s.y2 - Math.sin(ang - 0.42) * head)
    ctx.lineTo(s.x2 - Math.cos(ang + 0.42) * head, s.y2 - Math.sin(ang + 0.42) * head)
    ctx.closePath()
    ctx.fill()
  }
}

function redraw() {
  ctx.clearRect(0, 0, cv.width, cv.height)
  shapes.forEach(drawShape)
  if (current) drawShape(current)
  drawSelection()
}

// ── Toolbar ───────────────────────────────────────────
document.querySelectorAll('.tool').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('.tool').forEach(x => x.classList.remove('active'))
    b.classList.add('active')
    tool = b.dataset.tool
    if (tool !== 'move') selected = -1        // marquee only belongs to move
    cv.style.cursor = tool === 'move' ? 'move' : 'crosshair'
    redraw()
  }
})

const colorInput = document.getElementById('color-input')
function setColor(c, fromSwatch) {
  color = c
  colorInput.value = c
  document.querySelectorAll('.sw').forEach(s =>
    s.classList.toggle('active', fromSwatch && s.dataset.color === c))
}
document.querySelectorAll('.sw').forEach(s => {
  s.onclick = () => setColor(s.dataset.color, true)
})
colorInput.oninput = e => setColor(e.target.value, false)

document.getElementById('width-input').oninput = e => { uiWidth = parseInt(e.target.value) }
document.getElementById('btn-undo').onclick  = () => { shapes.pop(); selected = -1; redraw() }
document.getElementById('btn-clear').onclick = () => { cancelText(); shapes = []; selected = -1; redraw() }

// ── Send / cancel ─────────────────────────────────────
document.getElementById('btn-cancel').onclick = () => window.close()

btnSend.onclick = async () => {
  if (!init) return
  commitText()          // don't lose text still being typed
  selected = -1         // the marquee must not end up in the sent picture
  redraw()
  btnSend.disabled = true
  try {
    // Flatten picture + drawings into one PNG
    const out = document.createElement('canvas')
    out.width  = cv.width
    out.height = cv.height
    const o = out.getContext('2d')
    o.imageSmoothingEnabled = true
    o.imageSmoothingQuality = 'high'
    o.drawImage(base, 0, 0, out.width, out.height)
    o.drawImage(cv, 0, 0)
    const filePath = await window.api.invoke('save-annotated-image', out.toDataURL('image/png'))
    if (!filePath) throw new Error('save failed')
    window.api.send('annotate-send', { roomIndex: init.roomIndex, filePath })
    window.close()
  } catch {
    btnSend.disabled = false
    document.getElementById('hint-note').textContent = 'Could not send that picture — please try again.'
  }
}

// ── Shortcuts ─────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key.toLowerCase() === 'z') {
    e.preventDefault(); shapes.pop(); selected = -1; redraw(); return
  }
  // Remove the shape picked up with the move tool
  if ((e.key === 'Delete' || e.key === 'Backspace') && selected >= 0) {
    e.preventDefault()
    shapes.splice(selected, 1); selected = -1; redraw(); return
  }
  if (e.key === 'Escape') { window.close(); return }
  const keys = { v:'move', p:'pen', h:'marker', l:'line', a:'arrow', c:'curve',
                 r:'rect', f:'fillrect', o:'ellipse', n:'number', t:'text' }
  const t = keys[e.key.toLowerCase()]
  if (t) document.querySelector(`.tool[data-tool="${t}"]`)?.click()
})
