import { BrowserWindow } from 'electron'

/**
 * Central registry for key BrowserWindow instances.
 * Keeps weak references so that other modules can broadcast
 * messages without maintaining their own copies.
 */
class WindowRegistry {
  private _mainWindow: BrowserWindow | null = null
  private _chatWindow: BrowserWindow | null = null

  get mainWindow(): BrowserWindow | null {
    return this._mainWindow && !this._mainWindow.isDestroyed()
      ? this._mainWindow
      : null
  }

  get chatWindow(): BrowserWindow | null {
    return this._chatWindow && !this._chatWindow.isDestroyed()
      ? this._chatWindow
      : null
  }

  setMainWindow(win: BrowserWindow | null) {
    if (win && win.isDestroyed()) {
      this._mainWindow = null
    } else {
      this._mainWindow = win
    }
  }

  setChatWindow(win: BrowserWindow | null) {
    if (win && win.isDestroyed()) {
      this._chatWindow = null
    } else {
      this._chatWindow = win
    }
  }

  /** Broadcast helper */
  broadcast(channel: string, ...args: any[]) {
    if (this.mainWindow) {
      this.mainWindow.webContents.send(channel, ...args)
    }
    if (this.chatWindow) {
      this.chatWindow.webContents.send(channel, ...args)
    }
  }
}

export const windowRegistry = new WindowRegistry()
