import threading
import urllib.request
import webbrowser
import time

def open_browser():
    for _ in range(40):
        try:
            with urllib.request.urlopen('http://127.0.0.1:8766/api/health', timeout=1) as response:
                if response.status == 200:
                    webbrowser.open('http://127.0.0.1:8766')
                    return
        except OSError:
            time.sleep(0.5)

if __name__ == '__main__':
    try:
        with urllib.request.urlopen('http://127.0.0.1:8766/api/health', timeout=1) as response:
            if response.status == 200:
                webbrowser.open('http://127.0.0.1:8766')
                raise SystemExit(0)
    except OSError:
        pass
    import uvicorn
    from server import app
    threading.Thread(target=open_browser, daemon=True).start()
    print('Fisio Acompanha: http://127.0.0.1:8766 — mantenha esta janela aberta.')
    uvicorn.run(app, host='127.0.0.1', port=8766)
