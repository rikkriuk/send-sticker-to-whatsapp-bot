#!/bin/bash
# deploy.sh

echo "🚀 Deploying..."

git pull origin main

echo "📦 Installing dependencies..."
npm install

echo "🔨 Building..."
npm run build

mkdir -p dist/scripts && cp src/scripts/remove_bg.py dist/scripts/

echo "♻️ Restarting bot..."
pm2 restart wa-bot

echo "✅ Deploy selesai!"
