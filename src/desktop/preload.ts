import { contextBridge, ipcRenderer } from 'electron';
import type { ApiRoute, DesktopBridge, DesktopCommand } from '../shared/types';

const bridge: DesktopBridge = {
  request: <T>(route: ApiRoute, body?: unknown) =>
    ipcRenderer.invoke('yomi:request', route, body) as Promise<T>,
  onCommand(listener) {
    const handler = (_event: Electron.IpcRendererEvent, command: DesktopCommand) =>
      listener(command);
    ipcRenderer.on('yomi:command', handler);
    return () => ipcRenderer.removeListener('yomi:command', handler);
  },
};
contextBridge.exposeInMainWorld('yomi', bridge);
