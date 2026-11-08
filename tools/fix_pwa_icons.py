"""ZIATA adaptive PWA icons — preserve the official emblem, remove white external padding.

Run at build time from GitHub Actions. Requires Pillow and existing ziata-logo.png.
No AI redraw: only resize, crop a rounded panel, and fill the exterior with navy.
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parent.parent
SOURCE=ROOT / "ziata-logo.png"
OUT=ROOT / "icons"
NAVY=(11,32,61,255)

def write_icon(size:int, scale:float, name:str)->None:
    original=Image.open(SOURCE).convert("RGBA")
    canvas=Image.new("RGBA",(size,size),NAVY)
    inside=round(size*scale)
    emblem=original.resize((inside,inside),Image.Resampling.LANCZOS)
    mask=Image.new("L",(inside,inside),0)
    d=ImageDraw.Draw(mask)
    ratio=inside/512
    # Keep the original gold outline and all lettering, eliminate the white
    # area outside the emblem's rounded gold outline.
    bounds=(round(5*ratio),round(7*ratio),
            inside-1-round(5*ratio),inside-1-round(5*ratio))
    d.rounded_rectangle(bounds,radius=round(116*ratio),fill=255)
    canvas.paste(emblem,((size-inside)//2,(size-inside)//2),mask)
    OUT.mkdir(parents=True,exist_ok=True)
    canvas.convert("RGB").save(OUT/name,optimize=True)

if __name__=="__main__":
    if not SOURCE.exists():
        raise SystemExit("ziata-logo.png not found in the repository root")
    write_icon(192,.90,"icon-192.png")
    write_icon(512,.90,"icon-512.png")
    write_icon(512,.88,"icon-maskable-512.png")
    print("ZIATA icons regenerated with solid navy full-bleed padding.")
