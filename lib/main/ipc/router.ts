import { BrowserWindow, ipcMain, screen, desktopCapturer } from 'electron'

import { GeminiHelper } from '../../llm/GeminiHelper';
import { appState } from '@/lib/state/AppStateMachine'
import { LiveAudioService } from '@/lib/features/live-audio/LiveAudioService'
import { ShortcutsHelper } from '@/lib/main/shortcuts'
import { windowRegistry } from '@/lib/main/windowRegistry'
import { GroqHelper } from '@/lib/llm/GroqHelper'

interface IpcContext {
  liveAudioService: LiveAudioService
  shortcutsHelper: ShortcutsHelper,
  groqHelper: GroqHelper,
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
    groqHelper,
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

  ipcMain.on('set-current-input-value', (_event, value: string) => {
    setCurrentInputValue(value)
  })

  ipcMain.handle('streamGroqQuestions', async (_event, prevQuestions: string[], currentTranscript: string) => {
    const result = await groqHelper.streamQuestions(prevQuestions, currentTranscript, () => {});
    return result.actions;
  });

  ipcMain.on('input-changed', (_evt, value: string) => {
    setCurrentInputValue(value);
  });

  const geminiHelper = new GeminiHelper();
  let apiRequestController: AbortController | null = null;

  ipcMain.on('chat:submit', async (_evt, input: string) => {
    console.warn('chat:submit received', input);
    setCurrentInputValue(input);
    apiRequestController = new AbortController();
    try {
      // 1. Capture the primary screen
      const primaryDisplay = screen.getPrimaryDisplay();
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: primaryDisplay.size,
      });
      const primaryScreenSource = sources.find(
        (source) => source.display_id === String(primaryDisplay.id)
      ) || sources[0];

      if (!primaryScreenSource) {
        throw new Error('Could not find primary screen source for screenshot.');
      }

      const screenshotPng = primaryScreenSource.thumbnail.toPNG();

      if (!screenshotPng || screenshotPng.length === 0) {
        throw new Error('Failed to capture screenshot.');
      }

      const screenshotBase64 = screenshotPng.toString('base64');
      let isFirstChunk = true;
      await geminiHelper.sendMessageStream(
        input,
        (chunk) => {
          if (isFirstChunk) {
            broadcast('api-success');
            isFirstChunk = false;
          }
          broadcast('chat:chunk', chunk);
        },
        apiRequestController.signal,
        screenshotBase64
      );
    } catch (error) {
      console.error('Gemini API error:', error);
      broadcast('api-error', String(error));
    }
  });

  ipcMain.on('chat:cancel', () => {
    appState.dispatch('ESC');
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
      broadcast('live-audio-ready');
    } catch (err) {
      console.error('Failed to start audio services:', err);
      broadcast('live-audio-error', 'Failed to start audio services.');
      return;
    }
  });

  ipcMain.on('live-audio-chunk', (_event, chunk: Uint8Array) => {
    if (!liveAudioService.isActive()) {
      return;
    }
    liveAudioService.sendAudioChunk(Buffer.from(chunk));
  });

  ipcMain.on('live-audio-stop', () => {
    liveAudioService.stop();
  });

  ipcMain.on('live-audio-done', () => {
    if (!liveAudioService.isActive()) return;
    liveAudioService.finishTurn();
  });

  ipcMain.on('live-image-chunk', (_event, jpegBase64: string) => {
    liveAudioService.sendImageChunk(jpegBase64);
  });

  ipcMain.on('live-audio-toggle-gemini', (_event, mute: boolean) => {
    liveAudioService.toggleGeminiAudio(mute);
  });

  ipcMain.on('live-audio-send-text-input', (_event, _text: string) => {
    liveAudioService.sendTextInput(_text);
  });
}
