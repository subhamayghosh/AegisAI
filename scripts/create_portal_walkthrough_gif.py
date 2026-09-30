"""Create a compact, privacy-redacted portal walkthrough GIF from a dashboard screenshot.

Usage:
    python scripts/create_portal_walkthrough_gif.py INPUT.png docs/assets/portal-walkthrough.gif
    python scripts/create_portal_walkthrough_gif.py --viewport INPUT.png docs/assets/portal-walkthrough.gif
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def rounded_box(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], color: tuple[int, int, int, int]) -> None:
    draw.rounded_rectangle(box, radius=14, outline=color, width=5)


def frame_for(base: Image.Image, box: tuple[int, int, int, int], caption: str) -> Image.Image:
    frame = base.copy().convert("RGBA")
    draw = ImageDraw.Draw(frame, "RGBA")
    rounded_box(draw, box, (34, 211, 238, 245))
    footer = (24, frame.height - 72, frame.width - 24, frame.height - 24)
    draw.rounded_rectangle(footer, radius=14, fill=(15, 23, 49, 225))
    draw.text((footer[0] + 18, footer[1] + 16), caption, fill=(255, 255, 255, 255), font=ImageFont.load_default())
    return frame.convert("P", palette=Image.Palette.ADAPTIVE)


def main(source: Path, output: Path, *, viewport: bool = False) -> None:
    original = Image.open(source).convert("RGBA")
    # Keep only the app viewport; browser tabs, bookmarks, and the taskbar
    # belong to the capture environment rather than the product walkthrough.
    crop_top = 0 if viewport else round(original.height * 0.13)
    crop_bottom = original.height if viewport else round(original.height * 0.94)
    image = original.crop((0, crop_top, original.width, crop_bottom))
    image.thumbnail((960, 500), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (960, 540), (8, 15, 35, 255))
    offset = ((canvas.width - image.width) // 2, (canvas.height - image.height) // 2)
    canvas.alpha_composite(image, offset)

    # The supplied demo screenshot includes an account chip. Replace it with
    # a neutral label before committing the public documentation asset.
    draw = ImageDraw.Draw(canvas, "RGBA")
    scale = image.width / (original.width or 1)
    if viewport:
        account_left = round(original.width * 0.77 * scale) + offset[0]
        account_top = round(original.height * 0.018 * scale) + offset[1]
        account_right = round(original.width * 0.97 * scale) + offset[0]
        account_bottom = round(original.height * 0.08 * scale) + offset[1]
    else:
        account_left = round(1325 * scale) + offset[0]
        account_top = round((154 - crop_top) * scale) + offset[1]
        account_right = round(1495 * scale) + offset[0]
        account_bottom = round((190 - crop_top) * scale) + offset[1]
    draw.rounded_rectangle((account_left, account_top, account_right, account_bottom), radius=8, fill=(238, 242, 255, 255))
    draw.text((account_left + 9, account_top + 8), "Demo admin", fill=(30, 41, 59, 255), font=ImageFont.load_default())

    if viewport:
        frames = [
            frame_for(canvas, (35, 62, 875, 180), "Dashboard: monitor protection at a glance"),
            frame_for(canvas, (35, 288, 620, 510), "Live events: see each ALLOW, NEUTRALIZE, or BLOCK decision"),
            frame_for(canvas, (625, 288, 875, 468), "Coverage and sessions: trace attack types and suspicious conversations"),
        ]
    else:
        frames = [
            frame_for(canvas, (218, 112, 733, 168), "Dashboard: monitor protection at a glance"),
            frame_for(canvas, (218, 235, 564, 510), "Live events: see each ALLOW, NEUTRALIZE, or BLOCK decision"),
            frame_for(canvas, (574, 235, 733, 468), "Coverage and sessions: trace attack types and suspicious conversations"),
        ]
    output.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(output, save_all=True, append_images=frames[1:], duration=[1400, 1600, 1600], loop=0, optimize=True)


if __name__ == "__main__":
    args = sys.argv[1:]
    viewport = args[:1] == ["--viewport"]
    if viewport:
        args = args[1:]
    if len(args) != 2:
        raise SystemExit("Usage: create_portal_walkthrough_gif.py [--viewport] INPUT.png OUTPUT.gif")
    main(Path(args[0]), Path(args[1]), viewport=viewport)
