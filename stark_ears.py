from flask import Flask, jsonify, request
from flask_cors import CORS
import speech_recognition as sr
import threading
import logging

app = Flask(__name__)
CORS(app)

# Désactiver les logs Flask pour une console silencieuse
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

recognizer = sr.Recognizer()
latest_transcript = ""
is_listening = False
listening_thread = None

def listen_background():
    global latest_transcript, is_listening
    with sr.Microphone() as source:
        print("[STARK EARS] Calibration au bruit ambiant... (1sec)")
        recognizer.adjust_for_ambient_noise(source, duration=1)
        print("[STARK EARS] Micro calibré. Système en attente d'ordres visés.")
        
        while is_listening:
            try:
                # Écoute avec un timeout pour pouvoir vérifier is_listening régulièrement
                audio = recognizer.listen(source, timeout=1, phrase_time_limit=10)
                
                print("[STARK EARS] Signal détecté, transmission à la Forge Cognitive Google...")
                text = recognizer.recognize_google(audio, language="fr-FR")
                
                print(f"[STARK EARS] Traduction réussie : {text}")
                latest_transcript = text
                
            except sr.WaitTimeoutError:
                # Rien n'a été dit pendant le timeout d'une seconde, on boucle pour revérifier is_listening
                continue
            except sr.UnknownValueError:
                print("[STARK EARS] Murmure ou bruit ignoré.")
            except sr.RequestError as e:
                print(f"[STARK EARS] /!\ ALERTE RESEAU GOOGLE /!\ {e}")
            except Exception as e:
                pass

@app.route("/", methods=["GET"])
def index():
    return jsonify({"status": "Agent JARVISSE en ligne"}), 200

@app.route("/transcript", methods=["GET"])
def get_transcript():
    global latest_transcript
    text = latest_transcript
    latest_transcript = ""  # On vide la mémoire après lecture
    return jsonify({"text": text}), 200

@app.route("/command", methods=["POST"])
def command():
    global is_listening, listening_thread
    data = request.get_json() or {}
    action = data.get("action")
    
    if action == "start":
        if not is_listening:
            is_listening = True
            listening_thread = threading.Thread(target=listen_background)
            listening_thread.daemon = True
            listening_thread.start()
            print("\n>>> [STARK EARS] PROTOCOLE D'ECOUTE ACTIVE <<<")
        return jsonify({"status": "started"}), 200
        
    elif action == "stop":
        is_listening = False
        print("\n>>> [STARK EARS] PROTOCOLE D'ECOUTE DESACTIVE <<<")
        return jsonify({"status": "stopped"}), 200
        
    return jsonify({"status": "no change"}), 200

if __name__ == "__main__":
    print("="*50)
    print("   STARK EARS (PYTHON BACKGROUND AGENT) LANCE")
    print("   Port : 3001 | Modèle : Google STT Gratuit ")
    print("="*50)
    app.run(port=3001, debug=False)
