# Fisio Acompanha — backend e banco de dados

Aplicação acadêmica completa em HTML/CSS/JavaScript, Python/FastAPI e SQLite. Não exige servidor de banco separado.

## Executar neste computador

Dê dois cliques em **INICIAR.cmd**. O navegador abrirá em **http://127.0.0.1:8766**. Mantenha a janela do servidor aberta; feche-a ou pressione Ctrl+C para encerrar.

Se o servidor já estiver rodando, basta acessar esse endereço. Não abra public/index.html diretamente: esta versão depende da API.

Em outro computador, instale Python 3.11 ou superior, execute `python -m pip install -r requirements.txt` na pasta e então `python iniciar.py`.

## Acesso

| Perfil | E-mail | Senha |
|---|---|---|
| Fisioterapeuta | camila@example.com | demo123 |
| Paciente Mariana | mariana@example.com | demo123 |
| Paciente Pedro | pedro@example.com | demo123 |
| Paciente Beatriz | beatriz@example.com | demo123 |
| Paciente Lucas | lucas@example.com | demo123 |

Ao cadastrar outro paciente, o fisioterapeuta define sua senha inicial. Para demonstrar outro perfil, use Sair da conta e entre com as credenciais correspondentes. Duas janelas anônimas ou navegadores diferentes permitem duas sessões simultâneas. Mensagens são consultadas pelo botão Atualizar conversa.

## Apresentação em cinco passos

1. Entre como Camila e cadastre um paciente fictício com e-mail e senha.
2. Crie uma prescrição diária para ele, com início hoje.
3. Saia e entre com a conta do paciente. Consulte Minha rotina e registre atividade, dor e comentário.
4. Retorne à conta de Camila e veja o registro na Evolução desse paciente.
5. Envie uma mensagem, demonstre a outra conta e explique que os dados permanecem no banco mesmo após reiniciar o servidor.

## Banco e arquitetura

- `public/`: interface do navegador, conectada por fetch à API REST.
- `server.py`: autenticação, autorização, validações, consultas e transações.
- `schema.sql`: tabelas users, patients, exercises, routines, routine_exercises, logs, messages e sessions; chaves estrangeiras e restrições.
- `data/fisioterapia.db`: banco SQLite criado automaticamente na primeira execução. Não é localStorage.
- `seed.json`: exemplos fictícios importados uma única vez, quando o banco está vazio.
- `/docs`: documentação interativa dos endpoints FastAPI.
- `/api/health`: verificação do servidor e da conexão SQLite.

Para fazer uma cópia do banco, encerre o servidor primeiro e copie a pasta data. Não apague o banco para atualizar o código. O banco não é distribuído no ZIP: cada instalação inicia seus próprios exemplos.

## Regras implementadas

Login com senha PBKDF2-SHA256 com salt e 310.000 iterações; sessão de oito horas por cookie HttpOnly/SameSite; encerramento de sessão no servidor; consultas filtradas por perfil e vínculo. O paciente não recebe dados de outros pacientes. SQL usa parâmetros; escrita utiliza transações; o banco bloqueia registros repetidos e dor fora da escala. Prescrições exigem datas válidas e não permitem sobreposição do mesmo exercício. Encerrar prescrição mantém o histórico. Lembretes são calculados para atividades previstas e pendentes na interface; não são notificações externas.

## Verificação

`python -m pip install pytest httpx` caso as ferramentas de teste não estejam instaladas.

`python -m pytest tests -q`

O teste integrado usa um banco temporário e verifica login/logout, criação, prescrição, autorização de perfis, isolamento de pacientes, dor inválida, duplicidade, mensagens, histórico, persistência após reinício e integridade SQLite. A inspeção visual automatizada não foi executada porque não havia navegador conectado.

## Limites

Versão acadêmica para execução local com dados fictícios. As contas de demonstração têm senhas conhecidas; não disponibilize esta configuração publicamente nem use dados reais. Não há recuperação de senha, cadastro de novos profissionais pela interface, auditoria completa de alterações, notificações externas ou atualização por WebSocket. A aplicação não realiza diagnósticos nem prescrições automáticas.

Python/FastAPI e SQLite foram escolhidos para executar rapidamente neste ambiente; substituem a proposta Java/Spring Boot e H2 do documento. O site publicado anteriormente continua sendo o protótipo estático; esta versão completa usa o servidor local.

Equipe UDF: Amanda, Flavio, Kecia, Lohanne, Luísângel, Luiz, Marcus, Miguel, Uriel e Vinicius.
