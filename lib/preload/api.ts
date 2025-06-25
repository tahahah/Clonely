import { ipcRenderer } from 'electron';


const api = {
  enableLoopback: (): Promise<void> => ipcRenderer.invoke('enable-loopback-audio'),
  disableLoopback: (): Promise<void> => ipcRenderer.invoke('disable-loopback-audio'),
  send: (channel: string, ...args: any[]) => {
    ipcRenderer.send(channel, ...args)
  },
  receive: (channel: string, func: (...args: any[]) => void) => {
    ipcRenderer.on(channel, (_, ...args) => func(...args))
  },
  invoke: (channel: string, ...args: any[]) => {
    return ipcRenderer.invoke(channel, ...args)
  },
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel)
  },
}

export default api
