# Fisio Acompanha — backend e banco de dados

Aplicação acadêmica completa em HTML/CSS/JavaScript, Python/FastAPI e SQLite. Não exige servidor de banco separado.

## Arquivo único para Windows

A edição `Fisio_Acompanha.exe` inclui o runtime Python, a interface, o servidor e o esquema SQLite. Abra com dois cliques: o navegador abre automaticamente. Mantenha a janela do aplicativo aberta durante o uso e feche-a para encerrar o servidor. Não exige instalar Python nem extrair arquivos manualmente. O banco dessa edição é criado em `%LOCALAPPDATA%\FisioAcompanha\fisioterapia.db` e permanece salvo ao fechar ou substituir o executável. Cada computador mantém seu próprio banco.

O executável é para Windows de 64 bits. As contas de demonstração são as mesmas listadas abaixo.

## Executar neste computador

Dê dois cliques em **INICIAR.cmd**. O navegador abrirá em **http://127.0.0.1:8766**. Mantenha a janela do servidor aberta; feche-a ou pressione Ctrl+C para encerrar. Na primeira execução, as dependências (FastAPI e Uvicorn) são instaladas automaticamente.

Não abra public/index.html diretamente: esta versão depende da API.

### Antes de apresentar: RESETAR_DEMO.cmd

Os dados de exemplo são gerados com datas relativas ao dia em que o banco é criado (cerca de 4 semanas de histórico, com a dor diminuindo ao longo do tempo). **No dia da apresentação, feche o sistema e dê dois cliques em RESETAR_DEMO.cmd**: o banco é recriado com o histórico terminando ontem, a Mariana fica com os exercícios de hoje pendentes para registrar ao vivo, e tudo o que foi cadastrado em testes é apagado. Equivale a `python iniciar.py --resetar`.

## Acesso

Na tela de login há botões de **acesso rápido** para Camila (fisioterapeuta) e Mariana (paciente).

| Perfil | E-mail | Senha |
|---|---|---|
| Fisioterapeuta | camila@example.com | demo123 |
| Paciente Mariana | mariana@example.com | demo123 |
| Paciente Pedro | pedro@example.com | demo123 |
| Paciente Beatriz | beatriz@example.com | demo123 |
| Paciente Lucas | lucas@example.com | demo123 |

Ao cadastrar outro paciente, o fisioterapeuta define sua senha inicial.

## Roteiro de apresentação (5 minutos)

Dica: abra uma janela normal com a Camila e uma **janela anônima** (Ctrl+Shift+N) com a Mariana, lado a lado. A tela se atualiza sozinha a cada 5 segundos, então o que um faz aparece para o outro.

1. **Problema** — entre consultas, exercícios e relatos de dor se perdem. Mostre a tela de login.
2. **Camila · Visão geral** — conclusão do dia, adesão da semana, dor média com tendência, alerta "Precisa de atenção" (Beatriz com dor alta e sem registros).
3. **Evolução** — clique em Beatriz e depois em Mariana: compare o gráfico de dor (subindo × caindo), adesão e diário.
4. **Mariana · Minha rotina** — clique em Registrar, escolha a dor, comente e confirme. Mostre o lembrete diminuindo.
5. **Volte para a Camila** — o registro aparece na atividade recente e na evolução.
6. **Mensagens** — Mariana envia uma mensagem; na janela da Camila surge o aviso de nova mensagem.
7. **Cadastro** — Camila cadastra um paciente e cria uma prescrição (tente repetir um exercício para mostrar o bloqueio de sobreposição).
8. **Sobre o projeto** — arquitetura (HTML/CSS/JS + FastAPI + SQLite), segurança, ODS 3 e equipe. Mostre também o modo escuro e a API em http://127.0.0.1:8766/docs.

## Banco e arquitetura

- `public/`: interface do navegador, conectada por fetch à API REST.
- `server.py`: autenticação, autorização, validações, consultas e transações.
- `schema.sql`: tabelas users, patients, exercises, routines, routine_exercises, logs, messages e sessions; chaves estrangeiras e restrições.
- `data/fisioterapia.db`: banco SQLite criado automaticamente na primeira execução. Não é localStorage.
- `seed.json`: exemplos fictícios importados quando o banco está vazio. Datas são deslocamentos em dias a partir de hoje e os registros de atividade são simulados a partir do campo `simulate`.
- `/docs`: documentação interativa dos endpoints FastAPI.
- `/api/health`: verificação do servidor e da conexão SQLite.

Para fazer uma cópia do banco, encerre o servidor primeiro e copie a pasta data. Não apague o banco para atualizar o código. O banco não é distribuído no ZIP: cada instalação inicia seus próprios exemplos.

## Regras implementadas

Login com senha PBKDF2-SHA256 com salt e 310.000 iterações; sessão de oito horas por cookie HttpOnly/SameSite; encerramento de sessão no servidor; consultas filtradas por perfil e vínculo. O paciente não recebe dados de outros pacientes. SQL usa parâmetros; escrita utiliza transações; o banco bloqueia registros repetidos e dor fora da escala. Prescrições exigem datas válidas e não permitem sobreposição do mesmo exercício. Encerrar prescrição mantém o histórico. Lembretes são calculados para atividades previstas e pendentes na interface; não são notificações externas.

## Verificação

`python -m pip install pytest httpx` caso as ferramentas de teste não estejam instaladas.

`python -m pytest tests -q`

O teste integrado usa um banco temporário e verifica login/logout, criação, prescrição, autorização de perfis, isolamento de pacientes, dor inválida, duplicidade, mensagens, histórico, persistência após reinício e integridade SQLite.

## Limites

Versão acadêmica para execução local com dados fictícios. As contas de demonstração têm senhas conhecidas; não disponibilize esta configuração publicamente nem use dados reais. Não há recuperação de senha, cadastro de novos profissionais pela interface, auditoria completa de alterações, notificações externas ou atualização por WebSocket. A aplicação não realiza diagnósticos nem prescrições automáticas.

Python/FastAPI e SQLite foram escolhidos para executar rapidamente neste ambiente; substituem a proposta Java/Spring Boot e H2 do documento. O site publicado anteriormente continua sendo o protótipo estático; esta versão completa usa o servidor local.

Equipe UDF: Amanda, Flavio, Kecia, Lohanne, Luísângel, Luiz, Marcus, Miguel, Uriel e Vinicius.
