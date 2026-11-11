#!/bin/sh
# Mac/Linux: inicia o Fisio Acompanha (precisa do Python 3.11+). Uso: sh iniciar.sh [--resetar]
cd "$(dirname "$0")" || exit 1
command -v python3 >/dev/null 2>&1 || { echo "Python 3 nao encontrado. Instale em https://www.python.org/downloads/"; exit 1; }
exec python3 iniciar.py "$@"
