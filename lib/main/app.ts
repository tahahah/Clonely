import { BrowserWindow, shell, app } from 'electron'

import { join } from 'path'
import { registerWindowIPC } from '@/lib/window/ipcEvents'
import appIcon from '@/resources/build/icon.png?asset'

export function createAppWindow(isInvisible = false): BrowserWindow {
  // const isDev = !app.isPackaged && !!process.env.ELECTRON_RENDERER_URL;
  const isDev = false;
  // Get the primary display's size and use it for the window dimensions.
  const { width, height } = require('electron').screen.getPrimaryDisplay().workAreaSize
  const mainWindow = new BrowserWindow({
    // width: Math.floor(width),
    // height: Math.floor(height),
    fullscreen: !isDev, // easier dev debugging
    skipTaskbar: !isDev, // show in taskbar during dev
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      sandbox: false
    },
    show: true,
    alwaysOnTop: !isDev, // avoid hiding behind others in dev
    frame: false,
    transparent: !isDev,
    // fullscreenable: false,
    hasShadow: false,
    focusable: true,
    icon: appIcon,
    titleBarStyle: 'hiddenInset',
    title: 'Clonely',
    // maximizable: false,
    resizable: false,
    backgroundMaterial: isDev ? undefined : 'acrylic',
    backgroundColor: isDev ? '#1e1e1e' : undefined
  })
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);

  if (!isInvisible) {
    // Prevent the window from appearing in most software screen captures (Windows).
    mainWindow.setContentProtection(true)
    if (process.platform === 'win32') {
      void import('@/lib/main/protectWindow')
        .then(({ applyWindowCaptureProtection }) => {
          applyWindowCaptureProtection(mainWindow)
        })
        .catch(() => {})
    }
  }

  // Register IPC events for the main window.
  registerWindowIPC(mainWindow)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return mainWindow
}