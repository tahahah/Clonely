import { BrowserWindow, ipcMain } from 'electron'
import { appState } from '@/lib/state/AppStateMachine'
import { LiveAudioService } from '@/lib/features/live-audio/LiveAudioService'
import { ShortcutsHelper } from '@/lib/main/shortcuts'
import { windowRegistry } from '@/lib/main/windowRegistry'

interface IpcContext {
  liveAudioService: LiveAudioService
  shortcutsHelper: ShortcutsHelper
  createAppWindow: (invisible: boolean) => BrowserWindow
  // window tracking
  getMainWindow: () => BrowserWindow | null
  setMainWindow: (win: BrowserWindow) => void
  // invisibility toggle
  getIsInvisible: () => boolean
  setIsInvisible: (val: boolean) => void
  // current input value tracking
  setCurrentInputValue: (val: string) => void
}

export function registerIpcHandlers(ctx: IpcContext): void {
  /* ---------------- build-time helpers ---------------- */
  const {
    liveAudioService,
    shortcutsHelper,
    createAppWindow,
    getMainWindow,
    setMainWindow,
    getIsInvisible,
    setIsInvisible,
    setCurrentInputValue
  } = ctx;

  /* ---------------- generic helpers ---------------- */
  const broadcast = (channel: string, ...args: any[]) => {
    windowRegistry.broadcast(channel, ...args);
  };

  /* ---------------- basic handlers ---------------- */
  ipcMain.handle('get-invisibility-state', () => getIsInvisible());

  ipcMain.on('quit-app', () => {
    import('electron').then(({ app }) => app.quit());
  });

  ipcMain.on('input-changed', (_evt, value: string) => {
    setCurrentInputValue(value);
  });

  ipcMain.on('open-chat', () => {
    appState.dispatch('OPEN_CHAT');
  });

  /* ---------------- toggle invisibility ---------------- */
  ipcMain.on('toggle-invisibility', () => {
    const newInvisible = !getIsInvisible();
    setIsInvisible(newInvisible);

    // Close existing windows
    const m = getMainWindow();
    if (m && !m.isDestroyed()) m.close();

    // Recreate with new setting
    const newMain = createAppWindow(newInvisible);
    setMainWindow(newMain);
    shortcutsHelper.updateMainWindow(newMain);

    newMain.webContents.on('did-finish-load', () => {
      if (!newMain.isDestroyed()) {
        newMain.webContents.send('invisibility-state-changed', newInvisible);
      }
    });

    broadcast('invisibility-state-changed', newInvisible);
  });

  /* ---------------- live-audio handlers ---------------- */
  ipcMain.on('live-audio-start', async () => {
    if (liveAudioService.isActive()) {
      console.warn('[IPC] live-audio-start ignored – already active');
      return;
    }
    try {
      await liveAudioService.start({
        onGeminiChunk: (chunk) => {
          broadcast('gemini-transcript', chunk);
        },
        onTranscript: (text) => {
          broadcast('live-transcript', text);
        }
      });
    } catch (err) {
      console.error('[IPC] Failed to start live audio', err);
      broadcast('live-audio-error', 'Failed to start audio services.');
      return;
    }
  });

  ipcMain.on('live-audio-chunk', (_e, chunk: Uint8Array) => {
    if (!liveAudioService.isActive()) return;
    liveAudioService.sendAudioChunk(Buffer.from(chunk));
  });

  ipcMain.on('live-audio-stop', () => {
    if (!liveAudioService.isActive()) return;
    liveAudioService.stop();
  });

  ipcMain.on('live-audio-done', () => {
    if (!liveAudioService.isActive()) return;
    liveAudioService.finishTurn();
  });

  ipcMain.on('live-image-chunk', (_e, jpegBase64: string) => {
    liveAudioService.sendImageChunk(jpegBase64);
  });
}
