const path = require("path");
const { app, BrowserWindow, session, utilityProcess } = require("electron");
let agentProcess = null;

function startLocalAgent() {
  if (agentProcess) return;
  try {
    const agentPath = path.join(__dirname, "agent_jarvis.js");
    // Utilisation du processus utilitaire d'Electron (utilise le Node interne)
    agentProcess = utilityProcess.fork(agentPath, [], {
      stdio: "pipe",
      env: {
        ...process.env,
        JARVISSE_RESOURCES_PATH: process.resourcesPath || "",
      }
    });
    
    agentProcess.stdout?.on("data", (d) => console.log(`[AGENT] ${String(d).trim()}`));
    agentProcess.stderr?.on("data", (d) => console.error(`[AGENT_ERR] ${String(d).trim()}`));
    
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

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    autoHideMenuBar: true,
    backgroundColor: "#05060f",
    webPreferences: {
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
      webSecurity: true
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    require("electron").shell.openExternal(url);
    return { action: "deny" };
  });

  const devUrl = process.env.ELECTRON_START_URL;
  if (devUrl) {
    win.loadURL(devUrl);
  } else {
    win.loadFile(path.join(__dirname, "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  allowMediaPermissions();
  startLocalAgent();
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
