from PIL import Image
import sys

def remove_background(image_path):
    img = Image.open(image_path).convert("RGBA")
    data = img.getdata()

    new_data = []
    for item in data:
        r, g, b, a = item
        # If it's grey/white checkerboard, r~=g~=b. Eel is blue.
        if a > 0 and abs(r - g) < 25 and abs(g - b) < 25 and r > 120:
            new_data.append((255, 255, 255, 0))
        else:
            new_data.append(item)

    img.putdata(new_data)
    img.save(image_path, "PNG")
    print(f"Processed {image_path}")

if __name__ == "__main__":
    remove_background('public/assets/enemy.png')