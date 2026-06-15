from flask import Flask, render_template, request, jsonify, Response
import requests
import json
import os
import re
from dotenv import load_dotenv

load_dotenv()  # charge les variables depuis .env

app = Flask(__name__)

# ---------- Chargement FAO ----------
FAO_MAP = {}
FAO_LIST = []

def load_fao():
    path = os.path.join(os.path.dirname(__file__), 'data', 'fao.json')
    with open(path, 'r', encoding='utf-8') as f:
        records = json.load(f)
    for r in records:
        sci = r[0].strip()
        if sci:
            key = sci.lower()
            FAO_MAP[key] = {
                'sci': sci,
                'eng': r[1],
                'fra': r[2],
                'code': r[3],
                'family': r[4],
                'order': r[5]
            }
            FAO_LIST.append(sci)
    print(f"[FAO] {len(FAO_MAP)} espèces chargées")

load_fao()

# ---------- Configuration Groq (clé depuis environnement) ----------
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError("❌ GROQ_API_KEY manquante – vérifie le fichier .env")
GROQ_MODEL = "llama-3.3-70b-versatile"
GROQ_SPECIES_CACHE = {}

def fetch_species_from_groq(scientific_name):
    if scientific_name in GROQ_SPECIES_CACHE:
        return GROQ_SPECIES_CACHE[scientific_name]
    prompt = f"""Tu es un expert en biologie marine. Donne-moi une fiche complète pour l'espèce "{scientific_name}".
Réponds UNIQUEMENT avec un JSON valide (sans markdown, sans backticks) contenant les champs :
{{"Length": "...", "Weight": "...", "DepthRangeShallow": "...", "DepthRangeDeep": "...", "TemperatureRange": "...", "Habitat": "...", "Distribution": "...", "FoodItems": "...", "Behavior": "...", "Biology": "...", "Comments": "...", "IUCNCode": "...", "Vulnerability": "..."}}"""
    groq_messages = [
        {'role': 'system', 'content': "Tu es un assistant spécialisé en espèces marines. Tu réponds toujours en JSON valide."},
        {'role': 'user', 'content': prompt}
    ]
    try:
        resp = requests.post(
            'https://api.groq.com/openai/v1/chat/completions',
            headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {GROQ_API_KEY}'},
            json={'model': GROQ_MODEL, 'messages': groq_messages, 'max_tokens': 1024, 'temperature': 0.3, 'stream': False},
            timeout=20
        )
        if resp.status_code == 200:
            content = resp.json()['choices'][0]['message']['content']
            content = re.sub(r'```json\s*|```', '', content).strip()
            data = json.loads(content)
            for field in ['Length', 'Weight', 'DepthRangeShallow', 'DepthRangeDeep']:
                if data.get(field) and isinstance(data[field], str):
                    try:
                        data[field] = float(data[field])
                    except:
                        pass
            GROQ_SPECIES_CACHE[scientific_name] = data
            return data
    except Exception as e:
        print(f"[Groq Species Error] {e}")
    return None

# ---------- Routes ----------
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/suggest')
def suggest():
    q = request.args.get('q', '').strip()
    if len(q) < 2:
        return jsonify([])
    ql = q.lower()
    results = []
    for sci in FAO_LIST:
        if sci.lower().startswith(ql):
            results.append(sci)
            if len(results) >= 5:
                break
    for sci in FAO_LIST:
        if ql in sci.lower() and sci not in results:
            results.append(sci)
            if len(results) >= 8:
                break
    for r in FAO_MAP.values():
        if len(results) >= 10:
            break
        if r['sci'] in results:
            continue
        if (r['eng'] and ql in r['eng'].lower()) or (r['fra'] and ql in r['fra'].lower()):
            results.append(r['sci'])
    if not results:
        try:
            resp = requests.get(f"https://api.gbif.org/v1/species/suggest?q={q}&limit=8", timeout=5)
            for item in resp.json():
                sci = item.get('species') or item.get('canonicalName') or item.get('scientificName', '')
                if sci and sci not in results:
                    results.append(sci)
        except:
            pass
    output = []
    for sci in results[:10]:
        fao = FAO_MAP.get(sci.lower(), {})
        output.append({'sci': sci, 'eng': fao.get('eng', ''), 'fra': fao.get('fra', ''), 'code': fao.get('code', ''), 'family': fao.get('family', '')})
    return jsonify(output)

