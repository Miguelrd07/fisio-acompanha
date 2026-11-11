"""Gera fisio-web.html: frontend + servidor simulado num único arquivo."""
from pathlib import Path
import json, re, sys

SRC = Path(sys.argv[1])
HERE = Path(__file__).parent
index = (SRC / 'public/index.html').read_text(encoding='utf-8')
css = (SRC / 'public/styles.css').read_text(encoding='utf-8')
app = (SRC / 'public/app.js').read_text(encoding='utf-8')
seed = json.loads((SRC / 'seed.json').read_text(encoding='utf-8'))
mock = (HERE / 'mock.js').read_text(encoding='utf-8').replace('__SEED__', json.dumps(seed, ensure_ascii=False))

app = app.replace('Documentação em /docs.', 'Nesta versão online, um servidor simulado roda no próprio navegador.')
app = app.replace('Verifique se a janela do sistema está aberta.', 'Recarregue a página.')

head = re.search(r'<head>(.*?)</head>', index, re.S).group(1)
body = re.search(r'<body>(.*?)</body>', index, re.S).group(1)
head = re.sub(r'\s*<meta charset[^>]*>|\s*<meta name="viewport"[^>]*>', '', head)
head = head.replace('<link rel="stylesheet" href="styles.css">', f'<style>\n{css}\n</style>')
head = head.replace('<script src="app.js" defer></script>', '')
title = re.search(r'\s*<title>.*?</title>', head).group(0)
head = head.replace(title, '')
out = f"{title.strip()}\n{head.strip()}\n{body.strip()}\n<script>\n{mock}\n</script>\n<script>\n{app}\n</script>\n"
(HERE / 'fisio-web.html').write_text(out, encoding='utf-8')
print(len(out) // 1024, 'KB')
