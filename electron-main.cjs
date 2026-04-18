const path = require("path");
const { app, BrowserWindow, session, utilityProcess } = require("electron");

let agentProcess = null;
let splashWindow = null;
let mainWindow = null;

// ─────────────────────────────────────────────
//  AGENT — démarrage ASYNCHRONE en arrière-plan
// ─────────────────────────────────────────────
function startLocalAgent() {
  if (agentProcess) return;
  try {
    const agentPath = path.join(__dirname, "agent_jarvis.js");
    agentProcess = utilityProcess.fork(agentPath, [], {
      stdio: "pipe",
      env: {
        ...process.env,
        JARVISSE_RESOURCES_PATH: process.resourcesPath || "",
      },
    });

    agentProcess.stdout?.on("data", (d) =>
      console.log(`[AGENT] ${String(d).trim()}`)
    );
    agentProcess.stderr?.on("data", (d) =>
      console.error(`[AGENT_ERR] ${String(d).trim()}`)
    );
    agentProcess.on("exit", (code) => {
      console.log(`[AGENT] exited: ${code}`);
      agentProcess = null;
    });
  } catch (e) {
    console.error("Agent launch failed:", e);
  }
}

function stopLocalAgent() {
  if (!agentProcess) return;
  agentProcess.kill();
  agentProcess = null;
}

// ─────────────────────────────────────────────
//  PERMISSIONS MEDIA
// ─────────────────────────────────────────────
function allowMediaPermissions() {
  const ses = session.defaultSession;

  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === "media" || permission === "microphone") {
      callback(true);
      return;
    }
    callback(false);
  });

  ses.setPermissionCheckHandler((webContents, permission) => {
    if (permission === "media" || permission === "microphone") return true;
    return false;
  });
}

// ─────────────────────────────────────────────
//  SPLASH SCREEN — affiché instantanément
// ─────────────────────────────────────────────
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 480,
    height: 320,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    center: true,
    backgroundColor: "#05060f",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  splashWindow.loadFile(path.join(__dirname, "splash.html"));
  splashWindow.on("closed", () => { splashWindow = null; });
}

// ─────────────────────────────────────────────
//  FENÊTRE PRINCIPALE
// ─────────────────────────────────────────────
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    autoHideMenuBar: true,
    backgroundColor: "#05060f",
    show: false, // cachée jusqu'à ce que tout soit prêt
    webPreferences: {
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
      webSecurity: true,
      autoplayPolicy: "no-user-gesture-required",
    },
  });

  // Autorisation micro au niveau fenêtre
  mainWindow.webContents.session.setPermissionCheckHandler(
    (webContents, permission) => {
      if (permission === "media" || permission === "microphone") return true;
      return false;
    }
  );

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require("electron").shell.openExternal(url);
    return { action: "deny" };
  });

  // Dès que la page est prête → on ferme le splash et on montre l'app
  mainWindow.once("ready-to-show", () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
    }
    mainWindow.show();
    mainWindow.focus();
  });

  const devUrl = process.env.ELECTRON_START_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, "dist-frontend", "index.html"));
  }
}

// ─────────────────────────────────────────────
//  BOOTSTRAP
// ─────────────────────────────────────────────
app.whenReady().then(() => {
  allowMediaPermissions();

  // 1. Splash affiché en premier (instantané)
  createSplashWindow();

  // 2. Agent démarré en tâche de fond (n'attend pas)
  setImmediate(() => startLocalAgent());

  // 3. Fenêtre principale chargée en parallèle
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  stopLocalAgent();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  stopLocalAgent();
});
