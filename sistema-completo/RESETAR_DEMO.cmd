@echo off
title Fisio Acompanha - resetar demonstracao
cd /d "%~dp0"
python iniciar.py --resetar
if errorlevel 1 pause
