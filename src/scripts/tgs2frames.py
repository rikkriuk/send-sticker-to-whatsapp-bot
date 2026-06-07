import sys
import os
import gzip
import json
import lottie
from lottie.exporters.cairo import export_png

tgs_path = sys.argv[1]
output_dir = sys.argv[2]

with gzip.open(tgs_path, 'rb') as f:
    data = json.loads(f.read())

anim = lottie.objects.Animation.load(data)
total_frames = int(anim.out_point - anim.in_point)

for i in range(total_frames):
    frame_path = os.path.join(output_dir, f"frame_{i:04d}.png")
    export_png(anim, frame_path, frame=i, dpi=96)

print(f"OK:{total_frames}:{anim.frame_rate}")
