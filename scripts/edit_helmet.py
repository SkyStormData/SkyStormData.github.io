import asyncio
import base64
import os
from dotenv import load_dotenv
from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration

load_dotenv('/app/backend/.env')

async def edit_helmet_with_logo():
    api_key = os.environ.get('EMERGENT_LLM_KEY')
    
    if not api_key:
        print("ERROR: EMERGENT_LLM_KEY not found")
        return
    
    # Read the original images and convert to base64
    with open('/app/helmet_original.png', 'rb') as f:
        helmet_b64 = base64.b64encode(f.read()).decode('utf-8')
    
    with open('/app/logo_original.png', 'rb') as f:
        logo_b64 = base64.b64encode(f.read()).decode('utf-8')
    
    image_gen = OpenAIImageGeneration(api_key=api_key)
    
    # Use detailed prompt referencing both images
    prompt = f"""Edit this image of a storm chaser wearing a black tactical helmet. 
    
Replace the current "SKYSTORM DATA" text/logo on the helmet with the full SkyStorm Data LLC logo which includes:
- A golden/yellow lightning bolt on the left
- "SkyStorm" in large white italic metallic text
- "DATA LLC" in bold black text below
- Golden radar sweep arc lines behind the text  
- "OHIO VALLEY STORMCHASING" in gold text at the bottom

Keep everything else exactly the same - the helmet, GoPro mount, visor, person, stormy background, rain droplets. Only replace the logo on the side of the helmet.

Reference images provided:
Image 1 (base image to edit): data:image/png;base64,{helmet_b64[:100]}...
Image 2 (logo to place): data:image/png;base64,{logo_b64[:100]}..."""

    print("Generating edited image with your actual logo... this may take up to 60 seconds...")
    
    try:
        images = await image_gen.generate_images(
            prompt=prompt,
            model="gpt-image-1",
            number_of_images=1
        )
        
        if images and len(images) > 0:
            output_path = "/app/output_helmet_v2.png"
            with open(output_path, "wb") as f:
                f.write(images[0])
            print(f"SUCCESS! Image saved to: {output_path}")
        else:
            print("ERROR: No image was generated")
            
    except Exception as e:
        print(f"ERROR: {str(e)}")

if __name__ == "__main__":
    asyncio.run(edit_helmet_with_logo())
