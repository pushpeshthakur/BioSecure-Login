@echo off
REM Quick Start Setup Script for BioSecure Login (Windows)

echo ================================
echo BioSecure Login - Quick Setup
echo ================================
echo.

REM Check for Python
echo Checking Python installation...
python --version >nul 2>&1
if errorlevel 1 (
    echo [!] Python is not installed or not in PATH
    echo Please install Python 3.8+ from https://www.python.org/
    pause
    exit /b 1
)

REM Check for FFmpeg
echo Checking FFmpeg installation...
ffmpeg -version >nul 2>&1
if errorlevel 1 (
    echo [!] FFmpeg is not installed or not in PATH
    echo Windows: choco install ffmpeg
    echo macOS: brew install ffmpeg
    echo Linux: sudo apt-get install ffmpeg
    set /p CONTINUE="Continue anyway? (y/n): "
    if /i not "%CONTINUE%"=="y" (
        exit /b 1
    )
)

REM Install Node dependencies
echo.
echo Installing Node.js dependencies...
call npm install
if errorlevel 1 (
    echo [!] Failed to install Node dependencies
    pause
    exit /b 1
)

REM Install Python dependencies
echo.
echo Installing Python dependencies...
call pip install -r requirements.txt
if errorlevel 1 (
    echo [!] Failed to install Python dependencies
    pause
    exit /b 1
)

REM Run TypeScript check
echo.
echo Running TypeScript type checks...
call npm run check
if errorlevel 1 (
    echo [!] TypeScript check failed - but you can still try to run the app
)

REM Build the project
echo.
echo Building the project...
call npm run build
if errorlevel 1 (
    echo [!] Build failed
    pause
    exit /b 1
)

echo.
echo [+] Setup complete!
echo.
echo Next steps:
echo 1. Development: npm run dev
echo 2. Production: npm start
echo.
echo Access the app at: http://localhost:5173
echo.
pause
