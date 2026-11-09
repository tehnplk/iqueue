const { app, BrowserWindow, ipcMain, Menu, screen, Tray } = require('electron')
const path = require('node:path')
const koffi = require('koffi')
const { fetchPatient } = require('./patient.cjs')

const BAR_HEIGHT = 30 // DIP
const ICON = path.join(__dirname, '../assets/icon.ico') // source: assets/icon.svg

// Windows AppBar API: reserves screen space so maximized windows don't cover the bar.
const RECT = koffi.struct('RECT', { left: 'long', top: 'long', right: 'long', bottom: 'long' })
const APPBARDATA = koffi.struct('APPBARDATA', {
  cbSize: 'uint32',
  hWnd: 'intptr',
  uCallbackMessage: 'uint32',
  uEdge: 'uint32',
  rc: RECT,
  lParam: 'intptr',
})
const SHAppBarMessage = koffi
  .load('shell32.dll')
  .func('uintptr __stdcall SHAppBarMessage(uint32 msg, _Inout_ APPBARDATA *data)')
const ABM_NEW = 0, ABM_REMOVE = 1, ABM_QUERYPOS = 2, ABM_SETPOS = 3, ABE_TOP = 1

// AppBar only reflows maximized windows; normal windows overlapping the bar are moved by hand.
const user32 = koffi.load('user32.dll')
const EnumProc = koffi.proto('bool __stdcall EnumProc(intptr hwnd, intptr lParam)')
const EnumWindows = user32.func('bool __stdcall EnumWindows(EnumProc *cb, intptr lParam)')
const GetWindowRect = user32.func('bool __stdcall GetWindowRect(intptr hwnd, _Out_ RECT *rc)')
const IsWindowVisible = user32.func('bool __stdcall IsWindowVisible(intptr hwnd)')
const IsIconic = user32.func('bool __stdcall IsIconic(intptr hwnd)')
const IsZoomed = user32.func('bool __stdcall IsZoomed(intptr hwnd)')
const GetWindowLongPtrW = user32.func('intptr __stdcall GetWindowLongPtrW(intptr hwnd, int index)')
const SetWindowPos = user32.func('bool __stdcall SetWindowPos(intptr hwnd, intptr after, int x, int y, int cx, int cy, uint flags)')
const EnumChildWindows = user32.func('bool __stdcall EnumChildWindows(intptr parent, EnumProc *cb, intptr lParam)')
const GetClassNameW = user32.func('int __stdcall GetClassNameW(intptr hwnd, _Out_ uint16_t *buf, int n)')
const GetWindowTextW = user32.func('int __stdcall GetWindowTextW(intptr hwnd, _Out_ uint16_t *buf, int n)')
const SendMessageTimeoutW = user32.func('intptr __stdcall SendMessageTimeoutW(intptr hwnd, uint msg, uintptr wParam, _Out_ uint16_t *buf, uint flags, uint timeout, _Out_ uintptr *result)')
const WM_GETTEXT = 0x0d, SMTO_ABORTIFHUNG = 0x2
const GWL_EXSTYLE = -20, WS_EX_TOOLWINDOW = 0x80
const SWP_NOSIZE = 0x1, SWP_NOZORDER = 0x4, SWP_NOACTIVATE = 0x10, SWP_NOSENDCHANGING = 0x400

const LINE = { width: 160, height: 4 } // collapsed handle, DIP

let win, hwnd, abd, tray

// ponytail: one pass per expand; windows dragged under the bar later stay there (Windows keeps new/maximized ones out).
function pushWindowsDown(bar, screenPx) {
  EnumWindows((h) => {
    if (BigInt(h) === hwnd) return true
    if (!IsWindowVisible(h) || IsIconic(h) || IsZoomed(h)) return true
    if (Number(GetWindowLongPtrW(h, GWL_EXSTYLE)) & WS_EX_TOOLWINDOW) return true
    const rc = {}
    GetWindowRect(h, rc)
    if (rc.bottom - rc.top >= screenPx.height) return true // desktop / fullscreen
    const overlaps = rc.top < bar.bottom && rc.bottom > bar.top && rc.left < bar.right && rc.right > bar.left
    if (overlaps) SetWindowPos(h, 0, rc.left, bar.bottom, 0, 0, SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE)
    return true
  }, 0)
}

// Physical pixels via Win32: NOSENDCHANGING skips Chromium's WM_WINDOWPOSCHANGING clamp to a ~38px minimum height.
let target
function setPos(rc) {
  target = { ...rc }
  const { left, top, right, bottom } = rc
  SetWindowPos(hwnd, 0, left, top, right - left, bottom - top, SWP_NOZORDER | SWP_NOACTIVATE | SWP_NOSENDCHANGING)
}

// Chromium refits the window into the work area whenever it changes (i.e. right after we reserve space),
// pushing it below our own bar at min height. Snap back whenever it drifts.
function enforcePos() {
  const rc = {}
  GetWindowRect(hwnd, rc)
  if (target && ['left', 'top', 'right', 'bottom'].some((k) => rc[k] !== target[k])) setPos(target)
}

