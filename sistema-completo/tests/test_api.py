from pathlib import Path
import sys
import sqlite3
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server
from fastapi.testclient import TestClient

def test_full_flow(tmp_path):
    server.DB_PATH = tmp_path / 'test.db'
    with TestClient(server.app) as client:
        assert client.get('/api/health').json()['database'] == 'sqlite'
        assert client.get('/api/state').status_code == 401
        assert client.post('/api/auth/login',json={'email':'camila@example.com','password':'wrong'}).status_code == 401
        response=client.post('/api/auth/login',json={'email':'camila@example.com','password':'demo123'})
        assert response.status_code == 200
        assert 'HttpOnly' in response.headers['set-cookie']
        assert 'SameSite=strict' in response.headers['set-cookie']
        state=client.get('/api/state').json()
        assert len(state['patients']) == 4
        assert 'password_hash' not in str(state)
        assert client.post('/api/patients',json={'name':'Teste','email':'novo@example.com','goal':'Teste','password':'secret123'},headers={'Origin':'https://evil.example'}).status_code==403
        response=client.post('/api/patients',json={'name':'Novo Paciente','email':'novo@example.com','goal':'Teste acadêmico','password':'secret123'})
        assert response.status_code==200,response.text
        pid=response.json()['id']
        assert client.post('/api/patients',json={'name':'Duplicado','email':'novo@example.com','goal':'Teste','password':'secret123'}).status_code==409
        payload={'patient':pid,'frequency':'Diariamente','start':server.today(),'end':server.today(),'exercises':['e1'],'notes':'Rotina de teste'}
        response=client.post('/api/routines',json=payload)
        assert response.status_code==200,response.text
        rid=response.json()['id']
        assert client.post('/api/routines',json=payload).status_code==409
        assert client.post('/api/routines',json={**payload,'end':'2000-01-01'}).status_code==422
        assert client.post('/api/messages',json={'patient':pid,'text':'Olá, paciente!'}).status_code==200
        client.post('/api/auth/logout',json={})
        assert client.get('/api/state').status_code==401
        assert client.post('/api/auth/login',json={'email':'novo@example.com','password':'secret123'}).status_code==200
        state=client.get('/api/state').json()
        assert len(state['patients'])==1 and state['patients'][0]['id']==pid
        assert len(state['routines'])==1
        assert state['messages'][0]['text']=='Olá, paciente!'
        assert client.post('/api/patients',json={'name':'Negado','email':'nao@example.com','goal':'X','password':'secret123'}).status_code==403
        assert client.post('/api/routines',json=payload).status_code==403
        log={'routine':rid,'exercise':'e1','completed':True,'pain':3,'comment':'Concluí!'}
        for pain in [-1,11,2.5,True,'3']:
            assert client.post('/api/logs',json={**log,'pain':pain}).status_code==422
        assert client.post('/api/logs',json={**log,'routine':'r1'}).status_code==403
        assert client.post('/api/logs',json=log).status_code==200
        assert client.post('/api/logs',json=log).status_code==409
        assert client.post('/api/messages',json={'patient':'p1','text':'Acesso indevido'}).status_code==403
        assert client.post('/api/messages',json={'patient':pid,'text':'Atividade registrada'}).status_code==200
        assert client.post('/api/routines/'+rid+'/end',json={}).status_code==403
        client.post('/api/auth/logout',json={})
        client.post('/api/auth/login',json={'email':'camila@example.com','password':'demo123'})
        state=client.get('/api/state').json()
        assert any(l['comment']=='Concluí!' for l in state['logs'])
        assert any(m['text']=='Atividade registrada' for m in state['messages'])
        assert client.post('/api/routines/'+rid+'/end',json={}).status_code==200
        assert any(l['comment']=='Concluí!' for l in client.get('/api/state').json()['logs'])
        assert client.get('/').status_code==200
        assert client.get('/app.js').status_code==200
    # Reabrir a aplicação preserva os dados e não executa seed novamente.
    with TestClient(server.app) as second:
        assert second.post('/api/auth/login',json={'email':'novo@example.com','password':'secret123'}).status_code==200
        state=second.get('/api/state').json()
        assert state['logs'][0]['comment']=='Concluí!'
        assert state['routines'][0]['active'] is False
    with sqlite3.connect(server.DB_PATH) as c:
        encoded=c.execute('SELECT password_hash FROM users WHERE id=?',(pid,)).fetchone()[0]
        assert encoded.startswith('pbkdf2_sha256$') and 'secret123' not in encoded
        assert c.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
