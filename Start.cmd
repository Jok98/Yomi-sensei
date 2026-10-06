@echo off
setlocal
cd /d "%~dp0"
if exist "release\maia\win-unpacked\Yomi Sensei.exe" (
  start "" "release\maia\win-unpacked\Yomi Sensei.exe"
  exit /b 0
)
if exist "release\win-unpacked\Yomi Sensei.exe" (
  start "" "release\win-unpacked\Yomi Sensei.exe"
  exit /b 0
)
where pnpm >nul 2>nul
if errorlevel 1 (
  echo Per compilare servono Node.js 22.12+ e pnpm 11. Vedi README.md.
  pause
  exit /b 1
)
if not exist node_modules (
  call pnpm install --frozen-lockfile
  if errorlevel 1 exit /b 1
)
if not exist ".venv\Scripts\python.exe" (
  call pnpm prepare:runtime
  if errorlevel 1 exit /b 1
)
if not exist ".runtime\stockfish\release.json" (
  call pnpm prepare:runtime
  if errorlevel 1 exit /b 1
)
if not exist ".runtime\maia\runtime.json" (
  call pnpm prepare:runtime
  if errorlevel 1 exit /b 1
)
if not exist ".venv-maia\Scripts\python.exe" (
  call pnpm prepare:runtime
  if errorlevel 1 exit /b 1
)
call pnpm build
if errorlevel 1 exit /b 1
call pnpm start
