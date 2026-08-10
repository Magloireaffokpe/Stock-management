@echo off
setlocal
chcp 65001 > nul 2>&1
title MICROLOGIS - Arret Docker

for %%I in ("%~dp0..\..\..") do set "PROJECT_ROOT=%%~fI"
pushd "%PROJECT_ROOT%"

echo Arret des conteneurs MICROLOGIS...
docker compose down

popd
exit /b 0
