#!/bin/bash

echo "📦 Installing Node.js dependencies..."
npm install

echo "🐍 Checking Python & pip3..."
if ! command -v pip3 &> /dev/null; then
    echo "pip3 not found, installing..."
    sudo apt update && sudo apt install python3-pip -y
fi

echo "🐍 Installing Python dependencies..."
pip3 install lottie==0.6.11 cairosvg Pillow rembg

echo "🔨 Building project..."
npm run build

echo "✅ Setup complete! Run 'npm run dev' to start."