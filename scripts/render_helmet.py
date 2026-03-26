import asyncio
import base64
import os
from dotenv import load_dotenv
from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration

load_dotenv('/app/backend/.env')

async def generate_helmet_with_logo():
    api_key = os.environ.get('EMERGENT_LLM_KEY')
    
    if not api_key:
        print("ERROR: EMERGENT_LLM_KEY not found")
        return
    
    image_gen = OpenAIImageGeneration(api_key=api_key)
    
    # Detailed prompt to recreate the helmet with the new logo
    prompt = """Create a photorealistic image of a storm chaser wearing a black tactical helmet with a mounted GoPro camera on top. The helmet has a clear full-face visor with yellow tint. The person is a rugged middle-aged man with stubble, wearing a black tactical jacket.

On the side of the helmet, prominently display the "SkyStorm Data LLC" logo which consists of:
- A bold yellow/gold lightning bolt on the left side
- The text "SkyStorm" in large white italic letters with a metallic sheen
- Below it "DATA LLC" in bold black text on a dark background
- Golden radar sweep arc lines behind the text
- Below that "OHIO VALLEY STORMCHASING" in smaller yellow/gold text

The background shows a dramatic stormy sky with dark clouds and a lightning bolt in the distance. Rain droplets are visible on the helmet and visor. The lighting is moody and dramatic with warm orange/yellow tones from the sun breaking through the storm clouds."""

    print("Generating image... this may take up to 60 seconds...")
    
    try:
        images = await image_gen.generate_images(
            prompt=prompt,
            model="gpt-image-1",
            number_of_images=1
        )
        
        if images and len(images) > 0:
            output_path = "/app/output_helmet.png"
            with open(output_path, "wb") as f:
                f.write(images[0])
            print(f"SUCCESS! Image saved to: {output_path}")
        else:
            print("ERROR: No image was generated")
            
    except Exception as e:
        print(f"ERROR: {str(e)}")

if __name__ == "__main__":
    asyncio.run(generate_helmet_with_logo())
