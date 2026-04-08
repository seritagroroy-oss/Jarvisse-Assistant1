import express from 'express';
import cors from 'cors';
import { exec, execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = 3001;
const STARK_EARS_PORT = 3002;
const STARK_EARS_URL = `http://127.0.0.1:${STARK_EARS_PORT}`;
let starkProcess = null;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] Requete: ${req.method} ${req.path}`);
  next();
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const exists = (p) => {
  try { return fs.existsSync(p); } catch (_) { return false; }
};

const resolveStarkEarsLaunch = () => {
  const resourceRoot = process.env.JARVISSE_RESOURCES_PATH || process.resourcesPath || '';
  const explicitExe = process.env.JARVISSE_STARK_EARS_EXE || '';
  const exeCandidates = [
    explicitExe,
    path.join(resourceRoot, 'stark-ears', 'stark_ears.exe'),
    path.join(__dirname, 'jarvisse-native-builds', 'stark-ears', 'stark_ears.exe'),
    path.join(process.cwd(), 'jarvisse-native-builds', 'stark-ears', 'stark_ears.exe')
  ].filter(Boolean);

  for (const exePath of exeCandidates) {
    if (exists(exePath)) return { cmd: exePath, args: [], cwd: path.dirname(exePath), mode: 'exe' };
  }

  const pyCandidates = [
    path.join(__dirname, 'stark_ears.py'),
    path.join(process.cwd(), 'stark_ears.py')
  ];
  const scriptPath = pyCandidates.find(exists);
  if (scriptPath) return { cmd: 'python', args: [scriptPath], cwd: path.dirname(scriptPath), mode: 'python' };
  return null;
};

const startStarkEars = () => {
  if (starkProcess) return;
  try {
    const launch = resolveStarkEarsLaunch();
    if (!launch) {
      console.error('[STARK_EARS] Aucun binaire .exe ni script stark_ears.py trouve.');
      return;
    }

    const env = { ...process.env, STARK_EARS_PORT: String(STARK_EARS_PORT) };
    starkProcess = spawn(launch.cmd, launch.args, {
      cwd: launch.cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });

    console.log(`[STARK_EARS] Demarrage mode: ${launch.mode} (${launch.cmd})`);
    starkProcess.stdout?.on('data', (d) => console.log(`[STARK_EARS] ${String(d).trim()}`));
    starkProcess.stderr?.on('data', (d) => console.error(`[STARK_EARS_ERR] ${String(d).trim()}`));
    starkProcess.on('exit', (code) => {
      console.log(`[STARK_EARS] Process exited with code ${code}`);
      starkProcess = null;
    });
  } catch (e) {
    console.error('[STARK_EARS] Start failed:', e.message);
  }
};

const ensureStarkEarsReady = async () => {
  startStarkEars();
  for (let i = 0; i < 20; i++) {
    try {
      const r = await fetch(`${STARK_EARS_URL}/`);
      if (r.ok) return true;
    } catch (_) {}
    await sleep(250);
  }
  return false;
};

app.get('/', async (req, res) => {
  const ok = await ensureStarkEarsReady();
  res.status(ok ? 200 : 503).send({
    status: ok ? 'Agent JARVISSE + STARK EARS en ligne' : 'Agent en ligne, STARK EARS indisponible'
  });
});

app.get('/transcript', async (req, res) => {
  const ready = await ensureStarkEarsReady();
  if (!ready) return res.status(503).send({ text: '', error: 'STARK_EARS_OFFLINE' });
  try {
    const r = await fetch(`${STARK_EARS_URL}/transcript`);
    const data = await r.json().catch(() => ({ text: '' }));
    return res.status(r.ok ? 200 : 502).send(data);
  } catch (e) {
    return res.status(502).send({ text: '', error: 'TRANSCRIPT_PROXY_FAILED' });
  }
});

app.post('/command', async (req, res) => {
  const ready = await ensureStarkEarsReady();
  if (!ready) return res.status(503).send({ status: 'failed', error: 'STARK_EARS_OFFLINE' });
  try {
    const r = await fetch(`${STARK_EARS_URL}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {})
    });
    const data = await r.json().catch(() => ({ status: 'no change' }));
    return res.status(r.ok ? 200 : 502).send(data);
  } catch (e) {
    return res.status(502).send({ status: 'failed', error: 'COMMAND_PROXY_FAILED' });
  }
});

app.post('/execute', (req, res) => {
  const { action, value } = req.body;

  if (!action) {
    return res.status(400).send({ error: 'Action manquante' });
  }

  let command = '';

  switch (action) {
    case 'open_url':
      command = `start "" "${value}"`;
      break;
    case 'open_app':
      command = `start "" "${value}"`;
      break;
    case 'search':
      command = `start "" "https://www.google.com/search?q=${encodeURIComponent(value)}"`;
      break;
    case 'system':
      if (value === 'shutdown') command = 'shutdown /s /t 60';
      if (value === 'cancel_shutdown') command = 'shutdown /a';
      break;
    case 'capture_screen': {
      const screenshotPath = path.join(process.cwd(), 'screenshot.png');
      const powershellCommand = `
        Add-Type -AssemblyName System.Windows.Forms;
        Add-Type -AssemblyName System.Drawing;
        $Screen = [System.Windows.Forms.Screen]::PrimaryScreen;
        $Width = $Screen.Bounds.Width;
        $Height = $Screen.Bounds.Height;
        $Top = $Screen.Bounds.Top;
        $Left = $Screen.Bounds.Left;
        $Bitmap = New-Object System.Drawing.Bitmap($Width, $Height);
        $Graphic = [System.Drawing.Graphics]::FromImage($Bitmap);
        $Graphic.CopyFromScreen($Left, $Top, 0, 0, $Bitmap.Size);
        $Bitmap.Save("${screenshotPath}", [System.Drawing.Imaging.ImageFormat]::Png);
        $Graphic.Dispose();
        $Bitmap.Dispose();
      `;

      try {
        execSync(`powershell -Command "${powershellCommand.replace(/\n/g, ' ')}"`);
        const imageBase64 = fs.readFileSync(screenshotPath, { encoding: 'base64' });
        fs.unlinkSync(screenshotPath);
        return res.send({ status: 'success', image: `data:image/png;base64,${imageBase64}` });
      } catch (err) {
        console.error('Erreur Capture:', err);
        return res.status(500).send({ error: "Echec de la capture d'ecran" });
      }
    }
    case 'open_folder':
      command = `explorer "${value}"`;
      break;
    default:
      return res.status(400).send({ error: 'Action non reconnue' });
  }

  if (command) {
    exec(command, (error) => {
      if (error) {
        console.error(`Erreur d'execution: ${error}`);
        return res.status(500).send({ error: "Erreur systeme lors de l'execution" });
      }
      res.send({ status: 'success', message: `Execution de: ${action}` });
    });
  }
});

app.listen(PORT, async () => {
  console.log(`\n===========================================\n AGENT JARVISSE - SYSTEME ACTIF\n===========================================\n Ecoute sur : http://localhost:${PORT}\n===========================================\n`);
  await ensureStarkEarsReady();
});

const shutdown = () => {
  if (starkProcess) {
    starkProcess.kill();
    starkProcess = null;
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
