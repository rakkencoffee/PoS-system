@echo off
title RAKKEN Print Bridge Startup
echo.
echo ========================================
echo   RAKKEN Coffee - Print Bridge Startup
echo ========================================
echo.

:: Wait 15 seconds for Bluetooth to initialize after Windows login
echo [1/3] Menunggu Bluetooth siap (15 detik)...
timeout /t 15 /nobreak >nul

:: Restart PM2 process to pick up fresh Bluetooth ports
echo [2/3] Merestart Print Bridge service...
cd /d "C:\Users\Dzaky Ahnaf\kerja\startfriday\pos-system\print-bridge"
call npx pm2 restart rakken-print-bridge --update-env 2>nul
if %errorlevel% neq 0 (
    echo    PM2 process not found, starting fresh...
    call npx pm2 start src/index.js --name "rakken-print-bridge"
    call npx pm2 save
)

:: Wait 5 seconds then check health
echo [3/3] Mengecek koneksi printer...
timeout /t 5 /nobreak >nul

:: Check health endpoint
curl -s http://localhost:3001/health 2>nul
echo.
echo.
echo ========================================
echo   Startup selesai!
echo   Auto-reconnect aktif jika printer
echo   belum terhubung.
echo   
echo   Cek status: http://localhost:3001/health
echo ========================================
echo.
pause
