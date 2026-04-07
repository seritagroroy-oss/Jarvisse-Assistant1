# 🤖 GUIDE D'INSTALLATION JARVISSE AI (PRO)

Félicitations Monsieur Roy. Votre assistant est prêt pour le déploiement global. Voici comment initialiser le système complet.

## 📦 1. Prérequis Système
- **Node.js v18+** : [Télécharger ici](https://nodejs.org/)
- **Clé API OpenAI / Google** : Pour le cerveau de l'IA.
- **Port 3001, 3000, 5173** : Doivent être libres.

---

## 🚀 2. Installation Rapide (Windows)

1. **Extraction** : Placez tous les fichiers dans un dossier `Jarvisse-AI`.
2. **Configuration** : Créez un fichier `.env` dans le dossier racine avec :
   ```env
   JWT_SECRET=votre_secret_tactique
   OPENAI_API_KEY=votre_cle
   GOOGLE_API_KEY=votre_cle_studio
   ```
3. **Lancement** : Double-cliquez sur `SETUP_JARVISSE.bat`.

---

## 🖥️ 3. Fonctionnement des Modules

### 🧠 A. Le Backend (`api/index.js`)
C'est le cerveau central qui gère l'authentification et les appels aux modèles (GPT, Gemini, Llama).
- Commande : `npm start` (Port 3000)

### 📡 B. L'Agent Local (`agent_jarvis.js`)
C'est le module de contrôle PC. **INDISPENSABLE** pour ouvrir vos apps et fichiers.
- Commande : `node agent_jarvis.js` (Port 3001)

### 🎨 C. L'Interface Web (`client/`)
Le HUD futuriste accessible via votre navigateur.
- Commande : `npm run dev` (Port 5173)

---

## 🔐 4. Sécurité & Droits
- Lors du premier lancement de l'Agent PC, Windows peut demander une autorisation de **Pare-feu**. Acceptez pour permettre au HUD de communiquer avec votre PC.
- Ne partagez jamais votre fichier `.env`.

---

## 💎 5. Version Premium
Pour activer les fonctions Pro :
- Créez un compte via l'interface.
- Les crédits sont gérés en base de données (MongoDB recommandé pour la production).

---
*Jarvisse - Protokol Stark v7.0.1*
