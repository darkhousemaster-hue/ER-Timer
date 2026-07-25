// Annotation editor — draw on a picture hint before sending it to the players.
// The stage mimics the player screen so the GM sees the final result.

let init      = null       // { roomIndex, imageDataUrl, style }
let shapes    = []         // committed shapes, redrawn on every change
let current   = null       // shape being drawn right now
let tool      = 'pen'
let color     = '#ff3b30'
let uiWidth   = 6
let drawing   = false

const stage = document.getElementById('stage')
const base  = document.getElementById('base')
const cv    = document.getElementById('paint')
const ctx   = cv.getContext('2d')
const btnSend = document.getElementById('btn-send')

// Longest edge of the exported image — keeps annotated PNGs a sane size
const MAX_EDGE = 2200

// Stroke widths are picked in UI units but drawn in image pixels, so a
// stroke looks the same whether the picture is 800px or 4000px wide.
function scale() { return Math.max(1, cv.width / 1000) }

// ── Init ──────────────────────────────────────────────
window.api.on('annotate-init', data => {
  init = data
  const bg = data.style && data.style.bgImage
  if (bg) stage.style.backgroundImage = `url('file:///${bg.replace(/\\/g, '/')}')`

  base.onload = () => {
    let w = base.naturalWidth || 1200
    let h = base.naturalHeight || 800
    const f = Math.min(1, MAX_EDGE / Math.max(w, h))
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

// Shift constrains: square boxes, circles, 45° arrows
function constrain(s, shift) {
  if (!shift) return s
  const dx = s.x2 - s.x1, dy = s.y2 - s.y1
  if (s.type === 'arrow') {
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

cv.addEventListener('pointerdown', e => {
  if (!init || e.button !== 0) return
  cv.setPointerCapture(e.pointerId)
  drawing = true
  const p = pointFrom(e)
  current = tool === 'pen'
    ? { type: 'pen', color, width: uiWidth, pts: [p] }
    : { type: tool, color, width: uiWidth, x1: p.x, y1: p.y, x2: p.x, y2: p.y }
  redraw()
})

cv.addEventListener('pointermove', e => {
  if (!drawing || !current) return
  const p = pointFrom(e)
  if (current.type === 'pen') current.pts.push(p)
  else { current.x2 = p.x; current.y2 = p.y; constrain(current, e.shiftKey) }
  redraw()
})

function finishStroke() {
  if (!drawing) return
  drawing = false
  if (current) {
    // Ignore accidental taps that produced nothing visible
    const isDot = current.type === 'pen'
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
}

// ── Toolbar ───────────────────────────────────────────
document.querySelectorAll('.tool').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('.tool').forEach(x => x.classList.remove('active'))
    b.classList.add('active')
    tool = b.dataset.tool
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
document.getElementById('btn-undo').onclick  = () => { shapes.pop(); redraw() }
document.getElementById('btn-clear').onclick = () => { shapes = []; redraw() }

// ── Send / cancel ─────────────────────────────────────
document.getElementById('btn-cancel').onclick = () => window.close()

btnSend.onclick = async () => {
  if (!init) return
  btnSend.disabled = true
  try {
    // Flatten picture + drawings into one PNG
    const out = document.createElement('canvas')
    out.width  = cv.width
    out.height = cv.height
    const o = out.getContext('2d')
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
  if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); shapes.pop(); redraw(); return }
  if (e.key === 'Escape') { window.close(); return }
  const keys = { p: 'pen', a: 'arrow', r: 'rect', o: 'ellipse' }
  const t = keys[e.key.toLowerCase()]
  if (t) document.querySelector(`.tool[data-tool="${t}"]`)?.click()
})
