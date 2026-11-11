@echo off
title Fisio Acompanha
cd /d "%~dp0"
where python >nul 2>nul || (echo Python nao encontrado. Instale o Python 3.11+ em https://www.python.org/downloads/ & pause & exit /b 1)
python iniciar.py
if errorlevel 1 pause
