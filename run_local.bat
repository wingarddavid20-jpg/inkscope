@echo off
echo ===========================================
echo   InkScope - Clean Start & Repair Script
echo ===========================================

echo 1. Stopping any background Node processes...
taskkill /F /IM node.exe >nul 2>&1

echo 2. Deleting patched node_modules, cache and lockfile...
if exist node_modules ( rmdir /s /q node_modules )
if exist .next ( rmdir /s /q .next )
if exist package-lock.json ( del /f /q package-lock.json )

echo 3. Installing clean dependencies from npm...
call npm install

echo 4. Launching Next.js dev server...
call npm run dev
