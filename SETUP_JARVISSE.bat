@echo off
title JARVISSE INITIALIZATION...
color 0b

echo ============================================================
echo         STARK INDUSTRIES - JARVISSE DEPLOYMENT
echo ============================================================
echo.
echo [1/3] Initialisation du Cerveau (API)...
start cmd /k "node api/index.js"

timeout /t 2 >nul

echo [2/3] Activation de l'Agent de Liaison Local...
start cmd /k "node agent_jarvis.js"

timeout /t 2 >nul

echo [3/3] Deploiement de l'Interface HUD...
start cmd /k "npm run dev"

echo.
echo ============================================================
echo   PROTOCOLES ACTIFS. ACCESSEZ : http://localhost:5173
echo ============================================================
echo.
pause
