import express from 'express';
import cors from 'cors';
import { exec, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Log des requêtes
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] Commande reçue:`, req.body);
  next();
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
      // Tente de lancer le processus (ex: chrome, notepad, photoshop)
      command = `start "" "${value}"`;
      break;
    case 'search':
      command = `start "" "https://www.google.com/search?q=${encodeURIComponent(value)}"`;
      break;
    case 'system':
      if (value === 'shutdown') command = 'shutdown /s /t 60'; 
      if (value === 'cancel_shutdown') command = 'shutdown /a';
      break;
    case 'capture_screen':
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
        fs.unlinkSync(screenshotPath); // Ménage après capture
        return res.send({ status: 'success', image: `data:image/png;base64,${imageBase64}` });
      } catch (err) {
        console.error("Erreur Capture:", err);
        return res.status(500).send({ error: "Échec de la capture d'écran" });
      }
      break;
    case 'open_folder':
      command = `explorer "${value}"`;
      break;
    default:
      return res.status(400).send({ error: 'Action non reconnue' });
  }

  if (command) {
    exec(command, (error) => {
      if (error) {
        console.error(`Erreur d'exécution: ${error}`);
        return res.status(500).send({ error: 'Erreur système lors de l\'exécution' });
      }
      res.send({ status: 'success', message: `Exécution de: ${action}` });
    });
  }
});

app.listen(PORT, () => {
  console.log(`
  ===========================================
     AGENT JARVISSE - SYSTÈME ACTIF
  ===========================================
  Écoute sur : http://localhost:${PORT}
  
  Statut : PRÊT POUR LES ORDRES (WINDOWS)
  ===========================================
  `);
});
