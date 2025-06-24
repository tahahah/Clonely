import { app, BrowserWindow, desktopCapturer, ipcMain } from 'electron'
import { join } from 'path'
import { promises as fs } from 'fs'
import { tmpdir } from 'os'

/**
 * Capture system audio using Electron's desktopCapturer.
 * The function spins up a hidden renderer window (recorder.html) that
 * uses `getUserMedia` + `MediaRecorder` to grab a short WebM clip of the
 * desktop audio loop-back.
 *
 * It writes the recording to a temporary file and returns the path so the
 * existing main-process flow (which expects a file path + cleanup) keeps
 * working. If anything goes wrong it throws, allowing callers to fall back
 * gracefully.
 */
export async function captureSystemAudio (durationSeconds = 5): Promise<string> {
  // 1. Pick any screen source – we only need its id to satisfy Chrome.
  const sources = await desktopCapturer.getSources({ types: ['screen'] })
  if (!sources.length) {
    throw new Error('No desktop source available for audio capture')
  }
  const sourceId = sources[0].id

  // 2. Spawn an off-screen recorder window.
  const recorderWin = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  // Path to the recorder html – we load directly from the source tree so we
  // don’t rely on build pipelines copying assets.
  const htmlPath = join(app.getAppPath(), 'lib', 'main', 'audio', 'recorder.html')
  await recorderWin.loadFile(htmlPath)

  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('Audio capture timed out.'))
    }, (durationSeconds + 5) * 1000)

    function cleanup () {
      clearTimeout(timeout)
      if (!recorderWin.isDestroyed()) recorderWin.destroy()
      ipcMain.removeHandler('audio-captured')
    }

    ipcMain.once('audio-captured', async (_evt, base64: string | null) => {
      if (!base64) {
        cleanup()
        return reject(new Error('Recorder failed to return audio data'))
      }
      try {
        const filePath = join(tmpdir(), `cluely-audio-${Date.now()}.webm`)
        await fs.writeFile(filePath, Buffer.from(base64, 'base64'))
        cleanup()
        resolve(filePath)
      } catch (err) {
        cleanup()
        reject(err)
      }
    })

    // Kick off capture once the page is ready.
    recorderWin.webContents.once('did-finish-load', () => {
      recorderWin.webContents.send('start-capture', {
        id: sourceId,
        duration: durationSeconds * 1000
      })
    })
  })
}

/**
 * Delete the temporary file created by `captureSystemAudio`.
 * Swallows any error – best-effort cleanup only.
 */
export async function cleanupAudioFile (filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath)
  } catch (_) {}
}
