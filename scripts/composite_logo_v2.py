from PIL import Image, ImageEnhance, ImageFilter
import numpy as np

def create_realistic_helmet_logo():
    # Load images
    helmet = Image.open('/app/helmet_original.png').convert('RGBA')
    logo = Image.open('/app/logo_original.png').convert('RGBA')
    
    print(f"Helmet size: {helmet.size}")
    print(f"Logo size: {logo.size}")
    
    # Extract just the logo elements (remove dark background)
    # The logo has a dark stormy background - we want to extract the text/lightning
    logo_data = np.array(logo)
    
    # Create mask for the bright elements (logo text, lightning, etc)
    # The logo elements are brighter than the dark storm background
    r, g, b, a = logo_data[:,:,0], logo_data[:,:,1], logo_data[:,:,2], logo_data[:,:,3]
    
    # Brightness calculation
    brightness = (r.astype(float) + g.astype(float) + b.astype(float)) / 3
    
    # Create alpha mask - keep bright elements, fade dark background
    # Logo text is white/gold, background is dark
    mask = np.clip((brightness - 40) * 3, 0, 255).astype(np.uint8)
    
    # Apply mask to alpha channel
    logo_data[:,:,3] = mask
    
    logo_masked = Image.fromarray(logo_data)
    
    # Resize logo to fit on helmet
    logo_width = 280
    aspect_ratio = logo_masked.height / logo_masked.width
    logo_height = int(logo_width * aspect_ratio)
    logo_resized = logo_masked.resize((logo_width, logo_height), Image.LANCZOS)
    
    # Position on helmet where the original text is
    x_position = 565
    y_position = 260
    
    # Create result
    result = helmet.copy()
    
    # Paste with transparency
    result.paste(logo_resized, (x_position, y_position), logo_resized)
    
    # Save
    output_path = '/app/helmet_with_logo_v2.png'
    result.save(output_path, 'PNG')
    print(f"SUCCESS! Saved to: {output_path}")

if __name__ == "__main__":
    create_realistic_helmet_logo()
