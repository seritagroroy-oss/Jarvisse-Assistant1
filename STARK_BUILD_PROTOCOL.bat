@echo off
title JARVISSE - PROTOCOLE DE CONSTRUCTION TACTIQUE
cd /d "%~dp0"
color 0B
mode con: cols=80 lines=30

:MENU
cls
echo.
echo    ========================================================================
echo    ^|                                                                      ^|
echo    ^|                JARVISSE - CENTRE DE COMMANDE TACTIQUE                ^|
echo    ^|                    PROTOCOL DE DEPLOIEMENT STARK                     ^|
echo    ^|                                                                      ^|
echo    ========================================================================
echo.
echo    [1] INITIALISER LES SYSTEMES (npm install)
echo    [2] CONSTRUCTION DU LOGICIEL WINDOWS (Generer EXE)
echo    [3] PREPARATION DE L'APPLICATION ANDROID (Sync APK)
echo    [4] NETTOYAGE DES ARCHIVES (Clean Dist)
echo    [5] SORTIR DU PROTOCOLE
echo.
echo    ========================================================================
set /p choice=   CHOISISSEZ VOTRE DIRECTIVE, MONSIEUR ROY (1-5) : 

if "%choice%"=="1" goto INSTALL
if "%choice%"=="2" goto EXE
if "%choice%"=="3" goto APK
if "%choice%"=="4" goto CLEAN
if "%choice%"=="5" exit
goto MENU

:INSTALL
echo.
echo    [ SYSTEME ] Initialisation des paquets npm...
call npm install
echo    [ SYSTEME ] Initialisation terminee.
pause
goto MENU

:EXE
echo.
echo    [ SYSTEME ] Debut de la construction du logiciel EXE...
call npm run build
call npm run electron:build
echo.
echo    [ SYSTEME ] Logiciel genere dans le dossier 'dist' ou 'dist_electron'.
pause
goto MENU

:APK
echo.
echo    [ SYSTEME ] Synchronisation du protocole Android...
call npm run build
call npx cap add android
call npx cap sync
echo.
echo    [ SYSTEME ] Veuillez ouvrir Android Studio pour compiler l'APK final.
pause
goto MENU

:CLEAN
echo.
echo    [ SYSTEME ] Nettoyage du cache et des archives...
if exist dist rd /s /q dist
if exist dist_electron rd /s /q dist_electron
echo    [ SYSTEME ] Nettoyage termine.
pause
goto MENU
