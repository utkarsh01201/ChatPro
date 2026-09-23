const { GoogleGenAI } = require('@google/genai');

const {
    callOpenRouter,
    analyzeImageWithOpenRouter
} = require('./openrouter');


// ============================================================
// GEMINI - PRIMARY
// ============================================================

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});


// ============================================================
// GEMINI MODELS
// ============================================================

const MODELS = [
    'gemini-3.8-flash',
    'gemini-3.5-flash-lite'
];


// ============================================================
// GEMINI GOOGLE SEARCH
// ============================================================

const groundingTool = {
    googleSearch: {}
};


// ============================================================
// GEMINI COOLDOWN
// ============================================================

let geminiCooldownUntil = 0;

const GEMINI_COOLDOWN =
    60 * 1000;


// ============================================================
// GROQ COOLDOWN
// ============================================================

let groqCooldownUntil = 0;

const GROQ_COOLDOWN =
    60 * 1000;


// ============================================================
// WEB SEARCH DETECTION
// ============================================================

function needsWebSearch(message) {

    if (!message) {
        return false;
    }

    const text =
        String(message)
            .toLowerCase()
            .trim();

    const patterns = [

        'search web',
        'search the web',
        'check web',
        'check the web',
        'browse web',
        'browse the web',
        'web search',
        'search online',
        'find online',
        'look it up',
        'look this up',
        'google it',
        'search for it',
        'search this',
        'verify online',
        'verify this',
        'check online',
        'check internet',
        'search internet',

        'latest',
        'recent',
        'recently',
        'currently',
        'current',
        'right now',
        'today',
        'tonight',
        'yesterday',
        'tomorrow',
        'this week',
        'this month',
        'this year',
        'breaking news',
        'latest news',
        'recent news',
        'live update',
        'live updates',
        'real time',
        'realtime',
        '2026',

        'weather',
        'temperature',
        'forecast',
        'stock price',
        'share price',
        'crypto price',
        'bitcoin price',
        'ethereum price',
        'gold price',
        'silver price',
        'petrol price',
        'diesel price',
        'fuel price',
        'exchange rate',
        'usd to inr',
        'inr to usd',
        'price of',
        'cost of',
        'ticket price',
        'flight price',
        'hotel price',
        'opening hours',
        'open now',
        'closed today',
        'traffic',
        'outage',
        'server status',
        'availability',

        'news about',
        'news on',
        'news regarding',
        'what happened',
        'happening now',
        'happening today',
        'upcoming event',
        'upcoming events',
        'event today',
        'event tomorrow',
        'match today',
        'match tomorrow',
        'live score',
        'live scores',
        'standings',
        'election result',
        'election results',
        'match result',
        'match results',

        'latest version',
        'current version',
        'new version',
        'release notes',
        'recent update',
        'latest update',
        'current api',
        'latest api',
        'latest model',
        'current model',
        'supported model',
        'released today',
        'released recently',
        'new release',
        'latest release',
        'current documentation',
        'latest documentation'
    ];

    return patterns.some(
        pattern =>
            text.includes(pattern)
    );
}


// ============================================================
// TELEGRAM RESPONSE FORMATTER
// ============================================================

