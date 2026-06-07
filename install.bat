@echo off
echo Installing Node.js dependencies...
npm install

echo Installing Python dependencies...
pip install lottie cairosvg Pillow rembg

echo Building project...
npm run build

echo Setup complete! Run 'npm run dev' to start.
pause