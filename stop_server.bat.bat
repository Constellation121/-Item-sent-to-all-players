@echo off
echo Fechando o servidor Node.js especifico...
for /f "tokens=2 delims= " %%a in ('tasklist /fi "imagename eq node.exe" /v ^| findstr /i "server.js"') do taskkill /F /PID %%a
echo Servidor encerrado.
pause
