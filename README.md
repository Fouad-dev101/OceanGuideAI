# Ocean Guide AI

Application web d’identification d’espèces marines (poissons, crustacés, mollusques) par nom scientifique/commun ou par description en langage naturel (chatbot IA).

## Fonctionnalités
- Recherche par nom (autocomplétion depuis la base FAO et GBIF)
- Fiche détaillée avec photo, description, habitat, code FAO
- Chatbot (MarineBot) utilisant l’API Groq (Llama 3.3) pour identifier une espèce à partir d’une description
- Interface responsive, design océanique

## Technologies
- Backend : Flask (Python)
- Frontend : HTML/CSS/JS
- APIs : FishBase, SeaLifeBase, GBIF, Groq
- Hébergement : PythonAnywhere

## Installation locale
# bash:
* git clone https://github.com/Fouaddev101/OceanGuideAI.git
* cd OceanGuideAI
* python -m venv venv
* source venv/bin/activate  # ou venv\Scripts\activate sur Windows
* pip install -r requirements.txt
