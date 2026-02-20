@echo off
REM Dashboard RSE - Mise à jour (double-clic pour lancer)
REM Ce fichier lance update.ps1 avec les bons droits PowerShell

powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0update.ps1"
