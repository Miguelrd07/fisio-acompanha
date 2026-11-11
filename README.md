# Fisio Acompanha

> **Para a apresentação, use a versão completa em [`sistema-completo/`](sistema-completo/README.md)** (login, banco SQLite, API e interface nova): dê dois cliques em `sistema-completo/RESETAR_DEMO.cmd` no dia e depois use `INICIAR.cmd`. O conteúdo abaixo descreve o protótipo estático antigo em `dist/`.

Protótipo acadêmico do Sistema de Acompanhamento Fisioterapêutico, baseado nos dois documentos da equipe UDF. Interface responsiva em HTML, CSS e JavaScript, sem instalação ou compilação.

## Abrir

Dê dois cliques em `ABRIR_SITE.cmd`, ou abra `dist/index.html` no navegador. Mantenha `index.html`, `styles.css` e `app.js` juntos na pasta `dist`.

Opcionalmente, com Python instalado, execute na pasta do projeto:

```text
python -m http.server 8765 --bind 127.0.0.1 --directory dist
```

Abra http://127.0.0.1:8765. Use sempre o mesmo endereço e navegador para manter os dados da demonstração. O navegador pode separar o armazenamento entre um arquivo local e um endereço HTTP.

## Apresentação em 3 a 5 minutos

1. Explique o problema: entre consultas, exercícios e relatos de dor ficam dispersos.
2. Mostre o painel do fisioterapeuta, os pacientes e o catálogo de exercícios.
3. Em Pacientes, cadastre um paciente fictício. Em Prescrições, crie uma rotina diária para ele com início hoje e escolha exercícios.
4. No seletor superior, troque para “Visão do paciente”. Selecione o paciente que acabou de criar.
5. Abra Minha rotina, clique em Registrar, informe a dor, escreva um comentário e confirme a realização.
6. Mostre que o lembrete desapareceu para essa atividade e que o registro aparece no histórico.
7. Troque para a visão do fisioterapeuta, abra Evolução e selecione o paciente. Mostre o mesmo registro.
8. Envie uma mensagem na conversa de demonstração e alterne o perfil para mostrar os dois lados.
9. Finalize em Sobre o projeto: ODS 3, equipe e limites do protótipo.

## Funcionalidades

- Cadastro e atualização de pacientes, com bloqueio de e-mail repetido.
- Cadastro e atualização de exercícios com instruções, categoria e duração.
- Prescrição manual com datas e frequência diária ou segunda, quarta e sexta.
- Bloqueio de prescrições sobrepostas para o mesmo paciente e exercício.
- Encerramento da prescrição mantendo o histórico.
- Registro de conclusão, dor inteira entre 0 e 10 e comentário opcional.
- Bloqueio de registro repetido para a mesma atividade no mesmo dia.
- Gráfico de média diária de dor, diário e filtros de período.
- Lembretes internos apenas para atividades previstas e ainda pendentes.
- Conversa local entre os dois perfis simulados.
- Persistência no localStorage e restauração explícita dos exemplos.

## Limites e relação com os documentos

Esta entrega é um protótipo funcional da interface, e não o MVP completo descrito na documentação. RF02 a RF10 são demonstrados localmente, com simplificações: as mensagens e os lembretes são internos; não existe serviço externo ou comunicação entre dispositivos. RF01, autenticação, cadastro de profissionais, sessão segura e as garantias de segurança e privacidade para dados reais não estão implementados. A profissional Camila Oliveira é um perfil fictício fixo. Os seletores de perfil e paciente existem para facilitar a apresentação e não são controles de segurança.

Não há API REST, Spring Boot, JPA ou H2 nesta entrega. Essas tecnologias são previstas nos documentos para uma etapa posterior. Dados são salvos somente neste navegador; limpar o armazenamento os remove. Não use informações reais de pacientes. As instruções de exercícios são ilustrativas e não constituem prescrição clínica.

Os registros não são editáveis nem excluídos individualmente pela interface. O botão Restaurar dados da demonstração, com confirmação, substitui todos os dados locais pelos exemplos iniciais.

## Estrutura

- `dist/index.html`: página inicial e estrutura básica.
- `dist/styles.css`: identidade visual e adaptação a celular.
- `dist/app.js`: dados, telas, validações e armazenamento local.
- `tests/smoke.cjs`: verificações dos fluxos e regras locais, sem dependências externas.
- `.openai/hosting.json`: configuração da hospedagem Sites.

As fontes do Google Fonts são opcionais; sem internet, o site usa Arial. As funcionalidades funcionam sem dependências de rede ao abrir os arquivos locais.

Equipe: Amanda, Flavio, Kecia, Lohanne, Luísângel, Luiz, Marcus, Miguel, Uriel e Vinicius.
