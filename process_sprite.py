from PIL import Image

def smart_crop():
    try:
        img_path = r"C:\Users\IFEANYI PC\Downloads\Gemini_Generated_Image_c00urnc00urnc00u.png"
        img = Image.open(img_path).convert("RGBA")
        width, height = img.size
        
        # We need a 4x5 grid (20 frames). The CSS expects a 360x450 image (4 cols x 90px, 5 rows x 90px).
        # We only strictly need 4 rows for the CSS (Idle = Row 0, Wave = Row 3).
        # Let's see how many frames are in the original image.
        # If it's a 4x4 grid:
        # Cell width = width / 4, Cell height = height / 4
        # We will extract the center square from each cell.
        
        cols = 4
        rows = 4
        
        cell_w = width // cols
        cell_h = height // rows
        
        # We want square frames. 
        square_size = min(cell_w, cell_h)
        
        # Create a new blank canvas for the output sprite sheet (360x450)
        # We will just fill a 4x4 grid (360x360), the 5th row will be blank.
        out_img = Image.new("RGBA", (360, 450), (255, 255, 255, 0))
        
        for r in range(rows):
            for c in range(cols):
                # Calculate cell bounding box
                left = c * cell_w
                top = r * cell_h
                
                # Find the center of the cell
                center_x = left + (cell_w // 2)
                center_y = top + (cell_h // 2)
                
                # Crop a perfect square from the center of the cell
                crop_left = center_x - (square_size // 2)
                crop_top = center_y - (square_size // 2)
                crop_right = center_x + (square_size // 2)
                crop_bottom = center_y + (square_size // 2)
                
                frame = img.crop((crop_left, crop_top, crop_right, crop_bottom))
                
                # Resize the square frame to 90x90
                frame = frame.resize((90, 90), Image.Resampling.LANCZOS)
                
                # Paste into the output sprite sheet
                out_x = c * 90
                out_y = r * 90
                out_img.paste(frame, (out_x, out_y))
                
        out_path = r"C:\Users\IFEANYI PC\Documents\OLPDF\olpdf-monorepo\apps\web\public\watermarked_img_14898494713393997498.png"
        out_img.save(out_path)
        print(f"Successfully smart-cropped and saved to {out_path}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    smart_crop()
