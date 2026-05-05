import sys
from PIL import Image

def alpha_from_matte(rgb, matte, tolerance, softness):
    distance = max(abs(rgb[0] - matte[0]), abs(rgb[1] - matte[1]), abs(rgb[2] - matte[2]))
    if distance <= tolerance: return 0
    if distance >= tolerance + softness: return 255
    return int(round((distance - tolerance) * 255.0 / max(softness, 1)))

def process_logo():
    input_path = r'C:\Users\IFEANYI PC\Documents\OLPDF\olpdf-monorepo\apps\web\public\logo.png'
    try:
        img = Image.open(input_path).convert("RGBA")
        pixels = img.load()
        width, height = img.size
        # Infer matte color from the top left pixel (usually the background color)
        matte = img.getpixel((0,0))[:3]
        
        print(f"Detected matte background color: {matte}")
        
        # Apply the remove_matte algorithm
        for y in range(height):
            for x in range(width):
                r, g, b, a = pixels[x, y]
                alpha = alpha_from_matte((r,g,b), matte, 15, 40)
                if alpha == 0:
                    pixels[x, y] = (0,0,0,0)
                elif alpha < 255:
                    a_ratio = alpha / 255.0
                    rec_r = int(round((r - matte[0] * (1.0 - a_ratio)) / a_ratio))
                    rec_g = int(round((g - matte[1] * (1.0 - a_ratio)) / a_ratio))
                    rec_b = int(round((b - matte[2] * (1.0 - a_ratio)) / a_ratio))
                    pixels[x,y] = (min(max(rec_r,0),255), min(max(rec_g,0),255), min(max(rec_b,0),255), alpha)
                    
        # Trim to transparent bounds
        alpha_ch = img.getchannel("A")
        mask = alpha_ch.point(lambda v: 255 if v > 10 else 0)
        bbox = mask.getbbox()
        
        if bbox:
            img = img.crop(bbox)
            
            # The prompt says "remove the txt in it, i just need the icon".
            # The icon is typically a square or circle, and text is adjacent.
            # By cropping a square from the center of the image, we can usually isolate the emblem.
            w, h = img.size
            crop_size = min(w, h)
            left = (w - crop_size) // 2
            top = 0
            
            img = img.crop((left, top, left + crop_size, top + crop_size))
            
            # Save the processed image
            img.save(input_path)
            print("Logo successfully processed, background removed, and cropped to icon.")
        else:
            print("Image is empty after processing.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    process_logo()
