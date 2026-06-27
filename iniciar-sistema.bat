@echo off
title Kaptar Clone (Scrapper CRM) - Painel de Controle
color 0A

echo ========================================================
echo     INICIANDO O SEU CRM DE PROSPECCAO LOCAL
echo ========================================================
echo.

echo [1/3] Ligando o Motor do Scrapper (Backend)...
start "Backend (Scrapper API)" cmd /k "cd backend && node server.js"
timeout /t 2 /nobreak >nul

echo [2/3] Ligando a Interface do CRM (Frontend Vite)...
start "Frontend (CRM UI)" cmd /k "cd frontend && npm run dev"
timeout /t 3 /nobreak >nul

echo [3/3] Tudo pronto! Abrindo o sistema no navegador...
start http://localhost:5173

echo.
echo Pode minimizar esta janela. 
echo Feche os outros terminais quando quiser desligar o sistema.
pause >nul
