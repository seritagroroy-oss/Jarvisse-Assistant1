const { app, BrowserWindow } = require('electron');
const path = require('path');

// Verrou d'instance unique pour éviter les ralentissements dus à plusieurs lancements
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Si on tente de lancer une deuxième fois, on focus la fenêtre existante
    const windows = BrowserWindow.getAllWindows();
    if (windows.length) {
      if (windows[0].isMinimized()) windows[0].restore();
      windows[0].focus();
    }
  });

  function createWindow() {
    const win = new BrowserWindow({
      width: 1200,
      height: 800,
      show: false, // On ne montre la fenêtre que quand elle est prête
      backgroundColor: '#05060f',
      icon: path.join(__dirname, '../public/icon.png'),
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        webSecurity: false,
        backgroundThrottling: true,
        autoplayPolicy: 'no-user-gesture-required' // Pour que JARVISSE puisse parler sans clic préalable
      },
      autoHideMenuBar: true
    });

    win.once('ready-to-show', () => {
      win.show();
    });

    win.loadFile(path.join(app.getAppPath(), 'dist/index.html'));
  }

  app.whenReady().then(() => {
    // FORCER LES PERMISSIONS MICRO ET CAMERA
    const { session } = require('electron');
    session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
      // Autorisation forcée pour le microphone et la capture audio
      if (['media', 'audioCapture', 'notifications'].includes(permission)) return true;
      return true;
    });
    session.defaultSession.setDevicePermissionHandler((details) => {
      // Autorisation forcée pour les périphériques audio
      if (details.deviceType === 'audio' || details.deviceType === 'video') return true;
      return true;
    });

    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
