@echo off
echo ========================================
echo   KHOI DONG SERVER CARBOOK
echo ========================================
echo.

:: Kiem tra Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
  echo [LOI] Ban chua cai Node.js!
  echo Tai tai: https://nodejs.org
  pause
  exit /b 1
)

:: Cai packages neu chua co
if not exist "backend\node_modules" (
  echo Dang cai dat packages...
  cd backend
  npm install
  cd ..
)

:: Khoi dong server
echo [OK] Dang khoi dong server...
cd backend
node server.js
