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
original_fps = anim.frame_rate
target_fps = 24
total_frames = int(anim.out_point - anim.in_point)

step = original_fps / target_fps
frames_to_render = [int(i * step) for i in range(int(total_frames / step))]

for idx, frame_num in enumerate(frames_to_render):
    frame_path = os.path.join(output_dir, f"frame_{idx:04d}.png")
    export_png(anim, frame_path, frame=frame_num, dpi=72)

print(f"OK:{len(frames_to_render)}:{target_fps}")