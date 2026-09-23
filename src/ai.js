const { GoogleGenAI } = require('@google/genai');

const {
    callOpenRouter,
    analyzeImageWithOpenRouter
} = require('./openrouter');

const sharp = require('sharp');


// ============================================================
// GEMINI
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
// GROQ SETTINGS
//
// IMPORTANT:
//
// We intentionally DO NOT use a long Groq cooldown.
//
// If Groq returns 429, we immediately move to OpenRouter.
//
// This prevents the bot from sitting idle while waiting.
// ============================================================

const GROQ_MAX_HISTORY_MESSAGES = 4;

const GROQ_MAX_MESSAGE_CHARS = 1200;

const GROQ_MAX_OUTPUT_TOKENS = 1024;


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
// TELEGRAM FORMATTER
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
// GROQ MESSAGE OPTIMIZER
//
// THIS IS THE IMPORTANT FIX.
//
// Instead of sending the complete conversation:
//
// 20 messages
// 30 messages
// 50 messages
//
// We only send the last 4 messages.
//
// Each old message is also limited to 1200 characters.
//
// This dramatically reduces input-token usage.
// ============================================================

function buildGroqMessages(
    history,
    newMessage,
    systemPrompt
) {

    const messages = [

        {
            role:
                'system',

            content:
                systemPrompt
        }

    ];


    const cleanHistory =
        Array.isArray(history)
            ? history
            : [];


    const recentHistory =
        cleanHistory.slice(
            -GROQ_MAX_HISTORY_MESSAGES
        );


    for (
        const message
        of recentHistory
    ) {

        if (
            !message ||
            !message.text
        ) {
            continue;
        }


        let role =
            'user';


        if (
            message.role === 'model' ||
            message.role === 'assistant'
        ) {

            role =
                'assistant';
        }


        let text =
            String(
                message.text
            ).trim();


        if (!text) {
            continue;
        }


        if (
            text.length >
            GROQ_MAX_MESSAGE_CHARS
        ) {

            text =
                text.slice(
                    0,
                    GROQ_MAX_MESSAGE_CHARS
                ) +
                '\n[Older message truncated]';
        }


        messages.push({

            role,

            content:
                text
        });
    }


    let currentMessage =
        String(
            newMessage || ''
        ).trim();


    if (
        currentMessage.length >
        GROQ_MAX_MESSAGE_CHARS
    ) {

        currentMessage =
            currentMessage.slice(
                0,
                GROQ_MAX_MESSAGE_CHARS
            ) +
            '\n[Message truncated]';
    }


    if (currentMessage) {

        messages.push({

            role:
                'user',

            content:
                currentMessage
        });
    }


    return messages;
}


// ============================================================
// GROQ RATE LIMIT LOGGER
// ============================================================

function logGroqRateLimits(
    response
) {

    try {

        const remainingTokens =
            response.headers.get(
                'x-ratelimit-remaining-tokens'
            );

        const resetTokens =
            response.headers.get(
                'x-ratelimit-reset-tokens'
            );

        const remainingRequests =
            response.headers.get(
                'x-ratelimit-remaining-requests'
            );

        const retryAfter =
            response.headers.get(
                'retry-after'
            );


        console.log(
            '📊 Groq rate limit:',
            {
                remainingTokens,
                resetTokens,
                remainingRequests,
                retryAfter
            }
        );

    } catch {

        // Ignore header parsing errors.
    }
}


// ============================================================
// GROQ FALLBACK
//
// IMPORTANT CHANGES:
//
// 1. Only last 4 history messages.
// 2. Each message max 1200 chars.
// 3. Output max 1024 tokens.
// 4. include_reasoning=false.
// 5. NO artificial 60-second cooldown.
// 6. If 429 happens -> immediately return null.
// 7. OpenRouter then gets a chance.
// ============================================================