function formatForTelegram(text) {

    if (!text) {
        return '';
    }

    let answer =
        String(text);

    answer =
        answer.replace(
            /<websearch>[\s\S]*?<\/websearch>/gi,
            ''
        );

    answer =
        answer.replace(
            /<\/?websearch>/gi,
            ''
        );

    answer =
        answer.replace(
            /<think>[\s\S]*?<\/think>/gi,
            ''
        );

    answer =
        answer.replace(
            /<thinking>[\s\S]*?<\/thinking>/gi,
            ''
        );

    answer =
        answer.replace(
            /<analysis>[\s\S]*?<\/analysis>/gi,
            ''
        );

    answer =
        answer.replace(
            /I don't have the search results yet\.[\s\S]*$/gi,
            ''
        );

    answer =
        answer.replace(
            /I need to wait for the web search results\.[\s\S]*$/gi,
            ''
        );

    answer =
        answer.replace(
            /I'm still waiting for the search results\.[\s\S]*$/gi,
            ''
        );

    answer =
        answer.replace(
            /waiting for (?:the )?(?:web )?search results[\s\S]*$/gi,
            ''
        );

    const codeBlocks = [];

    answer =
        answer.replace(
            /```[\s\S]*?```/g,
            block => {

                const token =
                    `__CHATPRO_CODE_${codeBlocks.length}__`;

                codeBlocks.push(block);

                return token;
            }
        );

    answer =
        answer.replace(
            /^\s*#{4,}\s*/gm,
            ''
        );

    answer =
        answer.replace(
            /^\s*###\s*(.+)$/gm,
            '🔹 $1'
        );

    answer =
        answer.replace(
            /^\s*##\s*(.+)$/gm,
            '🔹 $1'
        );

    answer =
        answer.replace(
            /^\s*#\s*(.+)$/gm,
            '🎯 $1'
        );

    answer =
        answer.replace(
            /\*\*(.*?)\*\*/gs,
            '$1'
        );

    answer =
        answer.replace(
            /__(.*?)__/gs,
            '$1'
        );

    answer =
        answer.replace(
            /(?<!\*)\*([^*\n]+)\*(?!\*)/g,
            '$1'
        );

    answer =
        answer.replace(
            /(?<!_)_([^_\n]+)_(?!_)/g,
            '$1'
        );

    answer =
        answer.replace(
            /^\s*>\s?/gm,
            '💬 '
        );

    answer =
        answer.replace(
            /^\s*[-*_]{3,}\s*$/gm,
            ''
        );

    answer =
        answer.replace(
            /^\s*[-*+]\s+/gm,
            '• '
        );

    answer =
        answer.replace(
            /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
            '$1 — $2'
        );

    answer =
        answer.replace(
            /`([^`\n]+)`/g,
            '$1'
        );

    answer =
        answer.replace(
            /^\s*🌐\s*Sources?\s*:?\s*$/gim,
            '🌐 Sources'
        );

    answer =
        answer.replace(
            /^\s*Sources?\s*:?\s*$/gim,
            '🌐 Sources'
        );

    answer =
        answer.replace(
            /[ \t]+\n/g,
            '\n'
        );

    answer =
        answer.replace(
            /\n{4,}/g,
            '\n\n'
        );

    answer =
        answer.replace(
            /^\s*•\s*$/gm,
            ''
        );

    codeBlocks.forEach(
        (block, index) => {

            answer =
                answer.replace(
                    `__CHATPRO_CODE_${index}__`,
                    block
                );
        }
    );

    return answer.trim();
}


// ============================================================
// SYSTEM PROMPT
// ============================================================

function buildSystemPrompt(
    userProfile,
    useWebSearch = false
) {

    const name =
        userProfile?.preferredName ||
        userProfile?.firstName ||
        'Utkarsh';

    const username =
        userProfile?.username
            ? `@${userProfile.username}`
            : '';

    const factsList =
        userProfile?.facts?.length
            ? userProfile.facts.join('; ')
            : '';

    const currentDateTime =
        new Date().toLocaleString(
            'en-IN',
            {
                timeZone: 'Asia/Kolkata',
                dateStyle: 'full',
                timeStyle: 'short'
            }
        );

    return `
You are ChatPro AI — a smart, modern, friendly and highly capable AI assistant designed for Telegram.

User name:
${name}

Username:
${username}

Known user facts:
${factsList}

Current India date and time:
${currentDateTime}

Web search is ${
        useWebSearch
            ? 'ENABLED for this request.'
            : 'NOT REQUIRED for this request.'
    }.

${
    useWebSearch
        ? `
Use current web information when answering.

Verify important current claims.

Prefer reliable and recent information.

Do not expose internal search instructions.

If sources disagree, clearly explain the uncertainty.
`
        : `
Answer using your knowledge and conversation context.

Do not pretend that you searched the web.
`
}

GENERAL RESPONSE STYLE

Be:
• Clear
• Helpful
• Natural
• Friendly
• Accurate
• Concise when possible
• Detailed when necessary

Use paragraphs for explanations.

Use bullets for lists.

Use headings when useful.

Do not force every answer into a huge structure.

For programming questions:
• Explain the concept clearly.
• Give correct practical examples.
• Preserve code blocks.
• Mention important mistakes when useful.

For learning questions:
• Start simple.
• Explain how it works.
• Give an example.
• End with a useful takeaway.