function toPx(dip) {
  const r = screen.dipToScreenRect(win, dip)
  return { left: r.x, top: r.y, right: r.x + r.width, bottom: r.y + r.height }
}

// Startup: fly out of our tray icon into the top bar (other apps shift down as space is reserved).
// Falls back to the tray corner when the icon is hidden in the overflow (empty bounds).
function enter() {
  const b = screen.getPrimaryDisplay().bounds
  const t = tray.getBounds()
  const from = t.width ? t : { x: b.x + b.width - 160, y: b.y + b.height - 36, width: 24, height: 24 }
  setPos(toPx(from)) // start before showing (no flash)
  win.show()
  expand(null, ENTER_MS)
}

function expand(_e, ms = ANIM_MS) {
  unregisterAppBar()
  const b = screen.getPrimaryDisplay().bounds
  const rc = toPx({ x: b.x, y: b.y, width: b.width, height: BAR_HEIGHT })
  abd = { cbSize: koffi.sizeof(APPBARDATA), hWnd: hwnd, uCallbackMessage: 0, uEdge: ABE_TOP, rc, lParam: 0 }
  SHAppBarMessage(ABM_NEW, abd)
  SHAppBarMessage(ABM_QUERYPOS, abd)
  abd.rc.bottom = abd.rc.top + (rc.bottom - rc.top)
  SHAppBarMessage(ABM_SETPOS, abd)
  pushWindowsDown(abd.rc, screen.dipToScreenRect(win, b))
  animateTo(abd.rc, null, ms)
}

// Gives the space back to other apps (after the shrink); leaves a small handle at top-center.
function collapse() {
  const b = screen.getPrimaryDisplay().bounds
  animateTo(toPx({ x: b.x + Math.round((b.width - LINE.width) / 2), y: b.y, ...LINE }), unregisterAppBar)
}

const ANIM_MS = 200
const ENTER_MS = 650
let anim
function animateTo(to, done, ms = ANIM_MS) {
  clearInterval(anim)
  const from = {}
  GetWindowRect(hwnd, from)
  const t0 = Date.now()
  anim = setInterval(() => {
    const t = Math.min(1, (Date.now() - t0) / ms)
    const e = 1 - (1 - t) ** 3 // ease-out cubic
    const lerp = (k) => Math.round(from[k] + (to[k] - from[k]) * e)
    setPos({ left: lerp('left'), top: lerp('top'), right: lerp('right'), bottom: lerp('bottom') })
    if (t === 1) {
      clearInterval(anim)
      done?.()
    }
  }, 16)
}

// --- HOSxP: read the HN shown next to the topmost "HN" label (Delphi/DevExpress; TcxLabel is a real HWND) ---
const wstr = (buf) => {
  const end = buf.indexOf(0)
  return Buffer.from(buf.buffer, 0, (end < 0 ? buf.length : end) * 2).toString('utf16le')
}
const className = (h) => { const b = new Uint16Array(64); GetClassNameW(h, b, 64); return wstr(b) }
const titleOf = (h) => { const b = new Uint16Array(256); GetWindowTextW(h, b, 256); return wstr(b) }
// WM_GETTEXT: GetWindowText can't read controls of another process.
const textOf = (h) => { const b = new Uint16Array(256); SendMessageTimeoutW(h, WM_GETTEXT, 256, b, SMTO_ABORTIFHUNG, 200, [0]); return wstr(b).trim() }
const rectOf = (h) => { const rc = {}; GetWindowRect(h, rc); return rc }
const EDIT_CLASSES = new Set(['TcxTextEdit', 'TcxDBTextEdit'])

function readHN() {
  let main
  EnumWindows((h) => {
    if (IsWindowVisible(h) && className(h) === 'TMainForm' && titleOf(h).includes('HOSxP')) main = h
    return !main
  }, 0)
  if (!main) return null

  const labels = [], edits = []
  EnumChildWindows(main, (h) => {
    if (!IsWindowVisible(h)) return true
    const c = className(h)
    if (c === 'TcxLabel') labels.push(h)
    else if (EDIT_CLASSES.has(c)) edits.push(h)
    return true
  }, 0)

  const label = labels.filter((h) => textOf(h) === 'HN').map(rectOf).sort((a, b) => a.top - b.top)[0]
  if (!label) return null
  const mid = (label.top + label.bottom) / 2
  const edit = edits
    .map((h) => ({ h, rc: rectOf(h) }))
    .filter(({ rc }) => rc.left >= label.right && rc.top <= mid && rc.bottom >= mid)
    .sort((a, b) => a.rc.left - b.rc.left)[0]
  return edit ? textOf(edit.h) || null : null
}

