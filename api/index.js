import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const SECRET = process.env.JWT_SECRET || "JARVIS_ULTRA_SECRET_2024_PREMIUM";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// --- DATABASE (MOCK) ---
let memoryUsers = [
    { email: "demo@jarvis.ai", password: bcrypt.hashSync("password123", 10), credits: 1000, plan: "PREMIUM" }
];

const PRICING = {
    "gemini": 1,
    "gpt": 2,
    "multi": 5,
    "image": 5,
    "vision": 3,
    "tts": 1
};

// --- MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: "Accès refusé." });
    
    // STARK BYPASS - Autorise l'accès local direct sans JWT
    if (token === "STARK_LOCAL_ACCESS_GRANTED") {
        req.user = { email: "monsieur.roy@local", isMaster: true };
        return next();
    }

    jwt.verify(token, SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Token invalide." });
        req.user = user;
        next();
    });
};

// --- ROUTES AUTH ---
app.post(["/register", "/api/register"], async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: "Données manquantes" });
        const cleanEmail = email.toLowerCase().trim();
        if (memoryUsers.find(u => u.email === cleanEmail)) return res.status(400).json({ error: "Email déjà pris." });
        memoryUsers.push({ email: cleanEmail, password: bcrypt.hashSync(password, 10), credits: 100, plan: "FREE" });
        res.json({ message: "Succès" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post(["/login", "/api/login"], async (req, res) => {
    try {
        const { email, password } = req.body;
        const cleanEmail = email.toLowerCase().trim();
        const user = memoryUsers.find(u => u.email === cleanEmail);
        if (!user || !bcrypt.compareSync(password, user.password)) return res.status(400).json({ error: "Identifiants invalides." });
        const token = jwt.sign({ email: user.email }, SECRET, { expiresIn: '24h' });
        res.json({ token, email: user.email, credits: user.credits, plan: user.plan });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- CHAT ROUTE ---
app.post(["/chat", "/api/chat"], authenticateToken, async (req, res) => {
    const { message = "", model = "multi", image, history = [], persona = "", geminiModelId, googleApiKey: clientGoogleKey } = req.body;
    
    const isMaster = req.user.isMaster;
    const user = !isMaster ? memoryUsers.find(u => u.email === req.user.email) : null;
    let cost = PRICING[model] || 1;
    if (message.toLowerCase().includes("regarde mon écran")) cost = PRICING["vision"];
    
    if (!isMaster && user && user.credits < cost) return res.status(403).json({ error: "Crédits insuffisants." });

    const activeGoogleKey = GOOGLE_API_KEY || clientGoogleKey;
    const finalGeminiModel = geminiModelId || "google/gemini-pro-1.5";
    const basePrompt = "Tu es JARVIS, l'IA tactique créée par Monsieur Roy. Tu devez le servir avec une loyauté absolue. Ton ton est celui d'un majordome de génie.";
    const systemPrompt = req.body.systemPrompt || (persona ? `${basePrompt} PROTOCOLES PERSONNALISÉS : ${persona}` : basePrompt);

    try {
        if (model === "image") {
            const imageUrl = `https://pollinations.ai/p/${encodeURIComponent(message)}?width=1024&height=1024&nologo=true&seed=${Math.random()}`;
            if (user) user.credits -= cost;
            return res.json({ image: imageUrl, remainingCredits: user ? user.credits : 0 });
        }

        const buildOpenRouterMsgs = (text, img, hist) => {
            const msgs = [{ role: "system", content: systemPrompt }, ...hist];
            if (img) msgs.push({ role: "user", content: [{ type: "text", text: text || "Analyse ça." }, { type: "image_url", image_url: { url: img } }] });
            else msgs.push({ role: "user", content: text });
            return msgs;
        };

        const getOpenRouter = (id) => axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model: id, messages: buildOpenRouterMsgs(message, image, history)
        }, { headers: { "Authorization": `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" } });

        const results = {};
        if (model === "multi") {
            const r = await Promise.all([
                getOpenRouter("openai/gpt-4o-mini").catch(() => ({ data: { choices: [{ message: { content: "Erreur GPT" } }] } })),
                getOpenRouter("google/gemini-pro-1.5").catch(() => ({ data: { choices: [{ message: { content: "Erreur Gemini" } }] } }))
            ]);
            results.gpt = r[0].data.choices[0].message.content;
            results.gemini = r[1].data.choices[0].message.content;
        } else {
            const r = await getOpenRouter(
                model === "gpt" ? "openai/gpt-4o-mini" : 
                model === "claude" ? "anthropic/claude-3-haiku" : 
                model === "gemma" ? "google/gemma-2-9b-it:free" :
                finalGeminiModel
            );
            results[model] = r.data.choices[0].message.content;
        }

        if (user) user.credits -= cost;
        res.json({ ...results, remainingCredits: isMaster ? 999999 : (user ? user.credits : 0) });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- SHOP ROUTE ---
// --- TTS ROUTE (STARK VOICE ENGINE) ---
app.post(["/tts", "/api/tts"], authenticateToken, async (req, res) => {
    const { text, voice = "onyx" } = req.body;
    const user = memoryUsers.find(u => u.email === req.user.email);
    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    
    if (!OPENAI_KEY) {
      console.error("ERREUR CRITIQUE: OPENAI_API_KEY manquante sur Vercel.");
      return res.status(500).json({ error: "Configuration serveur incomplète (Clé manquante)." });
    }

    if (user && user.credits < PRICING.tts) {
      return res.status(403).json({ error: "Crédits insuffisants pour le moteur vocal." });
    }

    try {
        const response = await axios.post("https://api.openai.com/v1/audio/speech", {
            model: "tts-1",
            input: text,
            voice: voice
        }, {
            headers: { "Authorization": `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
            responseType: 'arraybuffer'
        });

        if (user) user.credits -= PRICING.tts;
        
        // Conversion en Buffer pour garantir la compatibilité Vercel/Node
        const audioBuffer = Buffer.from(response.data);
        res.set('Content-Type', 'audio/mpeg');
        res.set('Content-Length', audioBuffer.length);
        res.send(audioBuffer);

    } catch (err) { 
        const errorDetail = err.response?.data ? Buffer.from(err.response.data).toString() : err.message;
        console.error("TTS Protocol Error:", errorDetail);
        res.status(500).json({ error: "Échec du moteur vocal OpenAI.", detail: errorDetail }); 
    }
});

app.post(["/google-voices", "/api/google-voices"], authenticateToken, async (req, res) => {
    const clientGoogleKey = req.body?.googleApiKey;
    const activeGoogleKey = GOOGLE_API_KEY || clientGoogleKey;

    if (!activeGoogleKey) {
        return res.status(400).json({ error: "Google API key manquante pour recuperer les voix Cloud." });
    }

    try {
        const response = await axios.get(`https://texttospeech.googleapis.com/v1/voices?key=${activeGoogleKey}`);
        const voices = response.data?.voices || [];
        const formatted = voices.map((v) => ({
            name: v.name,
            languageCodes: v.languageCodes || [],
            ssmlGender: v.ssmlGender || "SSML_VOICE_GENDER_UNSPECIFIED",
            naturalSampleRateHertz: v.naturalSampleRateHertz || null
        }));
        res.json({ voices: formatted });
    } catch (err) {
        const detail = err.response?.data || err.message;
        console.error("Google voices fetch error:", detail);
        res.status(500).json({ error: "Impossible de recuperer les voix Google Cloud.", detail });
    }
});

app.post(["/tts-google", "/api/tts-google"], authenticateToken, async (req, res) => {
    const { text, voiceName, languageCode, speakingRate = 1.0, googleApiKey: clientGoogleKey } = req.body || {};
    const user = memoryUsers.find(u => u.email === req.user.email);
    const activeGoogleKey = GOOGLE_API_KEY || clientGoogleKey;

    if (!text || !voiceName) {
        return res.status(400).json({ error: "Texte ou voix Google manquante." });
    }
    if (!activeGoogleKey) {
        return res.status(400).json({ error: "Google API key manquante pour le TTS Google Cloud." });
    }
    if (user && user.credits < PRICING.tts) {
        return res.status(403).json({ error: "Credits insuffisants pour le moteur vocal." });
    }

    const inferredLanguage = languageCode || (voiceName.includes("-") ? voiceName.split("-").slice(0, 2).join("-") : "fr-FR");

    try {
        const response = await axios.post(
            `https://texttospeech.googleapis.com/v1/text:synthesize?key=${activeGoogleKey}`,
            {
                input: { text },
                voice: { languageCode: inferredLanguage, name: voiceName },
                audioConfig: {
                    audioEncoding: "MP3",
                    speakingRate: Math.max(0.5, Math.min(2.0, Number(speakingRate) || 1.0))
                }
            },
            { headers: { "Content-Type": "application/json" } }
        );

        const base64Audio = response.data?.audioContent;
        if (!base64Audio) {
            throw new Error("Aucun contenu audio retourne par Google Cloud.");
        }

        if (user) user.credits -= PRICING.tts;

        const audioBuffer = Buffer.from(base64Audio, "base64");
        res.set("Content-Type", "audio/mpeg");
        res.set("Content-Length", audioBuffer.length);
        res.send(audioBuffer);
    } catch (err) {
        const detail = err.response?.data || err.message;
        console.error("Google TTS error:", detail);
        res.status(500).json({ error: "Echec du moteur vocal Google Cloud.", detail });
    }
});

app.post(["/purchase", "/api/purchase"], authenticateToken, async (req, res) => {
    const { packId } = req.body;
    const packs = {
        "pack_100": { credits: 100, price: 5 },
        "pack_500": { credits: 500, price: 20 },
        "pack_2000": { credits: 2000, price: 50 }
    };
    const pack = packs[packId];
    if (!pack) return res.status(400).json({ error: "Pack invalide." });
    
    const user = memoryUsers.find(u => u.email === req.user.email);
    if (user) {
        user.credits += pack.credits;
        user.plan = "PREMIUM";
        return res.json({ success: true, newCredits: user.credits, plan: user.plan });
    }
    res.status(404).json({ error: "Utilisateur non trouvé." });
});

export default app;
