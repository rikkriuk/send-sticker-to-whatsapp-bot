@echo off
echo Installing Node.js dependencies...
npm install

echo Checking pip...
pip --version > nul 2>&1
if errorlevel 1 (
    echo pip not found! Please install Python from https://python.org and make sure to check "Add pip to PATH"
    pause
    exit
)

echo Installing Python dependencies...
pip install lottie==0.6.11 cairosvg Pillow rembg

echo Building project...
npm run build

echo Setup complete! Run 'npm run dev' to start.
pause