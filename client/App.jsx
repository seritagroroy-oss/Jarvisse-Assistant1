import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Send, Zap, Sparkles, LogOut, Coins, BrainCircuit, Bot, User, 
  Trash2, Image as ImageIcon, Mic, MicOff, Volume2, Paperclip, 
  Settings, History, ChevronLeft, Menu, X, Save, Cpu, Key, Play
} from "lucide-react";
import { marked } from "marked";
const backendUrl = "https://jarvisse-assistant1.vercel.app";

export default function App() {
  // Version 6.0.1 - Corrective Deployment
  const [input, setInput] = useState("");
  const [currentChatId, setCurrentChatId] = useState(localStorage.getItem("jarvis_active_id") || "default");
  const [messages, setMessages] = useState(() => {
    const activeId = localStorage.getItem("jarvis_active_id") || "default";
    const saved = localStorage.getItem(`jarvis_messages_${activeId}`);
    if (saved) return JSON.parse(saved);
    // Migration : récupérer les anciens messages du système précédent
    const legacy = localStorage.getItem("jarvis_current_messages");
    if (legacy) {
      localStorage.setItem(`jarvis_messages_${activeId}`, legacy);
      return JSON.parse(legacy);
    }
    return [];
  });
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gpt");
  const [continuousMode, setContinuousMode] = useState(localStorage.getItem("jarvis_continuous") !== "false"); // True par défaut désormais
  
  // History management
  const [chats, setChats] = useState(() => {
    const saved = localStorage.getItem("jarvis_chats_list");
    return saved ? JSON.parse(saved) : [];
  });
  
  // Settings States
  const [geminiVersion, setGeminiVersion] = useState(localStorage.getItem("gemini_version") || "google/gemini-pro-1.5");
  const [persona, setPersona] = useState(localStorage.getItem("jarvis_persona") || "");
  const [googleKey, setGoogleKey] = useState(localStorage.getItem("google_api_key") || "");
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [voiceSpeed, setVoiceSpeed] = useState(parseFloat(localStorage.getItem("jarvis_voice_speed")) || 1.1);
  const [selectedVoice, setSelectedVoice] = useState(localStorage.getItem("jarvis_selected_voice") || "onyx");
  const [voices, setVoices] = useState([]);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState({ 
    email: localStorage.getItem("email"), 
    credits: parseInt(localStorage.getItem("credits")) || 0 
  });
  const [userName, setUserName] = useState(localStorage.getItem("jarvis_user_name") || "Monsieur Roy");
  const [isListening, setIsListening] = useState(false);
  const [micSignal, setMicSignal] = useState(false);
  const [localAgentActive, setLocalAgentActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [time, setTime] = useState(new Date());
  const recognitionRef = useRef(null);
  const [proactiveMsg, setProactiveMsg] = useState(null);
  
  // Radar Audio (VU-Mètre)
  const [micLevel, setMicLevel] = useState(0); 
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const [lastProactiveCheck, setLastProactiveCheck] = useState(0);
  const [isVoiceOn, setIsVoiceOn] = useState(true);
  const [attachedImage, setAttachedImage] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showShop, setShowShop] = useState(false);
  const [userPlan, setUserPlan] = useState(localStorage.getItem("user_plan") || "FREE");
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  // Refs pour accès en temps réel dans les callbacks de reconnaissance
  const isSpeakingRef = useRef(false);
  const loadingRef = useRef(false);
  const lastSpeechEndTimeRef = useRef(0);

  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);
  useEffect(() => { loadingRef.current = loading; }, [loading]);

  // --- BOUCLE PROACTIVE (JARVIS ANALYSE SEUL) ---
  useEffect(() => {
    if (!token) return;

    const proactiveLoop = setInterval(() => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();

      // Évite de trop spammer (une fois toutes les 30 min minimum sauf changement majeur)
      if (Date.now() - lastProactiveCheck < 1800000) return;

      let suggestion = null;

      // Scénarios de base
      if (hours >= 22 || hours <= 5) {
        suggestion = {
          title: "PROTOCOLE_NOCTURNE",
          message: "Monsieur Roy, il se fait tard. Souhaitez-vous que j'active le mode veille ou que je prépare votre agenda pour demain ?",
          color: "text-blue-400",
          icon: <Zap size={14} className="animate-pulse" />
        };
      } else if (hours >= 8 && hours <= 10) {
        suggestion = {
          title: "SÉQUENCE_MATINALE",
          message: "Bonjour Monsieur Roy. J'ai remarqué que vous travaillez souvent sur votre session de création à cette heure. Voulez-vous que j'ouvre vos outils ?",
          color: "text-cyan-400",
          icon: <Bot size={14} className="animate-bounce" />
        };
      }

      if (suggestion) {
        setProactiveMsg(suggestion);
        setLastProactiveCheck(Date.now());
        if (isVoiceOn) speak(suggestion.message);
      }
    }, 60000); // Vérifie chaque minute

    return () => clearInterval(proactiveLoop);
  }, [token, lastProactiveCheck, isVoiceOn]);

  // Check local agent availability
  useEffect(() => {
    // --- ENREGISTREMENT PWA SERVICE WORKER ---
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(reg => {
          console.log('STARK_SW_ACTIVE', reg);
        }).catch(err => console.log('SW_FAILURE', err));
      });
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });
  }, []);


  const installApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setDeferredPrompt(null);
    } else {
      alert("Monsieur Roy, pour installer JARVISSE sur mobile : \n1. Appuyez sur 'Partager' (iOS) ou sur les 3 points (Android).\n2. Choisissez 'Sur l'écran d'accueil'.");
    }
  };

  // Check local agent availability
  useEffect(() => {
    const checkAgent = async () => {
      try {
        // On ne check l'agent local que si on est en environnement Electron
        if (!window.navigator.userAgent.includes("Electron")) return;
        const res = await fetch("http://localhost:3001");
        setLocalAgentActive(res.ok);
      } catch (e) {
        setLocalAgentActive(false);
      }
    };
    checkAgent();
  }, []);

  // Protocole Anti-Verrouillage (WakeLock)
  useEffect(() => {
    let wakeLock = null;
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator && continuousMode) {
        try {
          wakeLock = await navigator.wakeLock.request('screen');
          console.log('Anti-Veille Activé (WakeLock)');
        } catch (err) {}
      }
    };
    
    const handleVisibilityChange = () => {
      if (wakeLock !== null && document.visibilityState === 'visible') requestWakeLock();
    };

    if (continuousMode) {
      requestWakeLock();
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    
    return () => {
      if (wakeLock) Object.assign(wakeLock).release();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [continuousMode]);

  // Détection Wake Word "Jarvisse"
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window)) return;

    const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.lang = "fr-FR";
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = false; // Plus stable pour détecter la fin de phrase

    recognitionRef.current.onresult = (event) => {
      const text = event.results[event.results.length - 1][0].transcript.trim();
      console.log("Speech detected:", text);
      
      if (text) {
        // IMPORTANT : Filtrage ultra-robuste avec verrou temporel (élimine l'écho de fin de phrase)
        const now = Date.now();
        if (isSpeakingRef.current || loadingRef.current || (now - lastSpeechEndTimeRef.current < 1500)) {
          console.log("Ignored echo/busy speech.");
          return;
        }
        setIsListening(false); // On coupe pour traiter l'ordre proprement
        
        // Si l'utilisateur a dit "Jarvis" on le nettoie juste pour faire propre, mais on envoie tout !
        let finalCommand = text.toLowerCase();
        if (finalCommand.startsWith("jarvisse")) finalCommand = finalCommand.replace("jarvisse", "").trim();
        else if (finalCommand.startsWith("jarvis")) finalCommand = finalCommand.replace("jarvis", "").trim();
        
        if (finalCommand) {
          sendMessage(finalCommand);
        }
      }
    };

    recognitionRef.current.onend = () => {
      // Uniquement redémarrer si on n'est pas en train de parler (évite les bips pendant le discours)
      if (isListening && continuousMode && !isSpeakingRef.current) {
        setTimeout(() => {
          try { 
            if (isListening && recognitionRef.current && !isSpeakingRef.current) recognitionRef.current.start(); 
          } catch (e) { }
        }, 100);
      }
    };

    try {
      if (isListening) {
        recognitionRef.current.start();
      } else {
        recognitionRef.current.stop();
      }
    } catch(e) {}

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        try { recognitionRef.current.stop(); } catch(e) {}
      }
    }
  }, [isListening, continuousMode]);
  
  const [authMode, setAuthMode] = useState("login");
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  // Clock Update
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);


  // System Commands Handler
  const handleSystemCommands = (text) => {
    const cmd = text.toLowerCase();
    if (cmd.includes("ouvre youtube")) { window.open("https://youtube.com", "_blank"); return "Ouverture de YouTube, Monsieur."; }
    if (cmd.includes("ouvre google")) { window.open("https://google.com", "_blank"); return "Moteur de recherche prêt, Monsieur."; }
    if (cmd.includes("ouvre chatgpt")) { window.open("https://chat.openai.com", "_blank"); return "Accès aux serveurs OpenAI établi."; }
    if (cmd.includes("meteo") || cmd.includes("météo")) { window.open("https://www.google.com/search?q=meteo", "_blank"); return "Analyse météorologique en cours."; }
    if (cmd.includes("heure") || cmd.includes("quel heure")) { return `Il est exactement ${time.toLocaleTimeString()}.`; }
    return null;
  };

  const geminiOptions = [
    { id: "google-direct", name: "Google Studio Direct (Prioritaire)" },
    { id: "google/gemini-pro-1.5", name: "Gemini 1.5 Pro (Haut QI)" },
    { id: "google/gemini-flash-1.5", name: "Gemini 1.5 Flash (Rapide)" },
    { id: "google/gemini-2.0-flash-exp:free", name: "Gemini 2.0 Flash (Expérimental)" },
    { id: "google/gemma-2-9b-it:free", name: "Gemma 2 (Open Source)" },
    { id: "google/gemini-pro", name: "Gemini 1.0 Pro (Standard)" },
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => { 
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => { 
    scrollToBottom();
    // Sauvegarde automatique du chat actuel
    if (messages.length > 0) {
      localStorage.setItem(`jarvis_messages_${currentChatId}`, JSON.stringify(messages));
      
      const updatedChats = [...chats];
      const chatIndex = updatedChats.findIndex(c => c.id === currentChatId);
      
      // Trouver le premier message de l'utilisateur pour le titre
      const firstUserMsg = messages.find(m => m.role === 'user');
      const title = firstUserMsg ? (firstUserMsg.content.slice(0, 30) + "...") : "Discussion_Anonyme";
      
      if (chatIndex > -1) {
        updatedChats[chatIndex].title = title;
        updatedChats[chatIndex].date = new Date().toLocaleDateString();
      } else {
        updatedChats.push({ id: currentChatId, title, date: new Date().toLocaleDateString() });
      }
      setChats(updatedChats);
      localStorage.setItem("jarvis_chats_list", JSON.stringify(updatedChats));
      localStorage.setItem("jarvis_active_id", currentChatId);
    }
  }, [messages, currentChatId]);

  const loadChat = (chatId) => {
    // Sauvegarder le chat actuel avant de changer
    if (messages.length > 0) {
      localStorage.setItem(`jarvis_messages_${currentChatId}`, JSON.stringify(messages));
    }
    setCurrentChatId(chatId);
    const saved = localStorage.getItem(`jarvis_messages_${chatId}`);
    if (saved) {
      setMessages(JSON.parse(saved));
    } else {
      // Fallback : tenter de récupérer depuis l'ancien système
      const legacy = localStorage.getItem("jarvis_current_messages");
      if (legacy && chatId === "default") {
        setMessages(JSON.parse(legacy));
        localStorage.setItem(`jarvis_messages_${chatId}`, legacy);
      } else {
        setMessages([]);
      }
    }
    localStorage.setItem("jarvis_active_id", chatId);
    setSidebarOpen(false);
  };

  const startNewChat = () => {
    const newId = Date.now().toString();
    setCurrentChatId(newId);
    setMessages([]);
    localStorage.setItem("jarvis_active_id", newId);
    setSidebarOpen(false);
  };



  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, isMobile ? 100 : 140) + "px";
    }
  }, [input, isMobile]);

  const handleAuth = async (e, type) => {
    e.preventDefault();
    const email = e.target.email.value;
    const password = e.target.password.value;
    try {
      const resp = await fetch(`${backendUrl}/api/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      if (type === "login") {
        setToken(data.token);
        setUser({ email: data.email, credits: data.credits });
        setUserPlan(data.plan || "FREE");
        localStorage.setItem("token", data.token);
        localStorage.setItem("email", data.email);
        localStorage.setItem("credits", data.credits);
        localStorage.setItem("user_plan", data.plan || "FREE");
        setAuthMode("hidden");
      } else {
        alert("Succès ! Accès initialisé.");
        setAuthMode("login");
      }
    } catch (err) { alert(err.message); }
  };

  const logout = () => { 
    localStorage.clear(); 
    setToken(null); 
    setMessages([]);
    setUserPlan("FREE");
    setAuthMode("login"); 
  };

  const purchasePack = async (packId) => {
    try {
      const res = await fetch(`${backendUrl}/api/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ packId })
      });
      const data = await res.json();
      if (data.success) {
        setUser(prev => ({ ...prev, credits: data.newCredits }));
        setUserPlan(data.plan);
        localStorage.setItem("credits", data.newCredits);
        localStorage.setItem("user_plan", data.plan);
        alert(data.message || "Protocole de financement réussi. Crédits injectés !");
        setShowShop(false);
      }
    } catch (e) { alert("Erreur de transaction."); }
  };

  // --- INTERCEPTEUR AGENT LOCAL (STARK EARS) ---
  useEffect(() => {
    let pollInterval;
    if (isListening && localAgentActive) {
      pollInterval = setInterval(async () => {
        try {
          const res = await fetch("http://localhost:3001/transcript");
          const data = await res.json();
          if (data.text && !isSpeakingRef.current) {
             console.log("JARVISSE Python (Stark Ears) ->", data.text);
             setInput(data.text);
             setIsListening(false);
             setMicSignal(false);
             setMicLevel(0);
             if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
             if (audioContextRef.current) audioContextRef.current.close();
             analyserRef.current = null;
             
             setTimeout(() => sendMessage(data.text), 300);
          }
        } catch (e) { }
      }, 1000);
    } else if (!isListening && localAgentActive) {
       fetch("http://localhost:3001/command", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ action: "stop" })
       }).catch(()=>{});
    }

    return () => { if (pollInterval) clearInterval(pollInterval); };
  }, [isListening, localAgentActive]);

  const startListening = async () => {
    if (localAgentActive) {
      console.log("JARVISSE: Lancement Protocole Python (Stark Ears)...");
      setIsListening(true);
      setMicSignal(true);
      
      fetch("http://localhost:3001/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" })
      }).catch(e => console.error(e));
      
      // Lancement du Radar pour Python
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);
        analyserRef.current.fftSize = 64;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        
        const updateLevel = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for(let i=0; i<dataArray.length; i++) sum += dataArray[i];
          setMicLevel(sum / dataArray.length);
          requestAnimationFrame(updateLevel);
        };
        updateLevel();
      } catch (e) {}
      return;
    }

    const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
    if (!SpeechRecognition) return alert("Monsieur Roy, votre système ne supporte pas la reconnaissance vocale native Chrome.");
    
    const recognition = new SpeechRecognition();
    recognition.lang = "fr-FR";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      console.log("JARVISSE: Liaison sonore établie. J'écoute...");
      setIsListening(true);
    };

    recognition.onvoiceschanged = () => console.log("JARVISSE: Liste des voix mise à jour.");
    
    recognition.onaudiostart = async () => {
        console.log("JARVISSE: Signal audio capté.");
        setMicSignal(true);
        // DÉMARRAGE DU RADAR DE VOLUME (VU-MÈTRE)
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          streamRef.current = stream;
          audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
          analyserRef.current = audioContextRef.current.createAnalyser();
          const source = audioContextRef.current.createMediaStreamSource(stream);
          source.connect(analyserRef.current);
          analyserRef.current.fftSize = 64;
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          
          const updateLevel = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for(let i=0; i<dataArray.length; i++) sum += dataArray[i];
            setMicLevel(sum / dataArray.length);
            requestAnimationFrame(updateLevel);
          };
          updateLevel();
        } catch (e) { console.error("Échec Radar Volume", e); }
    };
    recognition.onsoundstart = () => console.log("JARVISSE: Son détecté.");
    recognition.onspeechstart = () => console.log("JARVISSE: Voix détectée.");
    
    recognition.onerror = (event) => {
      console.error("JARVISSE: Erreur système ->", event.error);
      setIsListening(false);
      setMicSignal(false);
      alert(`PROTOCOLE ÉCHOUÉ : ${event.error}. Vérifiez vos réglages sonores.`);
    };

    recognition.onend = () => {
      console.log("JARVISSE: Fin de session.");
      setIsListening(false);
      setMicSignal(false);
      setMicLevel(0);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (audioContextRef.current) audioContextRef.current.close();
      analyserRef.current = null;
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      console.log("JARVISSE: J'ai compris ->", transcript);
      setInput(transcript);
      
      // AUTO-SEND : On envoie la commande dès que la voix est captée
      if (transcript.trim().length > 0) {
        setTimeout(() => sendMessage(transcript), 300);
      }
    };

    try {
      recognition.start();
    } catch (e) {
      console.error("JARVISSE: Échec lancement reconnaissance", e);
    }
  };

  const speak = async (text) => {
    if ((!isVoiceOn && !continuousMode) || !text) return;
    
    // VERROU INSTANTANÉ : Jarvis parle, le micro doit ignorer tout le reste
    isSpeakingRef.current = true;
    setIsSpeaking(true);
    const cleanText = text
      .replace(/[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F900}-\u{1F9FF}]/gu, "")
      .replace(/[\*\#\_\~\`\>\[\]\(\)]/g, "")
      .replace(/[→⇒⇨➔➲➤➧➨➚➘➴➷➸➼➽⚡🔥✨🚀🧠💡🎯✅🛡️]/gu, "") 
      .replace(/[•●▪▪■‣◦]/g, "")
      .trim();
    
    if (!cleanText) return;

    try {
      if (selectedVoice === "system") {
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = voiceSpeed;
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => { setIsSpeaking(false); isSpeakingRef.current = false; };
        window.speechSynthesis.speak(utterance);
        return;
      }

      // Voix gratuite Google Translate
      if (selectedVoice === "google") {
        isSpeakingRef.current = true;
        setIsSpeaking(true);
        // Découpage intelligent pour respecter la limite de 200 char Google
        const chunks = cleanText.match(/.{1,190}(?:\s|$|[,.?!])/g) || [cleanText];
        let index = 0;
        
        const playNextChunk = () => {
          if (index >= chunks.length) {
            setIsSpeaking(false);
            isSpeakingRef.current = false;
            lastSpeechEndTimeRef.current = Date.now();
            if (continuousMode) setTimeout(() => setIsListening(true), 300);
            return;
          }
          const textChunk = encodeURIComponent(chunks[index].trim());
          if (!textChunk) {
            index++;
            playNextChunk();
            return;
          }
          const audio = new Audio(`https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=fr&q=${textChunk}`);
          audio.playbackRate = voiceSpeed;
          audio.onended = () => {
            index++;
            playNextChunk();
          };
          audio.onerror = () => {
            index++;
            playNextChunk(); 
          };
          audio.play();
        };
        playNextChunk();
        return;
      }

      // Tentative de lecture Premium (OpenAI TTS)
      const res = await fetch(`${backendUrl}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ text: cleanText, voice: selectedVoice })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Moteur Premium (OpenAI) indisponible");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.playbackRate = voiceSpeed;
      
      audio.onplay = () => setIsSpeaking(true);
      audio.onended = () => {
        setIsSpeaking(false);
        isSpeakingRef.current = false; // FIN VERROU
        lastSpeechEndTimeRef.current = Date.now(); // Déclenchement du Cooldown anti-écho
        URL.revokeObjectURL(url);
        if (continuousMode) {
          setTimeout(() => setIsListening(true), 300); // Réactivation propre
        }
      };
      
      audio.play();
      
      // On déduit un crédit pour la voix haute fidélité
      setUser(prev => ({ ...prev, credits: Math.max(0, prev.credits - 1) }));

    } catch (e) {
      // Fallback : Moteur Local (Browser)
      console.error("Erreur Premium TTS:", e);
      alert(`⚠️ ÉCHEC MOTEUR VOCAL PREMIUM ⚠️\n\n${e.message}\n\nLe système repasse temporairement sur la voix de secours (robot) de Windows.`);
      
      const synth = window.speechSynthesis;
      synth.cancel(); 
      const utterance = new SpeechSynthesisUtterance(cleanText);
      
      utterance.lang = "fr-FR";
      utterance.rate = 1.0;
      utterance.pitch = 1.05;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        isSpeakingRef.current = false; // FIN VERROU
        lastSpeechEndTimeRef.current = Date.now(); // Déclenchement du Cooldown anti-écho
        if (continuousMode) {
          setTimeout(() => setIsListening(true), 300);
        }
      };
      synth.speak(utterance);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setAttachedImage(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const sendMessage = async (overrideInput = null) => {
    const textToSend = overrideInput || input;
    if (!textToSend.trim() && !attachedImage || !token) return;
    
    let currentInput = textToSend;
    let currentImage = attachedImage;
    const currentModel = selectedModel;
    
    // Protocol Vision : Si l'utilisateur demande de regarder l'écran
    if (currentInput.toLowerCase().includes("regarde mon écran") || currentInput.toLowerCase().includes("analyse mon écran")) {
      if (isMobile) {
        alert("Monsieur Roy, sur mobile je ne peux pas voir votre écran directement. Veuillez utiliser l'icône trombone pour m'envoyer une photo de votre galerie.");
        return;
      }
      
      if (localAgentActive) {
        setLoading(true);
        try {
          console.log("JARVISSE: Tentative de capture d'écran locale...");
          const capRes = await fetch("http://localhost:3001/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "capture_screen" })
          });
          const capData = await capRes.json();
          if (capData.image) {
            currentImage = capData.image;
            if (currentInput.length < 20) currentInput = "Analyse mon écran actuel et dis-moi ce que tu vois ou aide-moi sur ce qui est ouvert.";
          }
        } catch (e) {
          console.error("JARVISSE: Échec capture locale -", e);
        }
      } else {
        alert("Monsieur Roy, l'agent local n'est pas actif. Je ne peux pas capturer votre écran sans le protocole de liaison bureau.");
        return;
      }
    }

    const userMsg = { role: "user", content: currentInput, image: currentImage, id: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    
    setInput("");
    setAttachedImage(null);
    setLoading(true);
    loadingRef.current = true; // Verrou instantané

    // Check for system commands first
    const sysCmdReply = handleSystemCommands(currentInput);
    if (sysCmdReply) {
      setTimeout(() => {
        setMessages(prev => [...prev, { role: "ai", model: "system", responses: { system: sysCmdReply }, id: Date.now() }]);
        setLoading(false);
      }, 500);
      return;
    }

    const systemPrompt = `
      Tu es JARVISSE (Just A Really Very Intelligent System Expansion), l'assistant personnel de Monsieur Roy.
      Ton ton est sophistiqué, calme, loyal et légèrement sarcastique (style Stark). Tu dois utiliser beaucoup d'emojis pour illustrer tes réponses à l'écrit.

      COMPÉTENCES SPÉCIALES :
      Tu peux contrôler l'ordinateur de Monsieur Roy via des commandes JSON insérées dans ton texte.
      
      Si l'utilisateur demande une action système (ouvrir un site, une app, un dossier, éteindre), insère le JSON correspondant AU DÉBUT de ta réponse.
      
      Actions supportées :
      - {"action": "open_url", "value": "https://url.com"} (ex: youtube, twitter)
      - {"action": "open_app", "value": "chrome"} (ex: notepad, calc, chrome, photoshop)
      - {"action": "search", "value": "sujet"} (pour chercher sur google)
      - {"action": "system", "value": "shutdown"} (éteindre le pc)
      - {"action": "open_folder", "value": "C:\\\\Users"} (ouvrir un dossier)
      - {"action": "capture_screen", "value": ""} (si tu as besoin d'une nouvelle vue de l'écran pour confirmer quelque chose)

      VISION : Si une image est jointe, décris-la avec précision et réponds à la question de Monsieur Roy.

      Exemple : "Jarvisse, ouvre Youtube" -> {"action": "open_url", "value": "https://youtube.com"} Bien sûr, Monsieur. Le flux vidéo est activé.
    `;

    try {
      const chatHistory = messages.slice(-6).map(m => {
        let text = m.content || "";
        if (m.role === "ai" && m.responses) text = Object.values(m.responses).find(v => v) || "";
        return { role: m.role === "user" ? "user" : "assistant", content: String(text).slice(0, 800) };
      }).filter(h => h.content);

      const payload = { 
        message: currentInput, model: currentModel, image: currentImage, 
        history: chatHistory, persona, geminiModelId: geminiVersion,
        googleApiKey: googleKey, systemPrompt: systemPrompt
      };

      console.log("JARVISSE: Appel satellite Vercel ->", `${backendUrl}/api/chat`);
      const res = await fetch(`${backendUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(errorData.error || `Erreur Serveur (${res.status})`);
      }

      const data = await res.json();

      // Interception commande Agent Local
      const replyText = currentModel === "multi" ? data.gpt : data[currentModel];
      const jsonMatch = replyText.match(/\{"action".*?\}/);
      if (jsonMatch) {
        try {
          const command = JSON.parse(jsonMatch[0]);
          fetch("http://localhost:3001/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(command)
          }).catch(e => console.log("Agent local non joignable"));
        } catch (e) {}
      }

      const aiResponse = { 
        role: "ai", 
        model: currentModel, 
        responses: {}, 
        id: Date.now(),
        reply: replyText.replace(/\{"action".*?\}/, "").trim() // Pour la voix par exemple
      };
      
      if (data.image) aiResponse.image = data.image;
      else if (currentModel === "multi") aiResponse.responses = { gpt: data.gpt, gemini: data.gemini, claude: data.claude, llama: data.llama };
      else aiResponse.responses[currentModel] = data[currentModel];
      
      setMessages(prev => [...prev, aiResponse]);
      
      if (data.remainingCredits !== undefined) {
        setUser(prev => ({ ...prev, credits: data.remainingCredits }));
        localStorage.setItem("credits", data.remainingCredits);
      }

      speak(aiResponse.reply || Object.values(aiResponse.responses)[0]);

    } catch (err) { 
      console.error("ÉCHEC_TRANSMISSION:", err);
      setMessages(prev => [...prev, { role: "error", content: `ERREUR_TRANSMISSION: ${err.message}. Vérifiez votre connexion satellite.`, id: Date.now() }]); 
    }
    setLoading(false);
    loadingRef.current = false; // FIN VERROU
  };

  const models = [
    { id: "multi", name: "Multi", icon: <BrainCircuit size={10} />, hideOnMobile: true },
    { id: "gpt", name: "GPT-4o", icon: <Bot size={10} /> },
    { id: "gemini", name: "Gemini", icon: <Bot size={10} /> },
    { id: "claude", name: "Claude", icon: <Bot size={10} /> },
    { id: "gemma", name: "Gemma", icon: <Bot size={10} /> },
    { id: "image", name: "Vision", icon: <ImageIcon size={10} /> },
  ].filter(m => !isMobile || !m.hideOnMobile);

  return (
    <div className="flex bg-[#05060f] text-gray-100 font-sans h-full min-h-[100vh] overflow-hidden">
      
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && isMobile && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-[55] backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar - History */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside 
            initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} 
            className="fixed inset-y-0 left-0 w-[320px] max-w-[90vw] glass z-[60] flex flex-col p-6 shadow-cyan border-r border-cyan-500/20"
          >
            <div className="flex items-center justify-between mb-10">
              <h2 className="text-[12px] font-black uppercase tracking-[0.3em] text-cyan-400 flex items-center gap-3 italic">
                <History size={16} /> CHRONOLOGIE_SYSTÈME
              </h2>
              <button onClick={() => setSidebarOpen(false)} className="text-cyan-900 hover:text-cyan-400 transition-colors p-2"><X size={20} /></button>
            </div>
            <button onClick={startNewChat} className="w-full py-5 bg-cyan-500/5 border border-cyan-500/20 rounded-2xl mb-8 text-[11px] font-black uppercase tracking-[0.2em] text-cyan-400 hover:bg-cyan-500/10 transition-all flex items-center justify-center gap-3 shadow-cyan">
              <Zap size={16} /> INITIALISER_SÉQUENCE
            </button>
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-4">
              {chats.length === 0 ? (
                <div className="opacity-20 text-[10px] text-center pt-24 uppercase tracking-[0.4em] text-cyan-200">Aucune archive détectée</div>
              ) : (
                chats.slice().reverse().map(chat => (
                  <button key={chat.id} onClick={() => loadChat(chat.id)} className={`w-full p-5 rounded-[28px] text-left border transition-all ${chat.id === currentChatId ? 'bg-cyan-500/10 border-cyan-500/40 shadow-cyan' : 'bg-white/3 border-white/5 hover:bg-white/8 hover:border-cyan-500/20'}`}>
                    <div className="text-[11px] font-bold text-cyan-50 truncate mb-1">{chat.title}</div>
                    <div className="flex items-center justify-between mt-2">
                       <div className="text-[8px] text-cyan-700 uppercase tracking-widest font-black">{chat.date}</div>
                       <div className="w-1 h-1 rounded-full bg-cyan-500"></div>
                    </div>
                  </button>
                ))
              )}
            </div>
            <div className="pt-8 border-t border-cyan-500/10">
              <button onClick={() => { setShowSettings(true); setSidebarOpen(false); }} className="w-full text-left text-[11px] font-black uppercase tracking-[0.3em] text-cyan-500 hover:text-cyan-300 flex items-center gap-4 py-3">
                <Settings size={18}/> RÉGLAGES_PROTOCOLE
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full relative min-w-0">
        <div className="fixed top-[-5%] left-[-5%] w-[30%] h-[30%] bg-blue-600/5 rounded-full blur-[100px] pointer-events-none"></div>
        
        {/* Header HUD - System Status */}
        <header className="h-16 md:h-20 flex items-center justify-between px-4 md:px-6 border-b border-cyan-500/10 bg-gray-950/60 backdrop-blur-3xl shrink-0 z-50">
          <div className="flex items-center gap-3 md:gap-6">
            <button onClick={() => setSidebarOpen(true)} className="p-2.5 md:p-3 hover:bg-cyan-500/10 rounded-xl text-cyan-400 transition-all border border-cyan-500/20 shadow-cyan">
              <Menu size={isMobile ? 18 : 20} />
            </button>
            <div className="flex flex-col">
              <h1 className="text-[11px] md:text-[14px] font-black tracking-[0.3em] md:tracking-[0.4em] uppercase text-cyan-400 italic flex items-center gap-2">
                <BrainCircuit size={isMobile ? 14 : 18} className="animate-pulse" /> JARVISSE_AI
              </h1>
              {!isMobile && (
                <div className="flex items-center gap-4 mt-1 opacity-40">
                  <span className="text-[9px] font-bold tracking-widest text-cyan-200">CORE STATUS: STABLE</span>
                </div>
              )}
            </div>
          </div>
          
          {!isMobile && (
            <div className="hidden md:flex flex-col items-end mr-8">
              <div className="text-[16px] font-black tracking-widest text-white/90 font-mono italic">
                {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <div className="text-[9px] font-bold tracking-[0.3em] text-cyan-500 uppercase">{time.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
            </div>
          )}

          {/* HUD TACTICAL NOTIFICATIONS (PROACTIVE) */}
          <AnimatePresence>
            {proactiveMsg && (
              <motion.div 
                initial={{ opacity: 0, x: 100, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 100, scale: 0.9 }}
                className="fixed top-24 right-4 md:right-8 z-[100] w-[280px] md:w-[350px]"
              >
                <div className="glass border border-cyan-500/30 p-5 md:p-6 rounded-[32px] shadow-cyan relative overflow-hidden backdrop-blur-3xl bg-gray-950/80">
                  <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500/50"></div>
                  <button 
                    onClick={() => setProactiveMsg(null)}
                    className="absolute top-4 right-4 text-cyan-900 hover:text-cyan-400 p-1"
                  >
                    <X size={16} />
                  </button>
                  <div className={`flex items-center gap-3 mb-3 ${proactiveMsg.color} text-[10px] md:text-[11px] font-black tracking-[0.3em] uppercase italic`}>
                    {proactiveMsg.icon} {proactiveMsg.title}
                  </div>
                  <p className="text-cyan-50 text-[13px] md:text-[14px] leading-relaxed mb-4">
                    {proactiveMsg.message}
                  </p>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        if (proactiveMsg.title === "PROTOCOLE_NOCTURNE") sendMessage("Active le mode nuit");
                        if (proactiveMsg.title === "SÉQUENCE_MATINALE") sendMessage("Ouvre mes outils de travail");
                        setProactiveMsg(null);
                      }}
                      className="flex-1 py-3 bg-cyan-500/20 border border-cyan-500/30 rounded-2xl text-[9px] md:text-[10px] font-black text-cyan-400 uppercase tracking-widest hover:bg-cyan-500/40 transition-all text-center"
                    >
                      CONFIRMER
                    </button>
                    <button 
                      onClick={() => setProactiveMsg(null)}
                      className="px-4 py-3 bg-white/3 border border-white/5 rounded-2xl text-[9px] md:text-[10px] font-black text-white/40 uppercase tracking-widest hover:bg-white/10 transition-all text-center"
                    >
                      IGNORER
                    </button>
                  </div>
                  <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-cyan-500/5 blur-[40px] rounded-full"></div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-2 md:gap-4">
            {token ? (
              <div className="flex items-center gap-2 md:gap-3">
                <button 
                  onClick={() => setIsVoiceOn(!isVoiceOn)} 
                  className={`p-2.5 md:p-3 transition-all rounded-xl border ${isVoiceOn ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400' : 'bg-white/5 border-white/10 text-white/20'}`}
                  title={isVoiceOn ? "Désactiver la voix" : "Activer la voix"}
                >
                  {isVoiceOn ? <Volume2 size={isMobile ? 16 : 18}/> : <Bot size={isMobile ? 16 : 18} className="opacity-20" />}
                </button>
                <button 
                  onClick={installApp} 
                  className="flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-blue-500/10 border border-blue-500/30 rounded-xl text-[9px] md:text-[11px] font-black tracking-widest text-blue-400 hover:bg-blue-500/20 transition-all shadow-blue animate-pulse"
                  title="Installer JARVISSE"
                >
                  <Save size={isMobile ? 12 : 14}/> INSTALLER
                </button>
                <div className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-cyan-500/5 border border-cyan-500/20 rounded-xl text-[9px] md:text-[11px] font-black tracking-widest text-cyan-400 shadow-cyan uppercase cursor-pointer hover:bg-cyan-500/10 transition-all" onClick={() => setShowShop(true)}>
                  <Sparkles size={isMobile ? 12 : 14} className="text-yellow-400" /> {user.credits} <span className="hidden xs:inline">UNITÉS</span>
                </div>
                <button onClick={() => logout()} className="p-2.5 md:p-3 text-red-500/50 hover:text-red-500 transition-all hover:bg-red-500/10 rounded-xl">
                  <LogOut size={isMobile ? 16 : 18}/>
                </button>
              </div>
            ) : null}
          </div>
        </header>

        {/* AI CORE CIRCLE - Central Vision */}
        <AnimatePresence>
          {messages.length === 0 && !loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.2 }}
                className="relative flex items-center justify-center w-64 h-64 md:w-80 md:h-80"
              >
                {/* Holographic Grids */}
                <div className="absolute inset-0 border border-cyan-500/5 rounded-full animate-orbit opacity-20"></div>
                <div className="absolute inset-[-40px] border border-cyan-500/5 rounded-full animate-reverse-orbit opacity-10"></div>
                
                {/* HUD Data Streams */}
                <div className="absolute -left-20 top-0 h-40 w-[1px] bg-gradient-to-b from-transparent via-cyan-500 to-transparent animate-pulse opacity-30"></div>
                <div className="absolute -right-20 bottom-0 h-40 w-[1px] bg-gradient-to-b from-transparent via-cyan-500 to-transparent animate-pulse opacity-30"></div>
                
                {/* Central AI Core with React Animation */}
                <div className={`relative transition-all duration-700 ${isSpeaking ? 'scale-110' : 'scale-100'}`}>
                  <div className={`absolute inset-0 bg-cyan-400/20 blur-[60px] rounded-full animate-pulse-glow ${isSpeaking ? 'opacity-100' : 'opacity-40'}`}></div>
                  <svg className="w-64 h-64 md:w-80 md:h-80 relative z-10" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="0.2" className="text-cyan-500/20" />
                    <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="1" className="text-cyan-500/40 animate-orbit" strokeDasharray="15 10" />
                    <circle cx="50" cy="50" r="32" fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan-400 animate-reverse-orbit opacity-60" strokeDasharray="2 15" />
                    <circle cx="50" cy="50" r="5" fill="currentColor" className={`${isSpeaking ? 'text-cyan-300 animate-ping' : 'text-cyan-500'}`} />
                    
                    {/* Scanning Line */}
                    <motion.line 
                      x1="10" y1="50" x2="90" y2="50" 
                      stroke="currentColor" strokeWidth="0.5" 
                      className="text-cyan-400/30"
                      animate={{ y: [0, 40, -40, 0] }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    />
                  </svg>
                </div>

                {/* Status Indicator */}
                <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${localAgentActive ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-red-500 opacity-30'}`}></div>
                  <div className="text-[9px] font-black tracking-[0.5em] text-cyan-500/40 uppercase whitespace-nowrap">
                    {localAgentActive ? 'LOCAL_AGENT_CONNECTED' : 'STANDBY_MODE'}
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Chat Area */}
        <main className="flex-1 overflow-y-auto px-3 md:px-6 py-6 md:py-10 scroll-smooth no-scrollbar relative select-text">
          <div className="max-w-4xl mx-auto space-y-8 md:space-y-12">

            {/* Welcome state */}
            {messages.length === 0 && token && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="text-center pt-8 md:pt-16 space-y-4"
              >
                <h2 className="text-2xl md:text-4xl font-black tracking-[0.4em] uppercase italic text-cyan-400 neon-text">Bonjour, {userName}</h2>
                <div className="flex items-center justify-center gap-2 opacity-50">
                  <span className="w-12 h-[1px] bg-cyan-400"></span>
                  <p className="text-cyan-200 text-[10px] md:text-[11px] tracking-[0.6em] uppercase">SYSTÈME TACTIQUE OPÉRATIONNEL</p>
                  <span className="w-12 h-[1px] bg-cyan-400"></span>
                </div>
                <p className="text-gray-500 text-[10px] md:text-xs tracking-[0.2em] uppercase max-w-md mx-auto pt-4 border-t border-cyan-500/5 mt-8">En attente de vos directives prioritaires pour synchroniser l'ensemble de vos unités numérisées.</p>
                <div className="flex justify-center gap-3 flex-wrap mt-6">
                  {["💡 Idée de contenu", "🚀 Plan stratégique", "🧠 Analyse marché", "⚡ Brainstorm"].map(s => (
                    <button key={s} onClick={() => setInput(s.split(" ").slice(1).join(" "))} className="px-4 py-2 glass rounded-full text-[11px] font-bold text-gray-400 hover:text-blue-400 border-white/5 hover:border-blue-500/30 transition-all">{s}</button>
                  ))}
                </div>
              </motion.div>
            )}

            {messages.map((m) => (
              <div key={m.id} className="space-y-3">
                {m.role === "user" ? (
                  <div className="flex justify-end pr-1">
                    <div className="space-y-2 flex flex-col items-end max-w-[88%] md:max-w-[75%]">
                      {m.image && <img src={m.image} className="rounded-2xl w-48 md:w-64 border-2 border-cyan-500/20 shadow-cyan" />}
                      {m.content && (
                        <div className="bg-cyan-600/10 backdrop-blur-md px-5 md:px-7 py-4 md:py-5 rounded-[32px] rounded-tr-none border border-cyan-500/30 text-cyan-50 shadow-cyan text-[14px] md:text-[15px] leading-relaxed font-medium">
                          <span className="text-[9px] font-black tracking-widest text-cyan-400 block mb-2 opacity-50 uppercase">User_Transmission</span>
                          {m.content}
                        </div>
                      )}
                    </div>
                  </div>
                ) : m.role === "ai" ? (
                  <div className="space-y-4 md:space-y-6">
                    <div className="flex items-center justify-between pl-1">
                      <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500/60 italic">
                        <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></div>
                        {m.model === 'system' ? 'SYSTÈME_JARVISSE' : `ANALYSE_${m.model.toUpperCase()}`}
                      </div>
                      <button 
                        onClick={() => speak(Object.values(m.responses).find(v => v) || "")} 
                        className="flex items-center gap-2 px-4 py-2 bg-cyan-500/5 hover:bg-cyan-500/10 border border-cyan-500/20 rounded-full transition-all group active:scale-95 shadow-cyan"
                      >
                        <Volume2 size={13} className="text-cyan-400 group-hover:scale-110 transition-transform" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-cyan-400">FLUX_AUDIO</span>
                      </button>
                    </div>
                    {m.image ? (
                      <div className="glass p-3 rounded-[32px] w-full max-w-md ml-1 border-cyan-500/30 shadow-cyan">
                        <img src={m.image} className="rounded-[24px] w-full h-auto border border-cyan-500/20" />
                      </div>
                    ) : (
                      <div className={`grid grid-cols-1 ${m.model === 'multi' ? 'md:grid-cols-2' : 'max-w-3xl'} gap-4 ml-1`}>
                        {Object.entries(m.responses).map(([key, val]) => (
                          <div key={key} className="glass p-5 md:p-8 rounded-[28px] md:rounded-[40px] border-cyan-500/20 hover:border-cyan-500/50 transition-all shadow-cyan bg-[#0a1525]/40 overflow-hidden">
                            <div className="flex items-center justify-between mb-4 border-b border-cyan-500/10 pb-3">
                              <span className="text-[10px] md:text-[11px] font-black tracking-[0.3em] uppercase text-cyan-400">{key}</span>
                              <div className="flex gap-1">
                                <div className="w-1 h-3 bg-cyan-500/30"></div>
                                <div className="w-1 h-3 bg-cyan-500/60"></div>
                                <div className="w-1 h-3 bg-cyan-500"></div>
                              </div>
                            </div>
                            <div className="prose-jarvis prose prose-invert prose-sm max-w-none prose-p:my-2 break-words" dangerouslySetInnerHTML={{ __html: marked.parse(val || "⏳ Séquençage des données...") }} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 md:p-4 bg-red-600/10 border border-red-500/30 rounded-[20px] text-red-500 text-[11px] font-black uppercase tracking-[0.2em] text-center shadow-2xl">
                    ⚠️ {m.content}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <div className="flex items-center gap-3 pl-1 text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500 italic">
                  <div className="w-2 h-2 rounded-full bg-cyan-500 animate-ping"></div>
                  SYSTÈME EN COURS D'ANALYSE...
                </div>
                <div className="glass p-6 rounded-[32px] ml-1 max-w-sm border-cyan-500/20 bg-[#0a1525]/60 shadow-cyan">
                  <div className="flex items-center gap-4">
                    <div className="wave-container">
                      <div className="wave-bar" style={{animationDelay:'0s'}}></div>
                      <div className="wave-bar" style={{animationDelay:'0.1s'}}></div>
                      <div className="wave-bar" style={{animationDelay:'0.2s'}}></div>
                      <div className="wave-bar" style={{animationDelay:'0.3s'}}></div>
                      <div className="wave-bar" style={{animationDelay:'0.4s'}}></div>
                    </div>
                    <span className="text-[11px] text-cyan-400/70 font-black tracking-[0.2em] uppercase">Séquençage neural en cours</span>
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} className="h-4" />
          </div>
        </main>

        {/* Footer */}
        <footer className="shrink-0 px-3 md:px-6 pt-2 pb-5 md:pb-8 z-50 bg-[#05060f] border-none">
          <div className="max-w-4xl mx-auto space-y-2 md:space-y-4">
            
            {/* Image preview */}
            {attachedImage && (
              <div className="flex items-center gap-2 px-2">
                <img src={attachedImage} className="w-12 h-12 rounded-2xl object-cover border border-white/10" />
                <button onClick={() => setAttachedImage(null)} className="text-gray-500 hover:text-red-400 transition-all"><X size={16} /></button>
              </div>
            )}

            {/* Input box */}
            <div className={`rounded-[32px] md:rounded-[48px] border transition-all shadow-cyan overflow-hidden backdrop-blur-3xl ${isListening ? 'border-red-500/50 bg-red-500/5' : 'border-cyan-500/30 bg-[#0a1525]/80'}`}>
              <div className="flex items-end gap-1 md:gap-3 px-3 py-3 md:py-4">
                <button onClick={() => fileInputRef.current.click()} className="p-4 text-cyan-500 hover:text-cyan-300 transition-all shrink-0 hover:bg-cyan-500/10 rounded-full">
                  <Paperclip size={20} />
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                <textarea 
                  ref={textareaRef}
                  value={input} 
                  onChange={(e) => setInput(e.target.value)} 
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())} 
                  className="flex-1 bg-transparent border-none focus:ring-0 resize-none py-3 px-2 text-cyan-50 placeholder-cyan-900/50 text-[15px] md:text-[16px] leading-relaxed min-w-0" 
                  placeholder={token ? "Entrez votre directive, Monsieur Roy..." : "🔒 ACCÈS REFUSÉ - INITIALISATION REQUISE"} 
                  rows={1}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  style={{maxHeight: isMobile ? '100px' : '140px'}}
                />
                <button 
                  onClick={() => setIsListening(!isListening)} 
                  className={`relative p-4 transition-all shrink-0 rounded-full flex items-center justify-center ${isListening ? "bg-red-500/10" : "text-cyan-500 hover:text-cyan-300 hover:bg-cyan-500/10"}`}
                  title={isListening ? "Désactiver l'écoute active" : "Activer l'écoute active (Jarvisse...)"}
                >
                  {micSignal && (
                    <motion.div 
                      animate={{ scale: [1, 1.8, 1], opacity: [0.3, 0, 0.3] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                      className="absolute inset-0 rounded-full bg-red-500/50"
                    />
                  )}
                  {isListening ? <MicOff size={20} className="text-red-500 relative z-10" /> : <Mic size={20} className="relative z-10" />}
                </button>
                <button 
                  onClick={() => sendMessage()} 
                  disabled={loading || (!input.trim() && !attachedImage) || !token} 
                  className="p-4 md:p-5 bg-cyan-500 hover:bg-cyan-400 disabled:bg-cyan-900 disabled:opacity-20 text-gray-950 rounded-full mb-0.5 transition-all active:scale-95 shadow-lg shadow-cyan-500/20 shrink-0"
                >
                  {loading ? <div className="w-6 h-6 border-3 border-gray-950/20 border-t-gray-950 rounded-full animate-spin"></div> : <Send size={22} />}
                </button>
              </div>
            </div>

            {/* Model selector */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2 px-1">
              {models.map((m) => (
                <button 
                  key={m.id} 
                  onClick={() => setSelectedModel(m.id)} 
                  className={`whitespace-nowrap flex items-center gap-3 px-6 py-3 rounded-full border text-[10px] font-black tracking-[0.2em] uppercase transition-all shrink-0 ${selectedModel === m.id ? "bg-cyan-500/20 border-cyan-500 text-cyan-400 shadow-cyan" : "bg-white/3 border-white/5 text-cyan-900 hover:bg-white/10"}`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${selectedModel === m.id ? 'bg-cyan-400 animate-pulse' : 'bg-cyan-900'}`}></div>
                  {m.name}
                </button>
              ))}
            </div>
          </div>
        </footer>

        {/* Settings Modal */}
        <AnimatePresence>
          {showSettings && (
            <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-3xl flex items-end md:items-center justify-center p-0 md:p-6">
              <motion.div 
                initial={{ scale: isMobile ? 1 : 0.95, opacity: 0, y: isMobile ? 100 : 0 }} 
                animate={{ scale: 1, opacity: 1, y: 0 }} 
                exit={{ scale: isMobile ? 1 : 0.95, opacity: 0, y: isMobile ? 100 : 0 }}
                className="glass p-8 md:p-12 rounded-t-[48px] md:rounded-[60px] w-full md:max-w-2xl space-y-10 border-cyan-500/20 overflow-y-auto no-scrollbar shadow-cyan"
                style={{maxHeight: isMobile ? '92dvh' : '90dvh'}}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl md:text-3xl font-black tracking-[0.3em] uppercase italic text-cyan-500">
                      PARAMÈTRES_CORE
                    </h3>
                    <p className="text-[10px] text-cyan-700 font-bold tracking-widest mt-1 uppercase">Configuration tactique du terminal</p>
                  </div>
                  <button onClick={() => setShowSettings(false)} className="text-cyan-900 hover:text-cyan-400 transition-all p-3 border border-cyan-500/10 rounded-full"><X size={24} /></button>
                </div>

                <div className="space-y-6 md:space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                    <div className="space-y-3 md:space-y-4">
                      <p className="text-[11px] font-black text-cyan-500 uppercase tracking-[0.3em] italic pl-2 flex items-center gap-2"><User size={14}/> Identité Utilisateur</p>
                      <input type="text" value={userName} onChange={(e) => setUserName(e.target.value)} className="w-full bg-[#0a1525]/80 border border-cyan-500/20 rounded-[20px] px-5 py-4 md:px-6 md:py-5 outline-none focus:border-cyan-500 text-[12px] font-black text-cyan-100 uppercase tracking-widest" placeholder="Votre Nom..."/>
                    </div>
                    <div className="space-y-3 md:space-y-4">
                      <p className="text-[11px] font-black text-cyan-500 uppercase tracking-[0.3em] italic pl-2 flex items-center gap-2"><Key size={14}/> Google AI Key</p>
                      <input type="password" value={googleKey} onChange={(e) => setGoogleKey(e.target.value)} className="w-full bg-[#0a1525]/80 border border-cyan-500/20 rounded-[20px] px-5 py-4 md:px-6 md:py-5 outline-none focus:border-cyan-500 text-[10px] font-bold text-cyan-400 tracking-widest" placeholder="AIzaSy..."/>
                    </div>
                  </div>

                  <div className="space-y-3 md:space-y-4">
                    <p className="text-[11px] font-black text-cyan-500 uppercase tracking-[0.3em] italic pl-2 flex items-center gap-2"><Bot size={14}/> Directive Comportementale</p>
                    <textarea value={persona} onChange={(e) => setPersona(e.target.value)} className="w-full h-20 md:h-28 bg-[#0a1525]/80 border border-cyan-500/20 rounded-[24px] md:rounded-[32px] p-5 outline-none focus:border-cyan-500 text-[12px] font-medium text-cyan-100 placeholder-cyan-900/30 resize-none" placeholder="Comment JARVISSE doit-il vous servir ?"/>
                  </div>

                  <div className="space-y-3 md:space-y-5">
                    <p className="text-[11px] font-black text-cyan-500 uppercase tracking-[0.3em] italic pl-2 flex items-center gap-2"><Cpu size={14}/> Architecture Gemini Active</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
                       {geminiOptions.map((opt) => (
                         <button key={opt.id} onClick={() => setGeminiVersion(opt.id)} className={`p-4 md:p-5 rounded-[20px] md:rounded-[24px] border text-left flex items-center justify-between transition-all ${geminiVersion === opt.id ? "bg-cyan-500/20 border-cyan-500 text-cyan-400 shadow-cyan" : "bg-white/3 border-white/5 text-cyan-900 hover:bg-white/5"}`}>
                           <span className="text-[10px] md:text-[11px] font-black uppercase tracking-widest leading-tight">{opt.name}</span>
                           {geminiVersion === opt.id && <Zap size={14} className="fill-current text-cyan-400 md:w-4 md:h-4" />}
                         </button>
                       ))}
                    </div>
                  </div>
                  <div className="space-y-3 md:space-y-4">
                    <div className="flex items-center justify-between p-3 md:p-4 bg-[#0a1525]/80 border border-cyan-500/20 rounded-[24px]">
                      <div className="space-y-1">
                        <p className="text-[11px] font-black text-cyan-500 uppercase tracking-[0.2em] flex items-center gap-2"><Mic size={14}/> Conversation Continue</p>
                        <p className="text-[8px] md:text-[9px] text-cyan-700 font-bold uppercase tracking-widest max-w-[170px] md:max-w-xs">Voix auto et micro ouvert après chaque réponse.</p>
                      </div>
                      <button onClick={() => {
                        const newVal = !continuousMode;
                        setContinuousMode(newVal);
                        localStorage.setItem("jarvis_continuous", newVal);
                      }} className={`w-12 h-6 md:w-14 md:h-7 rounded-full transition-all relative shrink-0 ${continuousMode ? "bg-cyan-500 shadow-cyan border-none" : "bg-[#0a1525] border border-cyan-500/30"}`}>
                        <div className={`absolute top-1 left-1 w-4 h-4 md:w-5 md:h-5 rounded-full bg-white transition-transform ${continuousMode ? "translate-x-6 md:translate-x-7" : ""}`} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                    <div className="space-y-3 md:space-y-4">
                      {/* Radar de Signal Micro (VU-mètre) */}
                      <div className="p-3 bg-gray-950/50 rounded-xl border border-cyan-500/20 mb-4">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[9px] font-black tracking-widest text-cyan-500 uppercase">Radar Signal</span>
                          <span className="text-[9px] text-cyan-500/50">{Math.round(micLevel)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-cyan-900/10 rounded-full overflow-hidden border border-cyan-500/5">
                          <motion.div 
                            className="h-full bg-cyan-500 shadow-[0_0_10px_cyan]"
                            animate={{ width: `${Math.min(100, micLevel * 2)}%` }}
                          />
                        </div>
                      </div>

                      <p className="text-[11px] font-black text-cyan-500 uppercase tracking-[0.3em] italic pl-2 flex items-center gap-2 mb-2"><Volume2 size={14}/> Processeur Vocal Elite</p>
                      <select value={selectedVoice} onChange={(e) => setSelectedVoice(e.target.value)} className="w-full bg-[#0a1525]/80 border border-cyan-500/20 rounded-[20px] px-5 py-4 outline-none focus:border-cyan-500 text-[11px] font-black text-cyan-400 uppercase tracking-widest cursor-pointer">
                        <optgroup label="🌐 VOIX GOOGLE (GRATUIT & SANS CLÉ)">
                          <option value="google">🌐 Google Assistant (Français)</option>
                        </optgroup>
                        <optgroup label="PROTOCOL PREMIUM (Nécessite Clé OpenAI)">
                          <option value="onyx">Onyx (Stark Original)</option>
                          <option value="alloy">Alloy (Neutre)</option>
                          <option value="echo">Echo (Profond)</option>
                          <option value="fable">Fable (Narratif)</option>
                          <option value="nova">Nova (Énergique)</option>
                          <option value="shimmer">Shimmer (Clair)</option>
                        </optgroup>
                        <optgroup label="SYSTÈME LOCAL">
                          <option value="system">Voix Windows Standard (Robot)</option>
                        </optgroup>
                      </select>
                    </div>
                    <div className="space-y-3 md:space-y-4">
                      <p className="text-[11px] font-black text-cyan-500 uppercase tracking-[0.3em] italic pl-2 flex items-center gap-2"><Zap size={14}/> Fréquence de Débit ({voiceSpeed}x)</p>
                      <input type="range" min="0.5" max="2.0" step="0.1" value={voiceSpeed} onChange={(e) => setVoiceSpeed(parseFloat(e.target.value))} className="w-full accent-cyan-500 h-2 bg-cyan-900/30 rounded-lg appearance-none cursor-pointer mt-4" />
                    </div>
                  </div>

                  <button 
                    onClick={() => speak("Monsieur Roy, les protocoles vocaux sont en ligne. Me recevez-vous ?")}
                    className="w-full bg-transparent border border-cyan-500/30 py-3 rounded-2xl text-[10px] font-black text-cyan-500 uppercase tracking-widest hover:bg-cyan-500/10 transition-all mb-2"
                  >
                    🔊 TESTER LA LIAISON VOCALE
                  </button>

                  <button onClick={() => { 
                    localStorage.setItem("jarvis_persona", persona); 
                    localStorage.setItem("google_api_key", googleKey); 
                    localStorage.setItem("gemini_version", geminiVersion); 
                    localStorage.setItem("jarvis_user_name", userName); 
                    localStorage.setItem("jarvis_voice_speed", voiceSpeed);
                    localStorage.setItem("jarvis_selected_voice", selectedVoice);
                    setShowSettings(false); 
                  }} className="w-full bg-cyan-500 py-4 md:py-6 rounded-[24px] md:rounded-[32px] font-black uppercase tracking-[0.4em] text-[11px] md:text-[13px] shadow-lg shadow-cyan-500/30 flex items-center justify-center gap-3 hover:bg-cyan-400 transition-all text-gray-950">
                    <Save size={18}/> SYNCHRONISER_S SYSTÈME
                  </button>
                </div>

                <div className="pt-4 md:pt-6 border-t border-cyan-500/10 flex justify-between items-center mt-6">
                  <button onClick={logout} className="text-red-500 text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2 hover:text-red-400 transition-all bg-red-500/5 px-4 py-2.5 md:px-6 md:py-3 rounded-[16px] md:rounded-full border border-red-500/20"><LogOut size={14} /> ÉJECTION</button>
                  <span className="text-[7.5px] md:text-[9px] text-cyan-900 font-bold tracking-[0.3em] md:tracking-[0.4em] uppercase text-right">Security Active</span>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Auth UI */}
        {authMode !== "hidden" && !token && (
          <div className="fixed inset-0 z-[100] bg-[#05060f] flex items-center justify-center p-5">
            <form onSubmit={(e) => handleAuth(e, authMode)} className="w-full max-w-sm space-y-10 animate-in zoom-in duration-500">
              <div className="text-center space-y-4">
                <div className="text-5xl mb-4">🤖</div>
                <h3 className="text-xl md:text-2xl font-black uppercase tracking-[0.3em] md:tracking-[0.4em] italic">ACCÈS_LOYAUTÉ</h3>
                <p className="text-[10px] text-gray-600 uppercase tracking-widest">Système Jarvisse — Stark Protocol</p>
              </div>
              <div className="space-y-4">
                <input name="email" type="email" placeholder="IDENTIFIANT ROY" className="w-full bg-white/5 border border-white/10 rounded-[20px] px-5 py-4 outline-none focus:border-blue-500 text-[11px] font-black tracking-[0.2em] text-blue-400 uppercase placeholder-gray-800" required />
                <input name="password" type="password" placeholder="CODE_TACTIQUE" className="w-full bg-white/5 border border-white/10 rounded-[20px] px-5 py-4 outline-none focus:border-blue-500 text-[11px] font-black tracking-[0.2em] text-blue-400 uppercase placeholder-gray-800" required />
                <button type="submit" className="w-full bg-blue-600 py-5 rounded-[20px] font-black uppercase tracking-[0.3em] text-[12px] shadow-2xl shadow-blue-600/20 active:scale-95 transition-all text-white">⚡ INITIALISER JARVISSE</button>
              </div>
              <p onClick={() => setAuthMode(authMode === "login" ? "register" : "login")} className="text-center text-[10px] text-gray-600 cursor-pointer font-black uppercase tracking-[0.3em] hover:text-blue-500 transition-colors">{authMode === "login" ? "🔑 GÉNÉRER UN ACCÈS" : "← RETOUR UNITÉ"}</p>
            </form>
          </div>
        )}
        {/* BOUTIQUE STARK MODAL */}
        <AnimatePresence>
          {showShop && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setShowShop(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-md"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative w-full max-w-2xl glass p-8 rounded-[40px] border border-cyan-500/30 overflow-hidden shadow-2xl bg-gray-950"
              >
                <div className="absolute top-0 right-0 p-4">
                  <button onClick={() => setShowShop(false)} className="text-cyan-900 hover:text-cyan-400 p-2"><X size={24} /></button>
                </div>
                
                <div className="text-center mb-10 mt-4">
                  <h2 className="text-2xl md:text-3xl font-black uppercase tracking-[0.3em] text-cyan-400 italic mb-2">BOUTIQUE_STARK</h2>
                  <p className="text-cyan-200/50 text-[10px] md:text-[12px] font-bold tracking-widest uppercase">Financement tactique - Rechargement des Unités JARVISSE</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { id: "pack_100", name: "Pack Recrue", credits: 100, price: "5€", icon: <Cpu /> },
                    { id: "pack_500", name: "Pack Agent", credits: 500, price: "20€", icon: <Zap />, best: true },
                    { id: "pack_2000", name: "Pack Stark", credits: 2000, price: "50€", icon: <Sparkles /> }
                  ].map(pack => (
                    <div key={pack.id} className={`relative p-6 rounded-[32px] border transition-all flex flex-col items-center ${pack.best ? 'bg-cyan-500/10 border-cyan-500/50 shadow-cyan scale-105' : 'bg-white/3 border-white/10 hover:border-cyan-500/20'}`}>
                      {pack.best && <div className="absolute -top-3 px-3 py-1 bg-cyan-500 text-[8px] font-black italic rounded-full text-gray-950 uppercase">Populaire</div>}
                      <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4">{pack.icon}</div>
                      <div className="text-[12px] font-black text-white mb-1 uppercase tracking-widest">{pack.name}</div>
                      <div className="text-2xl font-black text-cyan-400 mb-1">{pack.credits} <span className="text-[10px] font-bold">U</span></div>
                      <div className="text-[14px] font-bold text-white/40 mb-6">{pack.price}</div>
                      <button 
                        onClick={() => purchasePack(pack.id)}
                        className="w-full py-4 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 text-[10px] font-black text-cyan-400 uppercase tracking-widest hover:bg-cyan-500/40 transition-all"
                      >
                        ACQUÉRIR
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-10 p-6 bg-white/3 rounded-3xl border border-white/5 text-center">
                  <div className="text-[10px] text-white/30 uppercase tracking-[0.2em]">Votre statut actuel : <span className="text-cyan-400 font-black italic">{userPlan}</span></div>
                </div>

                <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-cyan-500/5 blur-[80px] rounded-full"></div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