Never invent facts.

If uncertain, say so.

Current user:
${name}
`;
}


// ============================================================
// GEMINI AVAILABILITY
// ============================================================

function shouldTryGemini() {

    return (
        Date.now() >=
        geminiCooldownUntil
    );
}


// ============================================================
// GEMINI NORMAL TEXT
// ============================================================

async function tryGemini(
    contents,
    systemPrompt,
    useWebSearch
) {

    if (!shouldTryGemini()) {

        console.log(
            '⏳ Gemini is temporarily on cooldown.'
        );

        return null;
    }

    for (
        const model
        of MODELS
    ) {

        try {

            console.log(
                `🤖 PRIMARY: Gemini ${model}`
            );

            const config = {
                systemInstruction:
                    systemPrompt
            };

            if (useWebSearch) {

                config.tools = [
                    groundingTool
                ];
            }

            const response =
                await ai.models.generateContent({
                    model,
                    contents,
                    config
                });

            if (
                response &&
                response.text
            ) {

                console.log(
                    `✅ Gemini ${model} response received.`
                );

                return response.text;
            }

        } catch (error) {

            const errorMessage =
                error?.message ||
                'Unknown Gemini error';

            console.error(
                `❌ Gemini ${model} failed:`,
                errorMessage
            );

            const lowerError =
                String(
                    errorMessage
                ).toLowerCase();

            const quotaError =
                lowerError.includes('429') ||
                lowerError.includes('quota') ||
                lowerError.includes('resource exhausted') ||
                lowerError.includes('rate limit') ||
                lowerError.includes('too many requests');

            if (quotaError) {

                geminiCooldownUntil =
                    Date.now() +
                    GEMINI_COOLDOWN;

                break;
            }
        }
    }

    return null;
}


// ============================================================
// GROQ FALLBACK
// ============================================================

async function tryGroq(
    history,
    newMessage,
    systemPrompt
) {

    if (
        Date.now() <
        groqCooldownUntil
    ) {

        console.log(
            '⏳ Groq is temporarily on cooldown.'
        );

        return null;
    }

    if (
        !process.env.GROQ_API_KEY
    ) {

        console.log(
            '⚠️ GROQ_API_KEY not configured.'
        );

        return null;
    }

    try {

        console.log(
            '🔄 BACKUP: Groq'
        );

        const messages = [

            {
                role: 'system',
                content:
                    systemPrompt
            }

        ];

        for (
            const message
            of (
                history || []
            )
        ) {

            let role =
                'user';

            if (
                message.role === 'model' ||
                message.role === 'assistant'
            ) {

                role =
                    'assistant';
            }

            if (
                message.text &&
                String(
                    message.text
                ).trim()
            ) {

                messages.push({

                    role,

                    content:
                        String(
                            message.text
                        )
                });
            }
        }

        messages.push({

            role: 'user',

            content:
                String(
                    newMessage || ''
                )
        });

        const response =
            await fetch(
                'https://api.groq.com/openai/v1/chat/completions',
                {

                    method: 'POST',

                    headers: {

                        'Authorization':
                            `Bearer ${process.env.GROQ_API_KEY}`,

                        'Content-Type':
                            'application/json'
                    },

                    body:
                        JSON.stringify({

                            model:
                                'openai/gpt-oss-20b',

                            messages,

                            temperature:
                                0.7,

                            max_completion_tokens:
                                2048
                        }),

                    signal:
                        AbortSignal.timeout(
                            25000
                        )
                }
            );

        const raw =
            await response.text();

        let data = null;

        try {

            data =
                JSON.parse(
                    raw
                );

        } catch {

            data =
                null;
        }

        if (!response.ok) {

            const errorMessage =
                data?.error?.message ||
                raw.slice(
                    0,
                    500
                ) ||
                `HTTP ${response.status}`;

            console.error(
                `❌ Groq HTTP ${response.status}: ${errorMessage}`
            );

            const lowerError =
                String(
                    errorMessage
                ).toLowerCase();

            const quotaError =
                response.status === 429 ||
                lowerError.includes(
                    'rate limit'
                ) ||
                lowerError.includes(
                    'quota'
                ) ||
                lowerError.includes(
                    'too many requests'
                );

            if (quotaError) {

                groqCooldownUntil =
                    Date.now() +
                    GROQ_COOLDOWN;
            }

            return null;
        }

        const answer =
            data?.choices?.[0]?.message?.content;

        if (
            !answer ||
            !String(
                answer
            ).trim()
        ) {

            return null;
        }

        console.log(
            '✅ Groq response received.'
        );

        return formatForTelegram(
            String(
                answer
            )
        );

    } catch (error) {

        console.error(
            '❌ Groq fallback error:',
            error.message || error
        );

        return null;
    }
}


// ============================================================
// NORMAL AI RESPONSE
// ============================================================

async function generateAIResponse(
    history,
    newMessage,
    userProfile = null
) {

    const useWebSearch =
        needsWebSearch(
            newMessage
        );

    console.log(
        `🌐 Web search: ${useWebSearch ? 'ENABLED' : 'SKIPPED'}`
    );

    const systemPrompt =
        buildSystemPrompt(
            userProfile,
            useWebSearch
        );

    const contents =
        (history || []).map(
            message => ({

                role:
                    message.role === 'model'
                        ? 'model'
                        : 'user',

                parts: [
                    {
                        text:
                            message.text
                    }
                ]
            })
        );

    contents.push({

        role: 'user',

        parts: [
            {
                text:
                    newMessage
            }
        ]
    });

    try {

        const geminiResult =
            await tryGemini(
                contents,
                systemPrompt,
                useWebSearch
            );

        if (geminiResult) {

            return formatForTelegram(
                geminiResult
            );
        }

    } catch (error) {

        console.error(
            'Gemini primary error:',
            error.message || error
        );
    }

    try {

        const groqResult =
            await tryGroq(
                history,
                newMessage,
                systemPrompt
            );

        if (groqResult) {

            return formatForTelegram(
                groqResult
            );
        }

    } catch (error) {

        console.error(
            'Groq backup error:',
            error.message || error
        );
    }

    try {

        console.log(
            `🔄 BACKUP: OpenRouter${useWebSearch ? ' + Web Search' : ''}`
        );

        const answer =
            await callOpenRouter(
                history,
                newMessage,
                systemPrompt,
                useWebSearch
            );

        return formatForTelegram(
            answer
        );

    } catch (error) {

        console.error(
            '❌ OpenRouter backup error:',
            error.message || error
        );

        return "I'm having a brief moment right now. Please try sending your message again in a few seconds.";
    }
}


// ============================================================
// IMAGE / STICKER UNDERSTANDING
// ============================================================

async function analyzeImage(
    imageBuffer,
    mimeType = 'image/jpeg',
    userQuestion =
        'Describe this image in detail.'
) {

    if (!imageBuffer) {

        throw new Error(
            'No image data received.'
        );
    }

    const base64Image =
        imageBuffer.toString(
            'base64'
        );

    if (
        shouldTryGemini()
    ) {

        for (
            const model
            of MODELS
        ) {

            try {

                console.log(
                    `🖼️ PRIMARY: Gemini ${model} image analysis`
                );

                const response =
                    await ai.models.generateContent({

                        model,

                        contents: [

                            {
                                inlineData: {
                                    mimeType,
                                    data:
                                        base64Image
                                }
                            },

                            {
                                text: `
