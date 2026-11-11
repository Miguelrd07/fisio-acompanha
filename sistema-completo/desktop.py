"""Inicializador Windows: um executável com interface, servidor e banco local."""
import http.cookiejar
import json
import logging
import os
from pathlib import Path
import socket
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
import webbrowser

def ready(url):
    try:
        with urllib.request.urlopen(url + '/api/health', timeout=0.4) as response:
            return json.load(response).get('database') == 'sqlite'
    except (OSError, ValueError):
        return False

def make_server(port):
    import uvicorn
    from server import app
    config = uvicorn.Config(app, host='127.0.0.1', port=port, log_config=None,
                            loop='asyncio', http='h11', ws='none', lifespan='on')
    instance = uvicorn.Server(config)
    instance.desktop_thread = threading.Thread(target=instance.run, daemon=True)
    instance.desktop_thread.start()
    return instance

def self_test(destination):
    result = {'ok': False}
    server = None
    try:
        with tempfile.TemporaryDirectory(prefix='fisio-exe-test-') as tmp:
            os.environ['FISIO_DB'] = str(Path(tmp) / 'test.db')
            with socket.socket() as sock:
                sock.bind(('127.0.0.1', 0))
                port = sock.getsockname()[1]
            url = f'http://127.0.0.1:{port}'
            server = make_server(port)
            for _ in range(100):
                if ready(url):
                    break
                time.sleep(0.1)
            assert ready(url), 'Servidor não iniciou'
            client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
            def call(path, data=None):
                req = urllib.request.Request(url+path, data=None if data is None else json.dumps(data).encode(), headers={'Content-Type':'application/json'})
                with client.open(req, timeout=5) as response:
                    return response.read()
            assert b'Fisio Acompanha' in call('/')
            assert b'login-form' in call('/app.js')
            assert b'.login-box' in call('/styles.css')
            call('/api/auth/login', {'email':'camila@example.com','password':'demo123'})
            state = json.loads(call('/api/state'))
            assert state['currentUser']['role'] == 'professional' and len(state['patients']) == 4
            new = json.loads(call('/api/patients', {'name':'Teste EXE','email':'exe@example.com','goal':'Validação do pacote','password':'teste123'}))
            call('/api/auth/logout', {})
            call('/api/auth/login', {'email':'exe@example.com','password':'teste123'})
            state = json.loads(call('/api/state'))
            assert len(state['patients']) == 1 and state['patients'][0]['id'] == new['id']
            import sqlite3
            with sqlite3.connect(os.environ['FISIO_DB']) as db:
                assert db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
                assert db.execute('SELECT count(*) FROM users').fetchone()[0] == 6
            db.close()
            # Verifica também os recursos Tcl/Tk empacotados sem exibir uma janela.
            import tkinter
            window = tkinter.Tk()
            window.withdraw()
            window.update_idletasks()
            window.destroy()
            server.should_exit = True
            server.desktop_thread.join(timeout=5)
            result = {'ok': True, 'checks': ['servidor embutido','arquivos da interface','login','cadastro persistido','isolamento de paciente','integridade SQLite','interface desktop Tcl/Tk']}
    except Exception as error:
        import traceback
        result['ok'] = False
        result['error'] = str(error)
        result['traceback'] = traceback.format_exc()
    finally:
        if server:
            server.should_exit = True
        Path(destination).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    return 0 if result['ok'] else 1

def main():
    if len(sys.argv) == 3 and sys.argv[1] == '--self-test':
        raise SystemExit(self_test(sys.argv[2]))
    import tkinter as tk
    from tkinter import messagebox
    storage = Path(os.environ.get('LOCALAPPDATA', Path.home())) / 'FisioAcompanha'
    storage.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(filename=storage/'servidor.log', level=logging.WARNING, encoding='utf-8')
    port = 8766
    url = f'http://127.0.0.1:{port}'
    if ready(url):
        webbrowser.open(url)
        return
    window = tk.Tk()
    window.title('Fisio Acompanha')
    window.geometry('490x440')
    window.resizable(False, False)
    window.configure(bg='#f5f7f4')
    tk.Label(window, text='fisio acompanha', bg='#123630', fg='#c6ef9b', font=('Segoe UI',23,'bold'), pady=24).pack(fill='x')
    status = tk.StringVar(value='Iniciando o sistema…')
    tk.Label(window, textvariable=status, bg='#f5f7f4', fg='#123630', font=('Segoe UI',12), pady=16).pack()
    tk.Label(window, text='Fisioterapeuta: camila@example.com\nPaciente: mariana@example.com\nSenha das contas de exemplo: demo123', bg='#f5f7f4', fg='#425a50', font=('Segoe UI',11), justify='left').pack(pady=8)
    button = tk.Button(window, text='Abrir o sistema', command=lambda:webbrowser.open(url), bg='#123630', fg='white', activebackground='#1f4d44', activeforeground='white', font=('Segoe UI',11,'bold'), relief='flat', padx=30, pady=10, state='disabled')
    button.pack(pady=(12, 4))
    def reset():
        if not messagebox.askyesno('Fisio Acompanha', 'Recriar os dados de demonstração com as datas de hoje?\nCadastros feitos neste computador serão apagados.'):
            return
        import server as backend
        backend.reset_database()
        messagebox.showinfo('Fisio Acompanha', 'Dados recriados. Atualize a página do navegador (F5) e entre novamente.')
    tk.Button(window, text='Recriar dados de demonstração', command=reset, bg='#f5f7f4', fg='#425a50', activebackground='#e6ece6', font=('Segoe UI',9,'underline'), relief='flat', bd=0, cursor='hand2').pack(pady=(0, 10))
    tk.Label(window, text='Mantenha esta janela aberta enquanto usa o sistema.\nOs dados ficam salvos neste computador.', bg='#f5f7f4', fg='#68796f', font=('Segoe UI',9)).pack()
    server = make_server(port)
    def close():
        server.should_exit = True
        server.desktop_thread.join(timeout=5)
        window.destroy()
    window.protocol('WM_DELETE_WINDOW', close)
    attempts = 0
    def check():
        nonlocal attempts
        attempts += 1
        if ready(url):
            status.set('Sistema pronto para usar')
            button.config(state='normal')
            webbrowser.open(url)
        elif attempts < 60:
            window.after(250, check)
        else:
            status.set('Não foi possível iniciar o servidor.')
            messagebox.showerror('Fisio Acompanha', 'A porta 8766 pode estar ocupada. Feche outra instância e abra o aplicativo novamente.')
    window.after(250, check)
    window.mainloop()

if __name__ == '__main__':
    main()
