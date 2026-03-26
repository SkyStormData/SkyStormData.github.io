from PIL import Image, ImageEnhance
import numpy as np

def composite_on_blank_helmet():
    # Load the blank helmet and your logo
    helmet = Image.open('/app/helmet_blank.png').convert('RGBA')
    logo = Image.open('/app/logo_original.png').convert('RGBA')
    
    print(f"Helmet size: {helmet.size}")
    print(f"Logo size: {logo.size}")
    
    # Extract logo elements (remove dark background)
    logo_data = np.array(logo)
    r, g, b, a = logo_data[:,:,0], logo_data[:,:,1], logo_data[:,:,2], logo_data[:,:,3]
    
    # Calculate brightness
    brightness = (r.astype(float) + g.astype(float) + b.astype(float)) / 3
    
    # Create alpha mask - keep bright elements (text, lightning, arcs)
    mask = np.clip((brightness - 50) * 4, 0, 255).astype(np.uint8)
    logo_data[:,:,3] = mask
    
    logo_masked = Image.fromarray(logo_data)
    
    # Resize logo for helmet
    logo_width = 300
    aspect_ratio = logo_masked.height / logo_masked.width
    logo_height = int(logo_width * aspect_ratio)
    logo_resized = logo_masked.resize((logo_width, logo_height), Image.LANCZOS)
    
    # Reduce opacity slightly for more realistic look
    logo_resized = logo_resized.copy()
    logo_data_resized = np.array(logo_resized)
    logo_data_resized[:,:,3] = (logo_data_resized[:,:,3] * 0.9).astype(np.uint8)
    logo_resized = Image.fromarray(logo_data_resized)
    
    # Position - adjust based on generated image
    # Typical helmet logo position is upper right side
    x_position = helmet.width // 2 + 50
    y_position = int(helmet.height * 0.18)
    
    # Create result
    result = helmet.copy()
    result.paste(logo_resized, (x_position, y_position), logo_resized)
    
    # Save
    output_path = '/app/helmet_final.png'
    result.save(output_path, 'PNG')
    print(f"SUCCESS! Final image saved to: {output_path}")

if __name__ == "__main__":
    composite_on_blank_helmet()
