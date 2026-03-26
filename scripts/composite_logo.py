from PIL import Image
import os

def composite_logo_on_helmet():
    # Load images
    helmet = Image.open('/app/helmet_original.png').convert('RGBA')
    logo = Image.open('/app/logo_original.png').convert('RGBA')
    
    print(f"Helmet size: {helmet.size}")
    print(f"Logo size: {logo.size}")
    
    # Resize logo to fit on helmet - make it appropriately sized
    # The logo should be about 280px wide to fit nicely on the helmet
    logo_width = 320
    aspect_ratio = logo.height / logo.width
    logo_height = int(logo_width * aspect_ratio)
    logo_resized = logo.resize((logo_width, logo_height), Image.LANCZOS)
    
    print(f"Resized logo: {logo_resized.size}")
    
    # Position for the logo on the helmet (where current text is)
    # Looking at the image, the text is roughly at x=580, y=280
    x_position = 540
    y_position = 220
    
    # Create a copy of helmet to work with
    result = helmet.copy()
    
    # Paste the logo with transparency
    result.paste(logo_resized, (x_position, y_position), logo_resized)
    
    # Save result
    output_path = '/app/helmet_with_logo.png'
    result.save(output_path, 'PNG')
    print(f"SUCCESS! Saved to: {output_path}")
    
    return output_path

if __name__ == "__main__":
    composite_logo_on_helmet()