async function tryGroq(
    history,
    newMessage,
    systemPrompt
) {

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


        const messages =
            buildGroqMessages(
                history,
                newMessage,
                systemPrompt
            );


        console.log(
            `🧠 Groq context: ${messages.length} messages`
        );


        const response =
            await fetch(
                'https://api.groq.com/openai/v1/chat/completions',
                {

                    method:
                        'POST',

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
                                GROQ_MAX_OUTPUT_TOKENS,

                            include_reasoning:
                                false
                        }),

                    signal:
                        AbortSignal.timeout(
                            30000
                        )
                }
            );


        logGroqRateLimits(
            response
        );


        const raw =
            await response.text();


        let data =
            null;


        try {

            data =
                JSON.parse(
                    raw
                );

        } catch {

            data =
                null;
        }


        // ====================================================
        // GROQ ERROR
        // ====================================================

        if (!response.ok) {

            const errorMessage =
                data?.error?.message ||
                raw.slice(
                    0,
                    1000
                ) ||
                `HTTP ${response.status}`;


            const retryAfter =
                response.headers.get(
                    'retry-after'
                );


            console.error(
                `❌ Groq HTTP ${response.status}: ${errorMessage}`
            );


            if (
                response.status === 429
            ) {

                console.warn(
                    `⏳ Groq rate limit reached. Server retry-after: ${retryAfter || 'not provided'}`
                );


                // IMPORTANT:
                //
                // DO NOT WAIT HERE.
                //
                // Immediately return null so
                // generateAIResponse() can use OpenRouter.
                //

                return null;
            }


            return null;
        }


        // ====================================================
        // GROQ SUCCESS
        // ====================================================

        const answer =
            data?.choices?.[0]?.message?.content;


        if (
            !answer ||
            !String(
                answer
            ).trim()
        ) {

            console.warn(
                '⚠️ Groq returned an empty response.'
            );

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

        role:
            'user',

        parts: [

            {
                text:
                    newMessage
            }

        ]
    });


    // ========================================================
    // 1. GEMINI
    // ========================================================

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


    // ========================================================
    // 2. GROQ
    // ========================================================

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


    // ========================================================
    // 3. OPENROUTER
    // ========================================================

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


    // ========================================================
    // OPENROUTER IMAGE ANALYSIS
    // ========================================================

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
// IMAGE EDITING
//
// PRIMARY:
// Cloudflare FLUX.1 Kontext Pro
//
// FALLBACK:
// Gemini 3.1 Flash Image
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


    const originalMimeType =
        String(
            mimeType ||
            'image/jpeg'
        ).toLowerCase();


    console.log(
        '🎨 IMAGE EDIT REQUEST'
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
    // CLOUDFLARE PRIMARY
    // ========================================================

    try {

        const cloudflareResult =
            await editImageWithCloudflare(
                imageBuffer,
                originalMimeType,
                editInstruction
            );


        if (
            cloudflareResult &&
            cloudflareResult.buffer
        ) {

            return cloudflareResult;
        }

    } catch (error) {

        console.error(
            '❌ Cloudflare image editing failed:',
            error.message
        );


        console.log(
            '🔄 Trying Gemini image editing fallback...'
        );
    }


    // ========================================================
    // GEMINI FALLBACK
    // ========================================================

    try {

        const geminiResult =
            await editImageWithGemini(
                imageBuffer,
                originalMimeType,
                editInstruction
            );


        if (
            geminiResult &&
            geminiResult.buffer
        ) {

            return geminiResult;
        }

    } catch (error) {

        console.error(
            '❌ Gemini image editing fallback failed:',
            error.message
        );
    }


    throw new Error(
        'Image editing failed with both Cloudflare and Gemini.'
    );
}


// ============================================================
// CLOUDFLARE FLUX KONTEXT PRO
// ============================================================

