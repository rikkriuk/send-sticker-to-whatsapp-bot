import sys
from rembg import remove
from PIL import Image
import io

input_data = sys.stdin.buffer.read()
output_data = remove(input_data)
sys.stdout.buffer.write(output_data)