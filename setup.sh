#!/bin/bash
# Quick Start Setup Script for BioSecure Login

echo "================================"
echo "BioSecure Login - Quick Setup"
echo "================================"
echo ""

# Check for Python
echo "Checking Python installation..."
python --version
if [ $? -ne 0 ]; then
    echo "❌ Python is not installed or not in PATH"
    echo "Please install Python 3.8+ from https://www.python.org/"
    exit 1
fi

# Check for FFmpeg
echo "Checking FFmpeg installation..."
ffmpeg -version > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "⚠️  FFmpeg is not installed or not in PATH"
    echo "Windows: choco install ffmpeg"
    echo "macOS: brew install ffmpeg"
    echo "Linux: sudo apt-get install ffmpeg"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Install Node dependencies
echo ""
echo "Installing Node.js dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install Node dependencies"
    exit 1
fi

# Install Python dependencies
echo ""
echo "Installing Python dependencies..."
pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "❌ Failed to install Python dependencies"
    exit 1
fi

# Run TypeScript check
echo ""
echo "Running TypeScript type checks..."
npm run check
if [ $? -ne 0 ]; then
    echo "⚠️  TypeScript check failed - but you can still try to run the app"
fi

# Build the project
echo ""
echo "Building the project..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Development: npm run dev"
echo "2. Production: npm start"
echo ""
echo "Access the app at: http://localhost:5173"
echo ""
