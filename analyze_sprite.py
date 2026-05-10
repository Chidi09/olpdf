from PIL import Image

def analyze_frames():
    try:
        img_path = r"C:\Users\IFEANYI PC\Downloads\Gemini_Generated_Image_c00urnc00urnc00u.png"
        img = Image.open(img_path).convert("RGBA")
        width, height = img.size
        pixels = img.load()
        
        # Determine background color based on top-left pixel
        bg_r, bg_g, bg_b, bg_a = pixels[0, 0]
        
        def is_bg(r, g, b, a):
            # Transparent
            if a < 10: return True
            # Match top-left background color
            if abs(r - bg_r) < 10 and abs(g - bg_g) < 10 and abs(b - bg_b) < 10: return True
            # Pure white (common for generated images)
            if r > 245 and g > 245 and b > 245: return True
            return False

        row_empty = [True] * height
        col_empty = [True] * width

        for y in range(height):
            for x in range(width):
                if not is_bg(*pixels[x, y]):
                    row_empty[y] = False
                    col_empty[x] = False

        def get_intervals(empty_list):
            intervals = []
            in_content = False
            start = 0
            for i, empty in enumerate(empty_list):
                if not empty and not in_content:
                    in_content = True
                    start = i
                elif empty and in_content:
                    # Require at least some pixels gap to not split on small noise
                    in_content = False
                    intervals.append((start, i))
            if in_content:
                intervals.append((start, len(empty_list)))
            return intervals

        row_intervals = get_intervals(row_empty)
        col_intervals = get_intervals(col_empty)

        print(f"Image Size: {width}x{height}")
        print(f"Found {len(col_intervals)} columns of content.")
        print(f"Found {len(row_intervals)} rows of content.")
        print(f"Col boundaries: {col_intervals}")
        print(f"Row boundaries: {row_intervals}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    analyze_frames()