You are ChatPro AI's visual understanding system.

Study the image carefully and answer the user's request.

USER REQUEST:
${userQuestion}

Pay attention to:

• Main subject
• People
• Animals
• Objects
• Facial expressions
• Emotion
• Pose
• Clothing
• Colors
• Background
• Visible text
• Logos
• Symbols
• UI elements
• Overall mood

If it is a Telegram sticker:

Explain:
• What is shown
• Emotion
• What it communicates
• Natural use in conversation
• Important visual details

If it is a screenshot:

• Identify the application if clearly visible.
• Read visible text.
• Explain errors or UI elements.
• Do not invent information.

Describe only what is visible.

If uncertain, say so.

Answer the user's specific question first.

Keep the response useful and natural.

Do not output internal tags.
`
                            }
                        ]
                    });

                if (
                    response &&
                    response.text
                ) {

                    console.log(
                        `✅ Gemini image analysis successful using ${model}`
                    );

                    return formatForTelegram(
                        response.text
                    );
                }

            } catch (error) {

                const errorMessage =
                    error?.message ||
                    'unknown error';

                console.error(
                    `❌ Gemini image ${model} failed:`,
                    errorMessage
                );

                const lowerError =
                    String(
                        errorMessage
                    ).toLowerCase();

                const quotaError =
                    lowerError.includes('429') ||
                    lowerError.includes('quota') ||
                    lowerError.includes('resource exhausted') ||
                    lowerError.includes('rate limit') ||
                    lowerError.includes('too many requests');

                if (quotaError) {

                    geminiCooldownUntil =
                        Date.now() +
                        GEMINI_COOLDOWN;

                    break;
                }
            }
        }
    }

    console.log(
        '🔄 BACKUP: OpenRouter image analysis'
    );

    const answer =
        await analyzeImageWithOpenRouter(
            imageBuffer,
            mimeType,
            userQuestion
        );

    return formatForTelegram(
        answer
    );
}


// ============================================================
// IMAGE EDITING - GEMINI 3.1 FLASH IMAGE
//
// Input:
// JPG
// JPEG
// PNG
// WEBP
// GIF
// AVIF
// TIFF
// BMP
// etc.
//
// Gemini receives the original MIME type when supported.
// If Gemini rejects the input type, the request is retried
// internally as JPEG.
//
// Gemini output is requested as JPEG because the current
// Interactions endpoint accepts image/jpeg.
//
// The resulting JPEG buffer can then be converted by Sharp
// in bot.js to any Telegram-supported output format.
// ============================================================

async function editImage(
    imageBuffer,
    mimeType = 'image/jpeg',
    editInstruction = ''
) {

    if (!imageBuffer) {

        throw new Error(
            'No image data received for editing.'
        );
    }

    if (
        !editInstruction ||
        !String(
            editInstruction
        ).trim()
    ) {

        throw new Error(
            'No image editing instruction received.'
        );
    }

    const apiKey =
        process.env.GEMINI_API_KEY;

    if (!apiKey) {

        throw new Error(
            'GEMINI_API_KEY is missing from environment variables.'
        );
    }

    const originalMimeType =
        String(
            mimeType || 'image/jpeg'
        ).toLowerCase();

    const base64Image =
        imageBuffer.toString(
            'base64'
        );

    console.log(
        '🎨 IMAGE EDIT: Gemini 3.1 Flash Image'
    );

    console.log(
        '📦 Input MIME:',
        originalMimeType
    );

    console.log(
        '📝 Edit instruction:',
        editInstruction
    );


    // ========================================================
    // FIRST REQUEST
    // ========================================================

    const firstResult =
        await requestGeminiImageEdit(
            apiKey,
            base64Image,
            originalMimeType,
            editInstruction
        );


    // ========================================================
    // IF GEMINI REJECTS THE INPUT FORMAT
    // RETRY AS JPEG
    // ========================================================

    if (
        firstResult &&
        firstResult.retryWithJpeg
    ) {

        console.log(
            '🔄 Gemini rejected the original image MIME type.'
        );

        console.log(
            '🔄 Retrying image edit using JPEG input.'
        );

        const jpegBuffer =
            await convertImageToJpeg(
                imageBuffer
            );

        const jpegBase64 =
            jpegBuffer.toString(
                'base64'
            );

        const retryResult =
            await requestGeminiImageEdit(
                apiKey,
                jpegBase64,
                'image/jpeg',
                editInstruction
            );

        return retryResult;
    }

    return firstResult;
}


// ============================================================
// GEMINI IMAGE EDIT REQUEST
// ============================================================

async function requestGeminiImageEdit(
    apiKey,
    base64Image,
    mimeType,
    editInstruction
) {

    const response =
        await fetch(
            'https://generativelanguage.googleapis.com/v1beta/interactions',
            {

                method: 'POST',

                headers: {

                    'x-goog-api-key':
                        apiKey,

                    'Content-Type':
                        'application/json'
                },

                body:
                    JSON.stringify({

                        model:
                            'gemini-3.1-flash-image',

                        input: [

                            {
                                type:
                                    'text',

                                text:
                                    `Edit the provided image according to the user's instruction.

