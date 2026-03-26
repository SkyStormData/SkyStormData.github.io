import asyncio
import base64
import os
from dotenv import load_dotenv
from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration

load_dotenv('/app/backend/.env')

async def generate_blank_helmet():
    api_key = os.environ.get('EMERGENT_LLM_KEY')
    
    image_gen = OpenAIImageGeneration(api_key=api_key)
    
    # Generate a clean helmet with NO logo - matching the original image
    prompt = """Create a photorealistic portrait image of a storm chaser wearing a black tactical helmet.

Key details:
- Black matte tactical/military style helmet with tactical rails and mounting points
- GoPro action camera mounted on top of the helmet
- Full face visor/shield with yellow/amber tint, covered in rain droplets
- The helmet should be COMPLETELY PLAIN with NO logos, NO text, NO branding - just clean black surface
- Black tactical ear protection/communication headset attached
- The person is a rugged middle-aged Caucasian man with stubble/light beard, serious expression, looking to the left
- Wearing black tactical jacket/gear
- Background: dramatic stormy sky with dark clouds, lightning bolt visible in the distance on the left
- Moody dramatic lighting with warm orange/golden tones
- Rain droplets on helmet and visor
- Professional photo quality, sharp focus

IMPORTANT: The helmet must have NO text, NO logos, NO writing whatsoever - completely blank black surface."""

    print("Generating clean helmet image... this may take 60 seconds...")
    
    try:
        images = await image_gen.generate_images(
            prompt=prompt,
            model="gpt-image-1",
            number_of_images=1
        )
        
        if images and len(images) > 0:
            output_path = "/app/helmet_blank.png"
            with open(output_path, "wb") as f:
                f.write(images[0])
            print(f"SUCCESS! Blank helmet saved to: {output_path}")
        else:
            print("ERROR: No image was generated")
            
    except Exception as e:
        print(f"ERROR: {str(e)}")

if __name__ == "__main__":
    asyncio.run(generate_blank_helmet())