@app.route('/species')
def species():
    sci = request.args.get('name', '').strip()
    if not sci:
        return jsonify({'error': 'Nom manquant'}), 400
    fao = FAO_MAP.get(sci.lower(), {})
    data = {'fao': fao, 'detail': {}, 'source': 'FAO ASFIS'}
    detail_found = False
    for base_url, source in [
        (f"https://fishbase.ropensci.org/api/v1/summary?specname={requests.utils.quote(sci)}", 'FishBase'),
        (f"https://sealifebase.ropensci.org/api/v1/summary?specname={requests.utils.quote(sci)}", 'SeaLifeBase')
    ]:
        try:
            resp = requests.get(base_url, timeout=8)
            if resp.status_code == 200:
                d = resp.json()
                if d and not d.get('error'):
                    obj = d[0] if isinstance(d, list) else d
                    if obj.get('ScientificName'):
                        data['detail'] = obj
                        data['source'] = source
                        detail_found = True
                        break
        except:
            pass
    if not detail_found or not data['detail']:
        groq_data = fetch_species_from_groq(sci)
        if groq_data:
            data['detail'].update(groq_data)
            data['source'] = 'Groq IA (synthèse)'
            data['fallback'] = True
    data['photo'] = get_wiki_photo(sci)
    return jsonify(data)

def get_wiki_photo(sci_name):
    slug = sci_name.replace(' ', '_')
    headers = {'User-Agent': 'OceanGuideAI/2.0 (educational project)'}
    try:
        url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{slug}"
        resp = requests.get(url, timeout=7, headers=headers)
        if resp.status_code == 200:
            thumb = resp.json().get('thumbnail', {}).get('source', '')
            if thumb:
                for size in ['50px','100px','150px','220px','240px','320px','480px']:
                    thumb = thumb.replace(size, '600px')
                return thumb
    except:
        pass
    try:
        url = f"https://en.wikipedia.org/w/api.php?action=query&titles={slug}&prop=pageimages&format=json&pithumbsize=600"
        resp = requests.get(url, timeout=7, headers=headers)
        if resp.status_code == 200:
            pages = resp.json().get('query', {}).get('pages', {})
            for page in pages.values():
                thumb = page.get('thumbnail', {}).get('source', '')
                if thumb:
                    return thumb
    except:
        pass
    try:
        url = f"https://api.inaturalist.org/v1/taxa?q={requests.utils.quote(sci_name)}&per_page=1"
        resp = requests.get(url, timeout=7, headers=headers)
        if resp.status_code == 200:
            results = resp.json().get('results', [])
            if results:
                photo_data = results[0].get('default_photo', {})
                medium_url = photo_data.get('medium_url', '')
                if medium_url:
                    return medium_url.replace('medium', 'large')
    except:
        pass
    return ''

@app.route('/chat', methods=['POST'])
def chat():
    body = request.get_json()
    messages = body.get('messages', [])
    partial_desc = body.get('partial_desc', '')
    system_prompt = f"""Tu es MarineBot 🌊, un expert marin passionné et sympa.
Tu aides à identifier des espèces marines.
RÈGLES :
1. Si la description est vague, pose UNE question ciblée. Utilise des emojis.
2. Quand tu as assez d'infos, réponds UNIQUEMENT avec ce JSON : {{"identified": true, "scientific_name": "...", "confidence": "high|medium|low", "common_fr": "...", "common_en": "...", "reason": "...", "fun_fact": "..."}}
3. Si tu poses une question → texte naturel français UNIQUEMENT.
4. Description accumulée : "{partial_desc}"
CONNAISSANCES LOCALES MAROCAINES : bassogho → Mérou, bo9ronis → Pageot, chergui → Thon rouge, lafond → Rascasse, skombri → Maquereau, sardine → Sardine, anjoua → Anchois, hout → poisson (demander détails), ghbous → Môle."""
    groq_messages = [{'role': 'system', 'content': system_prompt}] + messages
    def generate():
        if not GROQ_API_KEY:
            yield f"data: {json.dumps({'error': 'Clé Groq manquante'})}\n\n"
            return
        try:
            resp = requests.post(
                'https://api.groq.com/openai/v1/chat/completions',
                headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {GROQ_API_KEY}'},
                json={'model': GROQ_MODEL, 'messages': groq_messages, 'max_tokens': 1024, 'temperature': 0.7, 'stream': True},
                stream=True, timeout=30
            )
            if resp.status_code != 200:
                yield f"data: {json.dumps({'error': f'Groq erreur {resp.status_code}'})}\n\n"
                return
            full_text = ''
            for line in resp.iter_lines():
                if not line:
                    continue
                line = line.decode('utf-8')
                if line.startswith('data: '):
                    raw = line[6:]
                    if raw == '[DONE]':
                        break
                    try:
                        event = json.loads(raw)
                        chunk = event['choices'][0]['delta'].get('content', '')
                        if chunk:
                            full_text += chunk
                            yield f"data: {json.dumps({'chunk': chunk})}\n\n"
                    except:
                        pass
            yield f"data: {json.dumps({'done': True, 'full': full_text})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
    return Response(generate(), mimetype='text/event-stream', headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'})

if __name__ == '__main__':
    print("=" * 50)
    print("  Ocean Guide AI – Flask Server")
    print("  http://127.0.0.1:5000")
    print("=" * 50)
    app.run(debug=True, port=5000)