// HN is read every tick; the DB is hit when HN changes, and every DB_REFRESH_TICKS to pick up new DX/RX.
const DB_REFRESH_TICKS = 5
let lastHN, lastSent, tick = 0, busy
async function pollHN() {
  if (busy) return
  busy = true
  try {
    const hn = readHN()
    const refresh = ++tick % DB_REFRESH_TICKS === 0
    if (hn === lastHN && !refresh) return
    lastHN = hn
    let patient = null
    if (hn) {
      try {
        patient = await fetchPatient(hn)
      } catch (e) {
        console.error('fetchPatient', e.message)
      }
    }
    const payload = hn && { hn, ...patient }
    const json = JSON.stringify(payload)
    if (json !== lastSent) {
      lastSent = json
      win.webContents.send('patient', payload)
    }
  } finally {
    busy = false
  }
}

// Queue list "modal": its own frameless window, same renderer page with #queue.
let queueWin
function openQueue() {
  if (queueWin && !queueWin.isDestroyed()) return queueWin.focus()
  queueWin = new BrowserWindow({
    width: 960,
    height: 560,
    parent: win,
    frame: false,
    show: false,
    skipTaskbar: true,
    backgroundColor: '#21252b',
    icon: ICON,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs') },
  })
  queueWin.once('ready-to-show', () => queueWin.show())
  load(queueWin, 'queue')
}

// Dx/Rx modal, centered on screen (one at a time).
const POPUP = { width: 560, height: { dx: 200, rx: 380, lab: 340 } }
let popup
function openPopup(_e, kind) {
  if (popup && !popup.isDestroyed()) popup.close()
  popup = new BrowserWindow({
    width: POPUP.width,
    height: POPUP.height[kind],
    center: true,
    parent: win,
    frame: false,
    resizable: false,
    show: false,
    skipTaskbar: true,
    backgroundColor: '#21252b',
    icon: ICON,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs') },
  })
  popup.once('ready-to-show', () => popup.show())
  load(popup, kind)
}

// "Calling" feedback: a transparent, click-through speaker that fades in/out at screen center.
const CALL_SIZE = 320
let callWin
// One call per CALL_COOLDOWN_MS across all windows; every window is told when buttons unlock.
const CALL_COOLDOWN_MS = 5000
let callUntil = 0
function showCall(e) {
  if (Date.now() < callUntil) return
  callUntil = Date.now() + CALL_COOLDOWN_MS
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('call-cooldown', callUntil)
  if (callWin && !callWin.isDestroyed()) callWin.close()
  callWin = new BrowserWindow({
    width: CALL_SIZE,
    height: CALL_SIZE,
    center: true,
    parent: BrowserWindow.fromWebContents(e.sender), // owned → always above the caller (bar or queue modal)
    frame: false,
    transparent: true,
    resizable: false,
    focusable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    icon: ICON,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs') },
  })
  callWin.setIgnoreMouseEvents(true)
  callWin.once('ready-to-show', () => callWin.showInactive())
  load(callWin, 'call')
  const w = callWin
  setTimeout(() => !w.isDestroyed() && w.close(), 3200) // backstop if animationend never fires (CSS anim is 3s)
}

function load(w, hash) {
  if (process.env.VITE_DEV_URL) w.loadURL(process.env.VITE_DEV_URL + (hash ? `#${hash}` : ''))
  else w.loadFile(path.join(__dirname, '../dist/index.html'), { hash })
}

function unregisterAppBar() {
  if (abd) SHAppBarMessage(ABM_REMOVE, abd)
  abd = null
}

app.whenReady().then(() => {
  const b = screen.getPrimaryDisplay().bounds
  win = new BrowserWindow({
    x: b.x, y: b.y, width: b.width, height: BAR_HEIGHT,
    frame: false,
    thickFrame: false,
    resizable: false, // else frameless edges are resize hit-zones (swallowing clicks on the 8px handle); its size lock is bypassed by setPos
    movable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    icon: ICON,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs') },
  })
  hwnd = win.getNativeWindowHandle().readBigInt64LE(0) // ponytail: assumes 64-bit Electron
  tray = new Tray(ICON)
  tray.setToolTip('iQueue')
  tray.setContextMenu(Menu.buildFromTemplate([{ label: 'ออกจากโปรแกรม', click: () => app.quit() }]))
  win.once('ready-to-show', enter)
  win.on('move', () => setImmediate(enforcePos))
  win.on('resize', () => setImmediate(enforcePos))
  win.on('close', unregisterAppBar)
  ipcMain.on('collapse', collapse)
  ipcMain.on('expand', expand)
  ipcMain.on('open-queue', openQueue)
  ipcMain.on('open-popup', openPopup)
  ipcMain.on('call-queue', showCall)
  ipcMain.handle('get-call-cooldown', () => callUntil) // for windows opened mid-cooldown
  win.webContents.on('did-finish-load', () => { lastHN = lastSent = undefined }) // resend after reload
  setInterval(pollHN, 1000)
  load(win)
})

app.on('before-quit', unregisterAppBar)
app.on('window-all-closed', () => app.quit())
