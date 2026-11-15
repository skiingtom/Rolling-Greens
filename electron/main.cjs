// Rolling Greens desktop shell: loads the built game from disk in a single window.
const { app, BrowserWindow, Menu, net, protocol, shell } = require('electron')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

// Serve the game from a private app:// origin rather than file://, so ES modules
// load normally and saved games live under one stable origin.
const SCHEME = 'app'
const HOST = 'rolling-greens'
const DIST = path.join(__dirname, '..', 'dist')

protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
  },
])

// One window per install; a second launch focuses the first
if (!app.requestSingleInstanceLock()) {
  app.quit()
}

let win = null

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: 'Rolling Greens',
    backgroundColor: '#7f9568',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  })

  win.once('ready-to-show', () => win.show())
  win.loadURL(`${SCHEME}://${HOST}/index.html`)

  // Any external link opens in the user's browser, never inside the game window
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(`${SCHEME}://${HOST}/`)) e.preventDefault()
  })

  // F11 toggles fullscreen; F12 opens devtools only in unpackaged runs
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return
    if (input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen())
      e.preventDefault()
    } else if (input.key === 'F12' && !app.isPackaged) {
      win.webContents.toggleDevTools()
    }
  })
}

app.on('second-instance', () => {
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.focus()
})

app.whenReady().then(() => {
  protocol.handle(SCHEME, (request) => {
    const { pathname } = new URL(request.url)
    const rel = decodeURIComponent(pathname).replace(/^\/+/, '') || 'index.html'
    const file = path.normalize(path.join(DIST, rel))
    // Never serve anything outside the bundled game
    if (!file.startsWith(DIST + path.sep)) return new Response('Not found', { status: 404 })
    return net.fetch(pathToFileURL(file).toString())
  })
  Menu.setApplicationMenu(null)
  createWindow()
})

app.on('window-all-closed', () => app.quit())
