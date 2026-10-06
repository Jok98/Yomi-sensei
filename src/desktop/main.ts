import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeTheme,
  type MenuItemConstructorOptions,
} from 'electron';
import path from 'node:path';
import { Backend, validateRequest } from './backend';
import type { DesktopCommand } from '../shared/types';

if (process.env.YOMI_USER_DATA) app.setPath('userData', process.env.YOMI_USER_DATA);
let window: BrowserWindow | null = null;
let backend: Backend | null = null;
let ready: Promise<void>;
let quitting = false;
const send = (command: DesktopCommand) => window?.webContents.send('yomi:command', command);
const command = (
  label: string,
  type: DesktopCommand,
  accelerator?: string,
): MenuItemConstructorOptions => ({ label, accelerator, click: () => send(type) });

app.whenReady().then(async () => {
  nativeTheme.themeSource = 'dark';
  const root = app.isPackaged ? process.resourcesPath : path.resolve(__dirname, '..');
  backend = new Backend(root, app.isPackaged ? process.resourcesPath : undefined);
  ready = backend.start();
  void ready.catch(() => {});
  window = new BrowserWindow({
    title: 'Yomi Sensei',
    width: 1440,
    height: 960,
    minWidth: 820,
    minHeight: 620,
    backgroundColor: '#121212',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: process.env.YOMI_SMOKE !== '1',
    },
  });
  const renderer = window.webContents;
  ipcMain.handle('yomi:request', async (event, route, body) => {
    if (event.sender !== renderer || event.senderFrame !== renderer.mainFrame)
      throw new Error('Richiesta non consentita.');
    validateRequest(route, body);
    await ready;
    return backend!.request(route, body);
  });
  renderer.setWindowOpenHandler(() => ({ action: 'deny' }));
  renderer.on('will-navigate', (event) => event.preventDefault());
  renderer.session.setPermissionRequestHandler((_contents, _permission, callback) =>
    callback(false),
  );
  renderer.session.setPermissionCheckHandler(() => false);
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: '&Partita',
        submenu: [
          command('Nuova partita', 'new-game', 'CmdOrCtrl+N'),
          command('Annulla mossa', 'undo', 'CmdOrCtrl+Z'),
          { type: 'separator' },
          { label: 'Esci', role: 'quit' },
        ],
      },
      {
        label: '&Vista',
        submenu: [
          command('Pannello partita', 'toggle-left', 'CmdOrCtrl+B'),
          command('Pannello coach', 'toggle-right', 'CmdOrCtrl+Alt+B'),
          command('Ruota scacchiera', 'flip', 'CmdOrCtrl+F'),
          { type: 'separator' },
          { label: 'Ingrandisci', role: 'zoomIn' },
          { label: 'Riduci', role: 'zoomOut' },
          { label: 'Ripristina zoom', role: 'resetZoom' },
          { label: 'Schermo intero', role: 'togglefullscreen' },
        ],
      },
      {
        label: '&Analisi',
        submenu: [
          command('Ricalcola', 'analysis', 'CmdOrCtrl+Shift+R'),
          command('Impostazioni', 'settings', 'CmdOrCtrl+,'),
        ],
      },
      {
        label: '&Modifica',
        submenu: [
          { label: 'Copia', role: 'copy' },
          { label: 'Incolla', role: 'paste' },
          { label: 'Seleziona tutto', role: 'selectAll' },
        ],
      },
    ]),
  );
  window.on('ready-to-show', () => {
    if (process.env.YOMI_SMOKE !== '1') window?.show();
  });
  if (!app.isPackaged && process.env.YOMI_DEV_URL === 'http://127.0.0.1:5174')
    await window.loadURL(process.env.YOMI_DEV_URL);
  else await window.loadFile(path.join(__dirname, 'renderer', 'index.html'));
});
app.on('window-all-closed', () => app.quit());
app.on('before-quit', (event) => {
  if (quitting) return;
  event.preventDefault();
  quitting = true;
  void backend?.close().finally(() => app.quit());
});
