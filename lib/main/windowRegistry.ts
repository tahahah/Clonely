import { BrowserWindow } from 'electron'

/**
 * Central registry for key BrowserWindow instances.
 * Keeps weak references so that other modules can broadcast
 * messages without maintaining their own copies.
 */
class WindowRegistry {
  private static instance: WindowRegistry
  private _mainWindow: BrowserWindow | null = null

  private constructor() {}

  public static getInstance(): WindowRegistry {
    if (!WindowRegistry.instance) {
      WindowRegistry.instance = new WindowRegistry()
    }
    return WindowRegistry.instance
  }

  public setMainWindow(win: BrowserWindow): void {
    this._mainWindow = win
  }

  public getMainWindow(): BrowserWindow | null {
    return this._mainWindow
  }

  public broadcast(channel: string, ...args: any[]): void {
    if (this._mainWindow && !this._mainWindow.isDestroyed()) {
      this._mainWindow.webContents.send(channel, ...args)
    }
  }
}

export const windowRegistry = WindowRegistry.getInstance()
