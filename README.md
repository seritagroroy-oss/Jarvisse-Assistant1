# 🚀 JARVISSE ASSISTANT

Bienvenue dans votre propre plateforme d'IA capable d'interroger simultanment **GPT-4o mini** (OpenAI) et **Gemini 1.5 Flash** (Google).

## 🛠️ Installation & Lancement

### 1. Prparation des cls API
- Renommez le fichier `server/.env.example` en `server/.env`.
- Ajoutez vos cls API (OpenAI et Google Gemini).

### 2. Lancer le Backend
Allez dans le dossier `server` et excutez les commandes suivantes :
```bash
cd server
npm install
node server.js
```

### 3. Lancer le Frontend
Ouvrez simplement le fichier `public/index.html` dans votre navigateur prfr (Chrome, Edge, Firefox).

## ✨ Fonctionnalits
- **Multi-IA** : Comparez les rponses de GPT et Gemini en temps rel.
- **Design Premium** : Interface ultra-moderne avec Glassmorphism et animations fluides.
- **Rate Limiting** : Protection intgre contre les abus de requtes.
- **Responsive** : Parfaitement utilisable sur mobile et tablette.

## 📦 Structure du projet
- `server/` : Backend Node.js / Express
- `public/` : Frontend autonome (HTML/CSS/JS)
- `client/` : (Optionnel) Structure prte pour une application React complexe

---
*Dvelopp par Antigravity pour Jarvisse Assistant*
