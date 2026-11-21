@echo off
chcp 65001 >nul
cd /d "%~dp0."
set "PY="
py -3 --version >nul 2>nul && set "PY=py -3"
if not defined PY (
  python --version >nul 2>nul && set "PY=python"
)
if not defined PY (
  echo 未找到 Python，请先安装 Python 3.10 或以上版本。
  pause
  exit /b 1
)
%PY% browser_app.py %*
if errorlevel 1 pause
