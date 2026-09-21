async function generateImage(prompt) {
    const hfToken = process.env.HUGGINGFACE_API_KEY;

    // 1. Primary: Hugging Face (Stable Diffusion 3 Medium)
    if (hfToken) {
        try {
            console.log(`🎨 [HuggingFace] Generating image for prompt: "${prompt}"...`);
            const hfUrl = 'https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-3-medium-diffusers';
            const response = await fetch(hfUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${hfToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ inputs: prompt }),
                signal: AbortSignal.timeout(30000)
            });

            if (response.ok) {
                const buffer = Buffer.from(await response.arrayBuffer());
                console.log(`✅ [HuggingFace] Image generated successfully (${buffer.length} bytes)`);
                return {
                    buffer,
                    provider: 'Hugging Face (SD3 Medium)'
                };
            } else {
                const errText = await response.text();
                console.warn(`HuggingFace returned ${response.status}:`, errText.slice(0, 120));
            }
        } catch (hfErr) {
            console.warn(`HuggingFace generation failed:`, hfErr.message);
        }
    }

    // 2. Secondary Fallback: Pollinations (Turbo / Flux / Standard)
    console.log(`🎨 [Pollinations Fallback] Generating image...`);
    const encodedPrompt = encodeURIComponent(prompt);
    const models = ['turbo', 'flux', ''];

    for (const model of models) {
        try {
            const modelParam = model ? `&model=${model}` : '';
            const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=768&height=768&nologo=true&seed=${Date.now()}${modelParam}`;
            const res = await fetch(url, { signal: AbortSignal.timeout(35000) });
            if (res.ok) {
                const buffer = Buffer.from(await res.arrayBuffer());
                const modelName = model || 'default';
                console.log(`✅ [Pollinations] Image generated successfully via ${modelName}`);
                return {
                    buffer,
                    provider: `Pollinations (${modelName})`
                };
            }
        } catch (e) {
            console.log(`Pollinations model ${model || 'default'} failed: ${e.message}`);
        }
    }

    throw new Error("Unable to generate image with available providers.");
}

module.exports = { generateImage };
