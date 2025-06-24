import type { BrowserWindow } from 'electron'

/*
 * Applies the Windows API call `SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)`
 * to exclude a given BrowserWindow from most software-based screen-capture utilities
 * (Snipping Tool, OBS, Electron desktopCapturer, etc.).
 *
 * The implementation is Windows-only and safely no-ops on any other platform or if
 * the native module fails to load (e.g. missing pre-build for current Electron).
 */
export function applyWindowCaptureProtection(win: BrowserWindow): void {
  if (process.platform !== 'win32') return

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { app } = require('electron')
    const path = require('path')
    // app.getAppPath() points to ./out in dev/packaged builds. Native folder sits one level up.
    const addonBase = path.join(path.dirname(app.getAppPath()), 'native', 'screen_protection')

    const handleBuffer: Buffer = win.getNativeWindowHandle()

    // Directly require the compiled .node binary (built via electron-rebuild)
    let binaryPath = path.join(addonBase, 'build', 'Release', 'screen_protection.node')
    if (!require('fs').existsSync(binaryPath)) {
      // Fallback when code is executed from out/main/chunks/*
      const altBase = path.resolve(__dirname, '../../../native/screen_protection')
      binaryPath = path.join(altBase, 'build', 'Release', 'screen_protection.node')
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const screenProt = require(binaryPath)

    const success = screenProt.setProtection(handleBuffer, true)
    if (!success) {
      console.warn('[WindowProtect] native setProtection returned FALSE')
    }
  } catch (err) {
    console.warn('[WindowProtect] Native addon not available; skipping capture protection', err)
  }
}
