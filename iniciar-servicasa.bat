@echo off
cd /d "%~dp0"
echo ================================================
echo    SERVICASA - SERVIDOR LOCAL
echo    Esta ventana ES el servidor. NO la cierres.
echo    Abri tu navegador en:  http://localhost:3000
echo ================================================
start "" cmd /c "timeout /t 4 /nobreak >nul & start http://localhost:3000"
:loop
npm run dev
echo.
echo    [ServiCasa] El servidor se detuvo. Reiniciando en 3 segundos...
timeout /t 3 /nobreak >nul
goto loop
