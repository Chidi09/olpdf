import io
from rembg import remove
from PIL import Image

def process_logo():
    input_path = r'C:\Users\IFEANYI PC\Documents\OLPDF\olpdf-monorepo\apps\web\public\logo.png'
    
    try:
        with open(input_path, 'rb') as i:
            input_data = i.read()
            
        # Remove background using rembg
        output_data = remove(input_data)
        
        # Open with Pillow to crop text
        img = Image.open(io.BytesIO(output_data)).convert("RGBA")
        
        # Find the bounding box of the non-transparent area
        bbox = img.getbbox()
        if bbox:
            img = img.crop(bbox)
            
            # Text from ChatGPT images is usually outside the central emblem.
            # We crop the central square to isolate the main icon.
            w, h = img.size
            crop_size = min(w, h)
            left = (w - crop_size) / 2
            top = (h - crop_size) / 2
            right = (w + crop_size) / 2
            bottom = (h + crop_size) / 2
            
            img = img.crop((left, top, right, bottom))
            
            # Recalculate bounding box to tighten the crop around the circular/main icon
            bbox2 = img.getbbox()
            if bbox2:
                img = img.crop(bbox2)
                
            img.save(input_path)
            print("Logo processed and saved successfully.")
        else:
            print("Image is empty after bg removal.")
    except Exception as e:
        print(f"Error processing logo: {e}")

process_logo()
