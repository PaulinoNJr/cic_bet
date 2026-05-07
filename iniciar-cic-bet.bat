@echo off
setlocal

title CIC Bet Arena
cd /d "%~dp0"

echo ==========================================
echo   CIC Bet Arena - Start Local
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado no PATH.
  echo Instale o Node.js 24+ e tente novamente.
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERRO] npm nao encontrado no PATH.
  echo Reinstale o Node.js com o npm habilitado.
  echo.
  pause
  exit /b 1
)

if not exist ".env" (
  if exist ".env.example" (
    echo [INFO] Arquivo .env nao encontrado. Copiando de .env.example...
    copy /y ".env.example" ".env" >nul
  ) else (
    echo [ERRO] Nem .env nem .env.example foram encontrados.
    echo.
    pause
    exit /b 1
  )
)

echo [INFO] Validando sintaxe do projeto...
call npm run check
if errorlevel 1 (
  echo.
  echo [ERRO] A validacao falhou. Corrija os arquivos antes de iniciar.
  echo.
  pause
  exit /b 1
)

echo.
echo [INFO] Abrindo a aplicacao em http://localhost:3000
start "" cmd /c "timeout /t 3 >nul && start http://localhost:3000"

echo.
echo [INFO] Iniciando servidor local com SQLite...
call npm run dev

echo.
echo [INFO] Servidor encerrado.
pause
exit /b 0
