import { app } from 'electron'
import { ClonelyApp } from './Clonely'
import { AudioHelper } from '../audio/AudioHelper'
import { performance } from 'node:perf_hooks';

const t0 = performance.now();
console.log("Starting main process...")
// Initialize audio capture functionality before the app is ready.
AudioHelper.initialize()


// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// This is a necessary workaround for electron-squirrel-startup.
// eslint-disable-next-line @typescript-eslint/no-var-requires
if (require('electron-squirrel-startup')) {
  app.quit()
}

// Instantiate the app. This will handle all app lifecycle events.
new ClonelyApp(t0)

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