USER EDIT REQUEST:
${editInstruction}

IMPORTANT EDITING RULES:

- Use the provided image as the source image.
- Make only the requested changes.
- Preserve the original composition unless the user asks otherwise.
- Preserve original people, faces, clothing, objects and main subjects unless explicitly requested.
- Preserve camera perspective.
- Preserve lighting and colors where possible.
- If adding a person or object, integrate it naturally.
- Match scale, perspective, lighting, shadows and image quality.
- If removing something, reconstruct the affected area naturally.
- If changing the background, keep the main subject unchanged unless explicitly requested.
- Make the result look natural.
- Do not return instructions instead of an image.
- Return the edited image.`
                            },

                            {
                                type:
                                    'image',

                                mime_type:
                                    mimeType,

                                data:
                                    base64Image
                            }
                        ],

                        response_format: {

                            type:
                                'image',

                            mime_type:
                                'image/jpeg',

                            image_size:
                                '1K'
                        }
                    }),

                signal:
                    AbortSignal.timeout(
                        90000
                    )
            }
        );

    const raw =
        await response.text();

    let data = null;

    try {

        data =
            JSON.parse(
                raw
            );

    } catch {

        data =
            null;
    }

    if (!response.ok) {

        const errorMessage =
            data?.error?.message ||
            raw.slice(
                0,
                1000
            ) ||
            `HTTP ${response.status}`;

        console.error(
            `❌ Gemini image edit HTTP ${response.status}: ${errorMessage}`
        );


        // ====================================================
        // UNSUPPORTED INPUT MIME
        // ====================================================

        const lowerError =
            String(
                errorMessage
            ).toLowerCase();

        const unsupportedImage =
            lowerError.includes(
                'mime'
            ) ||
            lowerError.includes(
                'image type'
            ) ||
            lowerError.includes(
                'unsupported'
            ) ||
            lowerError.includes(
                'not supported'
            );

        if (
            unsupportedImage &&
            mimeType !== 'image/jpeg'
        ) {

            return {
                retryWithJpeg:
                    true
            };
        }


        throw new Error(
            `Gemini image editing failed: ${errorMessage}`
        );
    }


    // ========================================================
    // PRIMARY OUTPUT
    // ========================================================

    const outputImage =
        data?.output_image?.data;

    if (
        outputImage &&
        typeof outputImage === 'string'
    ) {

        const buffer =
            Buffer.from(
                outputImage,
                'base64'
            );

        if (
            buffer.length > 1000
        ) {

            console.log(
                `✅ Gemini image edit successful (${buffer.length} bytes)`
            );

            return {

                buffer,

                provider:
                    'Gemini 3.1 Flash Image',

                mimeType:
                    'image/jpeg'
            };
        }
    }


    // ========================================================
    // SEARCH INTERACTION STEPS
    // ========================================================

    const steps =
        Array.isArray(
            data?.steps
        )
            ? data.steps
            : [];

    for (
        const step
        of steps
    ) {

        const content =
            Array.isArray(
                step?.content
            )
                ? step.content
                : [];

        for (
            const block
            of content
        ) {

            if (
                block?.type === 'image' &&
                block?.data
            ) {

                const buffer =
                    Buffer.from(
                        block.data,
                        'base64'
                    );

                if (
                    buffer.length > 1000
                ) {

                    console.log(
                        `✅ Gemini image edit successful from interaction step (${buffer.length} bytes)`
                    );

                    return {

                        buffer,

                        provider:
                            'Gemini 3.1 Flash Image',

                        mimeType:
                            'image/jpeg'
                    };
                }
            }
        }
    }


    console.error(
        '❌ Gemini image edit returned no image.'
    );

    console.error(
        'Gemini response:',
        JSON.stringify(
            data
        ).slice(
            0,
            3000
        )
    );

    throw new Error(
        'Gemini image editing returned no image.'
    );
}


// ============================================================
// CONVERT ANY IMAGE TO JPEG
// ============================================================

async function convertImageToJpeg(
    imageBuffer
) {

    try {

        const sharp =
            require('sharp');

        return await sharp(
            imageBuffer
        )
            .rotate()
            .jpeg({
                quality:
                    95
            })
            .toBuffer();

    } catch (error) {

        console.error(
            '❌ Image JPEG conversion failed:',
            error.message
        );

        throw new Error(
            `Unable to convert image to JPEG: ${error.message}`
        );
    }
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    generateAIResponse,

    analyzeImage,

    editImage
};
