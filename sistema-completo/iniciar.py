"""Inicia o Fisio Acompanha em http://127.0.0.1:8766 e abre o navegador.

Uso:
  python iniciar.py            inicia o sistema
  python iniciar.py --resetar  recria os dados de demonstração (com datas atuais) e inicia
"""
from pathlib import Path
import subprocess
import sys
import threading
import time
import urllib.request
import webbrowser

ROOT = Path(__file__).resolve().parent
URL = 'http://127.0.0.1:8766'

def running():
    try:
        with urllib.request.urlopen(URL + '/api/health', timeout=1) as response:
            return response.status == 200
    except OSError:
        return False

def ensure_dependencies():
    try:
        import fastapi, uvicorn  # noqa: F401
    except ImportError:
        print('Instalando dependências (só na primeira vez)...')
        subprocess.check_call([sys.executable, '-m', 'pip', 'install', '-r', str(ROOT / 'requirements.txt')])

def open_browser():
    for _ in range(40):
        if running():
            webbrowser.open(URL)
            return
        time.sleep(0.5)

if __name__ == '__main__':
    reset = '--resetar' in sys.argv
    if running():
        if reset:
            print('O sistema já está aberto em outra janela. Feche-a e execute o reset novamente.')
            raise SystemExit(1)
        webbrowser.open(URL)
        raise SystemExit(0)
    ensure_dependencies()
    sys.path.insert(0, str(ROOT))
    import uvicorn
    import server
    if reset:
        server.reset_database()
        print('Dados de demonstração recriados.')
    threading.Thread(target=open_browser, daemon=True).start()
    print(f'Fisio Acompanha: {URL} - mantenha esta janela aberta. Ctrl+C para encerrar.')
    uvicorn.run(server.app, host='127.0.0.1', port=8766)
