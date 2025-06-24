import { BrowserWindow, shell, app, screen } from 'electron'
import { join } from 'path'
import { registerWindowIPC, registerChatWindowIPC } from '@/lib/window/ipcEvents'
import appIcon from '@/resources/build/icon.png?asset'

export function createAppWindow(): BrowserWindow {
  const workArea = screen.getPrimaryDisplay().workAreaSize
  const screenWidth = workArea.width
  const screenHeight = workArea.height

  // Create the main window.
  const mainWindow = new BrowserWindow({
    width: 600,
    height: 50,
    x: Math.floor(screenWidth / 2) - 300,
    y: 10,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      sandbox: false,
    },
    show: false,
    alwaysOnTop: true,
    frame: false,
    transparent: true,
    fullscreenable: false,
    hasShadow: false,
    focusable: true,
    icon: appIcon,
    titleBarStyle: 'hiddenInset',
    title: 'CluelyHireMe',
    maximizable: false,
    resizable: false,
    backgroundMaterial: 'acrylic'

  })

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
  return mainWindow;
}

export function createChatWindow(): BrowserWindow {
  const workArea = screen.getPrimaryDisplay().workAreaSize
  const screenWidth = workArea.width
  const screenHeight = workArea.height

  // Create the main window.
  const chatWindow = new BrowserWindow({
    width: 600,
    height: Math.floor(screenHeight / 2),
    x: Math.floor(screenWidth / 2) - 300,
    y: 60,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      sandbox: false,
    },
    show: false,
    alwaysOnTop: true,
    frame: false,
    transparent: true,
    fullscreenable: false,
    hasShadow: false,
    focusable: true,
    icon: appIcon,
    titleBarStyle: 'hiddenInset',
    title: 'Chat',
    maximizable: false,
    resizable: false,
  })

  registerChatWindowIPC(chatWindow);


  chatWindow.on('ready-to-show', () => {
    chatWindow.show()
  })

  chatWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    chatWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/ai.html`)
  } else {
    chatWindow.loadFile(join(__dirname, '../renderer/ai.html'))
  }
  console.log("Chat window created");
  return chatWindow; 
}