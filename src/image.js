// ============================================================
// ChatPro - AI Image Generation
//
// Priority:
// 1. Cloudflare Workers AI - FLUX.1 Schnell
// 2. Hugging Face - Stable Diffusion 3 Medium
// 3. Pollinations - fallback
// ============================================================

async function generateImage(prompt) {

    // ========================================================
    // 1. CLOUDFLARE WORKERS AI - FLUX.1 SCHNELL
    // ========================================================

    const cloudflareAccountId =
        process.env.CLOUDFLARE_ACCOUNT_ID;

    const cloudflareToken =
        process.env.CLOUDFLARE_API_TOKEN;


    if (
        cloudflareAccountId &&
        cloudflareToken
    ) {

        try {

            console.log(
                `☁️ [Cloudflare FLUX] Generating image for: "${prompt}"`
            );


            const url =
                `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}` +
                `/ai/run/@cf/black-forest-labs/flux-1-schnell`;


            const response =
                await fetch(
                    url,
                    {
                        method: 'POST',

                        headers: {
                            'Authorization':
                                `Bearer ${cloudflareToken}`,

                            'Content-Type':
                                'application/json'
                        },

                        // IMPORTANT:
                        // Do NOT send seed.
                        // Cloudflare REST API rejected it.
                        body: JSON.stringify({
                            prompt: prompt,
                            steps: 4
                        }),

                        signal:
                            AbortSignal.timeout(60000)
                    }
                );


            if (response.ok) {

                const data =
                    await response.json();


                if (
                    data &&
                    data.success &&
                    data.result &&
                    data.result.image
                ) {

                    const buffer =
                        Buffer.from(
                            data.result.image,
                            'base64'
                        );


                    if (buffer.length > 1000) {

                        console.log(
                            `✅ [Cloudflare FLUX] Image generated successfully (${buffer.length} bytes)`
                        );


                        return {
                            buffer,
                            provider:
                                'Cloudflare FLUX.1 Schnell'
                        };
                    }
                }


                console.warn(
                    '⚠️ Cloudflare response did not contain a valid image.'
                );


                console.warn(
                    JSON.stringify(data).slice(
                        0,
                        1000
                    )
                );

            } else {

                const errorText =
                    await response.text();


                console.warn(
                    `⚠️ Cloudflare returned ${response.status}:`,
                    errorText.slice(
                        0,
                        1000
                    )
                );
            }


        } catch (cloudflareError) {

            console.warn(
                `⚠️ Cloudflare generation failed: ${cloudflareError.message}`
            );
        }

    } else {

        console.warn(
            '⚠️ Cloudflare credentials not found. Skipping Cloudflare.'
        );
    }


    // ========================================================
    // 2. HUGGING FACE - STABLE DIFFUSION 3 MEDIUM
    // ========================================================

    const hfToken =
        process.env.HUGGINGFACE_API_KEY;


    if (hfToken) {

        try {

            console.log(
                `🤗 [Hugging Face] Generating image for: "${prompt}"`
            );


            const hfUrl =
                'https://router.huggingface.co/hf-inference/models/' +
                'stabilityai/stable-diffusion-3-medium-diffusers';


            const response =
                await fetch(
                    hfUrl,
                    {
                        method: 'POST',

                        headers: {
                            'Authorization':
                                `Bearer ${hfToken}`,

                            'Content-Type':
                                'application/json'
                        },

                        body: JSON.stringify({
                            inputs: prompt
                        }),

                        signal:
                            AbortSignal.timeout(60000)
                    }
                );


            if (response.ok) {

                const contentType =
                    response.headers.get(
                        'content-type'
                    ) || '';


                if (
                    contentType.includes(
                        'image'
                    )
                ) {

                    const buffer =
                        Buffer.from(
                            await response.arrayBuffer()
                        );


                    if (buffer.length > 1000) {

                        console.log(
                            `✅ [Hugging Face] Image generated successfully (${buffer.length} bytes)`
                        );


                        return {
                            buffer,
                            provider:
                                'Hugging Face SD3'
                        };
                    }
                }


                const text =
                    await response.text();


                console.warn(
                    '⚠️ Hugging Face returned unexpected response:',
                    text.slice(
                        0,
                        500
                    )
                );

            } else {

                const errorText =
                    await response.text();


                console.warn(
                    `⚠️ Hugging Face returned ${response.status}:`,
                    errorText.slice(
                        0,
                        500
                    )
                );
            }


        } catch (hfError) {

            console.warn(
                `⚠️ Hugging Face generation failed: ${hfError.message}`
            );
        }

    } else {

        console.warn(
            '⚠️ HUGGINGFACE_API_KEY not found. Skipping Hugging Face.'
        );
    }


    // ========================================================
    // 3. POLLINATIONS FALLBACK
    // ========================================================

    console.log(
        '🌸 [Pollinations] Trying fallback image generation...'
    );


    const encodedPrompt =
        encodeURIComponent(
            prompt
        );


    const models = [
        'turbo',
        'flux',
        ''
    ];


    for (
        const model of models
    ) {

        try {

            const modelParam =
                model
                    ? `&model=${model}`
                    : '';


            const url =
                `https://image.pollinations.ai/prompt/${encodedPrompt}` +
                `?width=768` +
                `&height=768` +
                `&nologo=true` +
                `&seed=${Date.now()}` +
                modelParam;


            console.log(
                `🎨 [Pollinations] Trying model: ${model || 'default'}`
            );


            const response =
                await fetch(
                    url,
                    {
                        method: 'GET',

                        signal:
                            AbortSignal.timeout(
                                60000
                            )
                    }
                );


            if (response.ok) {

                const buffer =
                    Buffer.from(
                        await response.arrayBuffer()
                    );


                if (
                    buffer.length > 1000
                ) {

                    console.log(
                        `✅ [Pollinations] Image generated successfully using ${model || 'default'} (${buffer.length} bytes)`
                    );


                    return {
                        buffer,

                        provider:
                            `Pollinations (${model || 'default'})`
                    };
                }
            }


            console.warn(
                `⚠️ Pollinations ${model || 'default'} returned ${response.status}`
            );


        } catch (pollinationsError) {

            console.warn(
                `⚠️ Pollinations ${model || 'default'} failed: ${pollinationsError.message}`
            );
        }
    }


    // ========================================================
    // ALL PROVIDERS FAILED
    // ========================================================

    throw new Error(
        'Unable to generate image with Cloudflare, Hugging Face, or Pollinations.'
    );
}


// ============================================================
// EXPORT
// ============================================================

module.exports = {
    generateImage
};
