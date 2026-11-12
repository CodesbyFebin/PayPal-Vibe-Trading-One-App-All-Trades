from PIL import Image, ImageDraw, ImageFont
import os
os.makedirs("gifs", exist_ok=True)
W,H=640,360
def make(name, text, frames=50):
    imgs=[]
    for i in range(frames):
        im=Image.new("RGB",(W,H),(0,48,135))
        d=ImageDraw.Draw(im)
        d.ellipse([280+i*0.5,80,360+i*0.5,160], fill=(255,196,57))
        d.rectangle([0,300,W,360], fill=(255,196,57))
        d.text((40,40), text, fill=(255,255,255))
        d.text((40,140), f"Frame {i+1}/{frames} - Vibe It in 3 taps", fill=(255,255,255))
        d.text((40,310), "【entity-PayPal¦canonical_name=PayPal】 Vibe Trading - One App. All Trades.", fill=(0,48,135))
        imgs.append(im)
    imgs[0].save(f"gifs/{name}", save_all=True, append_images=imgs[1:], duration=100, loop=0)
    print(name, "done")
make("vibe-mascot.gif","【entity-PAYPAL¦canonical_name=PayPal】 VIBE - MASCOT")
make("vibe-abstract.gif","VIBE ABSTRACT")
make("vibe-storyboard.gif","STORYBOARD - Vibe It")
make("vibe-final-promo.gif","FINAL PROMO - $1 Start")
make("vibe-slow-loop.gif","SLOW LOOP - SIP + UPI")
