@echo off
set "JAVA_HOME=C:\Program Files\Amazon Corretto\jdk17.0.21_0"
set "PATH=%JAVA_HOME%\bin;%PATH%"
cd /d "%~dp0android"
call gradlew.bat assembleDebug --no-daemon