async function editImageWithCloudflare(
    imageBuffer,
    mimeType,
    editInstruction
) {

    const accountId =
        process.env.CLOUDFLARE_ACCOUNT_ID;


    const token =
        process.env.CLOUDFLARE_API_TOKEN;


    if (
        !accountId ||
        !token
    ) {

        throw new Error(
            'Cloudflare credentials are missing.'
        );
    }


    let inputBuffer =
        imageBuffer;


    let inputMime =
        mimeType;


    const supportedMimeTypes = [

        'image/jpeg',
        'image/png',
        'image/webp',
        'image/avif',
        'image/tiff',
        'image/gif',
        'image/heic',
        'image/heif'
    ];


    if (
        !supportedMimeTypes.includes(
            inputMime
        )
    ) {

        inputBuffer =
            await convertImageToJpeg(
                imageBuffer
            );


        inputMime =
            'image/jpeg';
    }


    if (
        inputMime === 'image/heic' ||
        inputMime === 'image/heif'
    ) {

        inputBuffer =
            await convertImageToJpeg(
                imageBuffer
            );


        inputMime =
            'image/jpeg';
    }


    const base64Image =
        inputBuffer.toString(
            'base64'
        );


    const imageDataUri =
        `data:${inputMime};base64,${base64Image}`;


    const url =
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run`;


    console.log(
        '☁️ [Cloudflare FLUX Kontext Pro] Editing image...'
    );


    const requestBody = {

        model:
            'black-forest-labs/flux-1-kontext-pro',

        input: {

            prompt:
                `Edit this image according to the user's request.

USER REQUEST:
${editInstruction}

EDITING REQUIREMENTS:

- Use the provided image as the source.
- Preserve the main subject unless explicitly requested.
- Preserve faces and identity when possible.
- Preserve clothing unless explicitly requested.
- Preserve original composition where possible.
- Preserve camera perspective.
- Preserve lighting and overall visual style.
- Integrate newly added people or objects naturally.
- Match scale, perspective, lighting, shadows and color.
- If removing an object, reconstruct the affected background naturally.
- Make the result look like a realistic finished image.
- Return the edited image.`,

            input_image:
                imageDataUri,

            output_format:
                'jpeg'
        }
    };


    const response =
        await fetch(
            url,
            {

                method:
                    'POST',

                headers: {

                    'Authorization':
                        `Bearer ${token}`,

                    'Content-Type':
                        'application/json'
                },

                body:
                    JSON.stringify(
                        requestBody
                    ),

                signal:
                    AbortSignal.timeout(
                        120000
                    )
            }
        );


    const raw =
        await response.text();


    let data =
        null;


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
            data?.errors?.[0]?.message ||
            data?.result?.error ||
            data?.error?.message ||
            raw.slice(
                0,
                1000
            ) ||
            `HTTP ${response.status}`;


        throw new Error(
            `Cloudflare image editing failed: ${errorMessage}`
        );
    }


    const imageUrl =
        data?.result?.image;


    if (
        imageUrl &&
        typeof imageUrl === 'string'
    ) {

        console.log(
            '☁️ Cloudflare returned image URL.'
        );


        const imageResponse =
            await fetch(
                imageUrl,
                {
                    signal:
                        AbortSignal.timeout(
                            90000
                        )
                }
            );


        if (!imageResponse.ok) {

            throw new Error(
                `Unable to download Cloudflare generated image: HTTP ${imageResponse.status}`
            );
        }


        const outputBuffer =
            Buffer.from(
                await imageResponse.arrayBuffer()
            );


        if (
            outputBuffer.length <= 1000
        ) {

            throw new Error(
                'Cloudflare returned an invalid image.'
            );
        }


        console.log(
            `✅ Cloudflare FLUX Kontext Pro edit successful (${outputBuffer.length} bytes)`
        );


        return {

            buffer:
                outputBuffer,

            provider:
                'Cloudflare FLUX.1 Kontext Pro',

            mimeType:
                'image/jpeg'
        };
    }


    const base64Output =
        data?.result?.image_base64 ||
        data?.result?.image_data ||
        data?.result?.image;


    if (
        base64Output &&
        typeof base64Output === 'string' &&
        !base64Output.startsWith('http')
    ) {

        let cleanBase64 =
            base64Output;


        if (
            cleanBase64.includes(',')
        ) {

            cleanBase64 =
                cleanBase64.split(
                    ','
                )[1];
        }


        const outputBuffer =
            Buffer.from(
                cleanBase64,
                'base64'
            );


        if (
            outputBuffer.length > 1000
        ) {

            console.log(
                `✅ Cloudflare FLUX Kontext Pro edit successful from base64 (${outputBuffer.length} bytes)`
            );


            return {

                buffer:
                    outputBuffer,

                provider:
                    'Cloudflare FLUX.1 Kontext Pro',

                mimeType:
                    'image/jpeg'
            };
        }
    }


    console.error(
        '❌ Cloudflare returned no usable image.'
    );


    console.error(
        'Cloudflare response:',
        JSON.stringify(
            data
        ).slice(
            0,
            3000
        )
    );


    throw new Error(
        'Cloudflare image editing returned no usable image.'
    );
}


// ============================================================
// GEMINI IMAGE EDIT FALLBACK
// ============================================================

async function editImageWithGemini(
    imageBuffer,
    mimeType,
    editInstruction
) {

    const apiKey =
        process.env.GEMINI_API_KEY;


    if (!apiKey) {

        throw new Error(
            'GEMINI_API_KEY is missing from environment variables.'
        );
    }


    let inputBuffer =
        imageBuffer;


    let inputMime =
        mimeType;


    if (
        inputMime !== 'image/jpeg'
    ) {

        inputBuffer =
            await convertImageToJpeg(
                imageBuffer
            );


        inputMime =
            'image/jpeg';
    }


    const base64Image =
        inputBuffer.toString(
            'base64'
        );


    console.log(
        '🎨 FALLBACK IMAGE EDIT: Gemini 3.1 Flash Image'
    );


    const response =
        await fetch(
            'https://generativelanguage.googleapis.com/v1beta/interactions',
            {

                method:
                    'POST',

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

IMPORTANT:

- Use the provided image as the source.
- Make only the requested changes.
- Preserve the original composition.
- Preserve people, faces, clothing and main subjects unless explicitly requested.
- Preserve camera perspective.
- Preserve lighting and colors where possible.
- Integrate additions naturally.
- Match scale, perspective, lighting, shadows and image quality.
- If removing an object, reconstruct the affected area naturally.
- Return the edited image.
`
                            },

                            {

                                type:
                                    'image',

                                mime_type:
                                    inputMime,

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


    let data =
        null;


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


        throw new Error(
            `Gemini image editing failed: ${errorMessage}`
        );
    }


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
                `✅ Gemini fallback image edit successful (${buffer.length} bytes)`
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


    throw new Error(
        'Gemini image editing returned no image.'
    );
}


// ============================================================
// CONVERT IMAGE TO JPEG
// ============================================================

async function convertImageToJpeg(
    imageBuffer
) {

    try {

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
