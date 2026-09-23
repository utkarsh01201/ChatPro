require('dotenv').config();

const {
    Bot,
    InputFile,
    InlineKeyboard
} = require('grammy');

const http = require('http');
const path = require('path');
const sharp = require('sharp');

const {
    generateAIResponse,
    analyzeImage
} = require('./ai');

const {
    generateImage
} = require('./image');

const {
    getAllFontStyles
} = require('./fonts');

const {
    overlayText
} = require('./editor');

const db = require('./db');


// ============================================================
// BOT
// ============================================================

const bot = new Bot(
    process.env.TELEGRAM_BOT_TOKEN
);


// ============================================================
// CONFIG
// ============================================================

const IMAGE_EXPIRY =
    5 * 60 * 1000;

const pendingImages =
    new Map();

let cachedVideoFileId =
    null;


// ============================================================
// TYPING
// ============================================================

function startTyping(ctx) {

    const sendTyping = () => {

        if (!ctx.chat?.id) {
            return;
        }

        ctx.api
            .sendChatAction(
                ctx.chat.id,
                'typing'
            )
            .catch(() => {});
    };

    sendTyping();

    const interval =
        setInterval(
            sendTyping,
            4000
        );

    return () => {
        clearInterval(interval);
    };
}


// ============================================================
// START MESSAGE
// ============================================================

const startMessage = `🤖 ChatPro AI

Think. Create. Explore. ⚡

💬 Chat
Ask anything and have a natural conversation.

💻 Coding
Programming, debugging and project help.

📚 Learning
Learn difficult topics simply.

🖼️ Image Understanding
Send an image and ask questions about it.

🎭 Sticker Understanding
Send a sticker for analysis.

🎨 Image Generation
Ask me to create, generate, make or draw something.
I'll directly generate the image.

🖼️ Image Editing
Reply to a photo with:
/text Your Text

🔤 Fonts
/font Your Text

━━━━━━━━━━━━━━━━━━

Commands:

/start
/help
/newchat
/clear
/imagine [prompt]
/font [text]
/text [text]
/about

🌟 Community
👉 @shiddatXXSociety`;


const aboutMessage = `🤖 ChatPro AI

Think. Create. Explore. ⚡

💬 Chat
💻 Code
📚 Learn
🖼️ Vision
🎭 Stickers
🎨 Image Generation
🖼️ Image Editing
🔤 Fonts

🚀 Built for what's next.

👨‍💻 @Utkarsh12011
🌟 @shiddatXXSociety`;


// ============================================================
// KEYBOARD
// ============================================================

function buildStartKeyboard() {

    return new InlineKeyboard()

        .text(
            "❓ Help",
            "btn_help"
        )

        .text(
            "🆕 New Chat",
            "btn_newchat"
        )

        .row()

        .text(
            "📜 History",
            "btn_history"
        )

        .text(
            "ℹ️ About",
            "btn_about"
        )

        .row()

        .text(
            "🎨 Image Library",
            "btn_library_0"
        )

        .text(
            "🔤 Fonts",
            "btn_fonts_info"
        )

        .row()

        .text(
            "🖼️ Image Editor",
            "btn_editor_info"
        )

        .text(
            "⚡ Tips",
            "btn_tips"
        )

        .row()

        .text(
            "👨‍💻 Created By",
            "btn_creator"
        )

        .url(
            "🌟 Community",
            "https://t.me/shiddatXXSociety"
        );
}


function buildLibraryKeyboard(
    page,
    totalPages
) {

    const keyboard =
        new InlineKeyboard();

    if (page > 0) {

        keyboard.text(
            "⬅️ Prev",
            `btn_library_${page - 1}`
        );
    }

    if (
        page > 0 &&
        page < totalPages - 1
    ) {

        keyboard.text(
            `${page + 1}/${totalPages}`,
            "btn_noop"
        );
    }

    if (
        page < totalPages - 1
    ) {

        keyboard.text(
            "Next ➡️",
            `btn_library_${page + 1}`
        );
    }

    keyboard
        .row()
        .text(
            "🏠 Back to Menu",
            "btn_backmenu"
        );

    return keyboard;
}


// ============================================================
// IMAGE GENERATION DETECTION
//
// IMPORTANT:
//
// This is NOT limited to:
// "generate an image"
//
// It also understands:
// "generate the boy playing football"
// "create a BMW in a city"
// "make a realistic tiger"
// "draw a cartoon cat"
// ============================================================

function isImageGenerationRequest(text) {

    const message =
        String(text || '')
            .toLowerCase()
            .trim()
            .replace(/\s+/g, ' ');

    if (!message) {
        return false;
    }


    // --------------------------------------------------------
    // Explicit image words
    // --------------------------------------------------------

    const explicitImageRequest =
        /\b(generate|create|make|draw|design|produce)\b[\s\S]*\b(image|picture|photo|art|artwork|illustration|wallpaper|portrait|logo)\b/i
        .test(message)
        ||
        /\b(image|picture|photo|art|artwork|illustration|wallpaper|portrait|logo)\b[\s\S]*\b(generate|create|make|draw|design|produce)\b/i
        .test(message);


    if (explicitImageRequest) {
        return true;
    }


    // --------------------------------------------------------
    // Hinglish / Hindi explicit image request
    // --------------------------------------------------------

    const hindiImageRequest =
        /\b(image|photo|picture)\b[\s\S]*\b(bana|banao|banado|bana\s+do|generate|create|make)\b/i
        .test(message)
        ||
        /\b(bana|banao|banado|bana\s+do)\b[\s\S]*\b(image|photo|picture)\b/i
        .test(message);


    if (hindiImageRequest) {
        return true;
    }


    // --------------------------------------------------------
    // IMPORTANT:
    //
    // Detect requests like:
    //
    // "GENERATE THE BOY PLAYING FOOTBALL"
    // "CREATE A BMW IN A CYBERPUNK CITY"
    // "MAKE A REALISTIC TIGER"
    //
    // We look for a generation verb + visual subject.
    // --------------------------------------------------------

    const generationVerb =
        /\b(generate|create|make|draw|design|render|paint)\b/i
            .test(message);


    if (!generationVerb) {
        return false;
    }


    // --------------------------------------------------------
    // Visual subjects / scenes
    // --------------------------------------------------------

    const visualWords = [

        // People
        'boy',
        'girl',
        'man',
        'woman',
        'person',
        'people',
        'child',
        'children',
        'baby',
        'kid',
        'model',
        'character',
        'soldier',
        'athlete',
        'player',
        'footballer',
        'cricketer',
        'superhero',

        // Animals
        'dog',
        'cat',
        'tiger',
        'lion',
        'wolf',
        'bear',
        'horse',
        'elephant',
        'monkey',
        'bird',
        'parrot',
        'eagle',
        'snake',
        'dragon',
        'rabbit',
        'deer',
        'fox',

        // Vehicles
        'car',
        'bike',
        'motorcycle',
        'scooter',
        'bus',
        'truck',
        'train',
        'plane',
        'airplane',
        'jet',
        'helicopter',
        'ship',
        'boat',
        'bmw',
        'mercedes',
        'audi',
        'ferrari',
        'lamborghini',
        'tesla',

        // Places / scenes
        'city',
        'street',
        'road',
        'beach',
        'mountain',
        'forest',
        'jungle',
        'desert',
        'park',
        'garden',
        'school',
        'college',
        'office',
        'room',
        'house',
        'home',
        'castle',
        'temple',
        'church',
        'mosque',
        'stadium',
        'field',
        'space',
        'planet',
        'galaxy',
        'universe',

        // Activities
        'football',
        'cricket',
        'basketball',
        'tennis',
        'running',
        'dancing',
        'playing',
        'fighting',
        'swimming',
        'walking',
        'driving',
        'riding',

        // Visual concepts
        'sunset',
        'sunrise',
        'night',
        'sky',
        'ocean',
        'river',
        'waterfall',
        'rain',
        'snow',
        'fire',
        'flower',
        'tree',
        'building',
        'architecture',
        'portrait',
        'landscape',
        'scene',
        'cinematic',
        'realistic',
        'cartoon',
        'anime',
        'fantasy',
        'cyberpunk',
        'futuristic',
        '3d',
        'robot',
        'robotic',
        'alien',
        'character',

        // Common visual creation terms
        'poster',
        'banner',
        'cover',
        'wallpaper',
        'thumbnail',
        'logo',
        'avatar',
        'illustration',
        'art',
        'artwork'
    ];


    const hasVisualSubject =
        visualWords.some(
            word =>
                new RegExp(
                    `\\b${word}\\b`,
                    'i'
                ).test(message)
        );


    if (
        generationVerb &&
        hasVisualSubject
    ) {
        return true;
    }


    return false;
}


// ============================================================
// IMAGE PROMPT EXTRACTION
// ============================================================

function extractImagePrompt(text) {

    let prompt =
        String(text || '').trim();


    // Remove common English commands

    prompt =
        prompt.replace(
            /^(please\s+)?(generate|create|make|draw|design|render|paint)\s+(the\s+)?(image|picture|photo|art|artwork|illustration|wallpaper|portrait|logo)\s*(of|showing|with|for|:)?\s*/i,
            ''
        );


    prompt =
        prompt.replace(
            /^(please\s+)?(generate|create|make|draw|design|render|paint)\s+me\s+/i,
            ''
        );


    prompt =
        prompt.replace(
            /^(please\s+)?(generate|create|make|draw|design|render|paint)\s+/i,
            ''
        );


    // Remove common Hinglish commands

    prompt =
        prompt.replace(
            /^(please\s+)?(ek\s+)?(image|photo|picture)\s+(generate|create|make)\s+(karni|karna|karo|kar\s+do|do|hai)\s*/i,
            ''
        );


    prompt =
        prompt.replace(
            /^(please\s+)?(ek\s+)?(image|photo|picture)\s+(bana|banao|banado|bana\s+do)\s*/i,
            ''
        );


    prompt =
        prompt.replace(
            /^(please\s+)?(image|photo|picture)\s+(generate|create|make)\s*/i,
            ''
        );


    // Remove trailing command words

    prompt =
        prompt.replace(
            /\s+(karni|karna|karo|kar\s+do|bana|banao|banado|bana\s+do|do|hai)\s*$/i,
            ''
        );


    prompt =
        prompt.trim();


    // If extraction failed, send original request.
    // Hugging Face can still understand it.

    if (!prompt) {
        prompt =
            String(text || '').trim();
    }


    return prompt;
}


// ============================================================
// GENERATE AND SEND IMAGE
// ============================================================

async function generateAndSendImage(
    ctx,
    prompt
) {

    const chatId =
        ctx.chat.id.toString();


    console.log(
        "=========================================="
    );

    console.log(
        "🎨 IMAGE GENERATION REQUEST"
    );

    console.log(
        "📝 User prompt:",
        prompt
    );

    console.log(
        "🚀 CALLING HUGGING FACE..."
    );

    console.log(
        "=========================================="
    );


    const placeholder =
        await ctx.reply(
            "🎨 Creating your image..."
        );


    const stopTyping =
        startTyping(ctx);


    try {

        // ====================================================
        // DIRECT IMAGE GENERATION
        //
        // image.js:
        // Hugging Face FIRST
        // Pollinations ONLY as fallback
        // ====================================================

        const result =
            await generateImage(
                prompt
            );


        if (
            !result ||
            !result.buffer
        ) {

            throw new Error(
                "No image buffer returned."
            );
        }


        console.log(
            "✅ IMAGE GENERATED"
        );

        console.log(
            "Provider:",
            result.provider
        );


        const cleanPrompt =
            prompt.length > 250
                ? prompt.slice(0, 247) + '...'
                : prompt;


        // ====================================================
        // SEND ACTUAL IMAGE
        // ====================================================

        const sent =
            await ctx.replyWithPhoto(
                new InputFile(
                    result.buffer,
                    'generated.jpg'
                ),
                {
                    caption:
                        `🎨 Generated with ${result.provider || 'Hugging Face'}\n\nPrompt: "${cleanPrompt}"\n\n👨‍💻 @Utkarsh12011`
                }
            );


        // ====================================================
        // SAVE IMAGE
        // ====================================================

        const fileId =
            sent.photo?.[
                sent.photo.length - 1
            ]?.file_id || '';


        if (fileId) {

            try {

                await db.saveImageToLibrary(
                    chatId,
                    prompt,
                    fileId
                );

            } catch (error) {

                console.error(
                    "Image library save error:",
                    error.message
                );
            }
        }


        // Remove loading message

        await ctx.api
            .deleteMessage(
                ctx.chat.id,
                placeholder.message_id
            )
            .catch(() => {});


    } catch (error) {

        console.error(
            "❌ HUGGING FACE / IMAGE GENERATION ERROR:",
            error.message
        );


        await ctx.api
            .editMessageText(
                ctx.chat.id,
                placeholder.message_id,
                "❌ I couldn't generate the image right now. Please try again."
            )
            .catch(() => {});


    } finally {

        stopTyping();
    }
}


// ============================================================
// START / HELP
// ============================================================

bot.command(
    [
        'start',
        'help'
    ],
    async (ctx) => {

        const keyboard =
            buildStartKeyboard();


        try {

            if (cachedVideoFileId) {

                await ctx.replyWithVideo(
                    cachedVideoFileId,
                    {
                        caption:
                            startMessage,

                        reply_markup:
                            keyboard
                    }
                );

                return;
            }


            const videoPath =
                path.join(
                    __dirname,
                    '..',
                    'keep_only_last_seconds.mp4'
                );


            const sent =
                await ctx.replyWithVideo(
                    new InputFile(
                        videoPath
                    ),
                    {
                        caption:
                            startMessage,

                        reply_markup:
                            keyboard
                    }
                );


            cachedVideoFileId =
                sent.video.file_id;


        } catch (error) {

            console.error(
                "Start error:",
                error.message
            );


            await ctx.reply(
                startMessage,
                {
                    reply_markup:
                        keyboard
                }
            );
        }
    }
);


// ============================================================
// NEW CHAT / CLEAR
// ============================================================

bot.command(
    [
        'newchat',
        'clear'
    ],
    async (ctx) => {

        const chatId =
            ctx.chat.id.toString();


        try {

            await db.clearChatHistory(
                chatId
            );

        } catch (error) {

            console.error(
                "Clear error:",
                error.message
            );
        }


        pendingImages.delete(
            chatId
        );


        await ctx.reply(
            "🧹 Conversation cleared! Let's start fresh."
        );
    }
);


// ============================================================
// ABOUT
// ============================================================

bot.command(
    'about',
    async (ctx) => {

        await ctx.reply(
            aboutMessage
        );
    }
);


// ============================================================
// /IMAGINE
// ============================================================

bot.command(
    'imagine',
    async (ctx) => {

        const prompt =
            ctx.match?.trim();


        if (!prompt) {

            await ctx.reply(
                "🎨 Example:\n/imagine a futuristic city at night"
            );

            return;
        }


        await generateAndSendImage(
            ctx,
            prompt
        );
    }
);


// ============================================================
// FONT
// ============================================================

bot.command(
    [
        'font',
        'fonts'
    ],
    async (ctx) => {

        const text =
            ctx.match?.trim();


        if (!text) {

            await ctx.reply(
                "🔤 Usage:\n/font Your Text"
            );

            return;
        }


        const styles =
            getAllFontStyles(
                text
            );


        const formatted =
            styles
                .map(
                    style =>
                        `${style.name}:\n\`${style.text}\``
                )
                .join(
                    '\n\n'
                );


        await ctx.reply(
            `🔤 *Stylized Fonts for:* "${text}"\n\n${formatted}`,
            {
                parse_mode:
                    'Markdown'
            }
        );
    }
);


// ============================================================
// TELEGRAM PHOTO DOWNLOAD
// ============================================================

async function downloadTelegramPhoto(
    ctx,
    photos
) {

    const largest =
        photos[
            photos.length - 1
        ];


    const file =
        await ctx.api.getFile(
            largest.file_id
        );


    if (!file.file_path) {

        throw new Error(
            'Telegram photo path unavailable.'
        );
    }


    const url =
        `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;


    const response =
        await fetch(
            url
        );


    if (!response.ok) {

        throw new Error(
            'Failed to download Telegram photo.'
        );
    }


    return {

        buffer:
            Buffer.from(
                await response.arrayBuffer()
            ),

        mimeType:
            'image/jpeg'
    };
}


// ============================================================
// TELEGRAM FILE DOWNLOAD
// ============================================================

async function downloadTelegramFile(
    ctx,
    fileId
) {

    const file =
        await ctx.api.getFile(
            fileId
        );


    if (!file.file_path) {

        throw new Error(
            'Telegram file path unavailable.'
        );
    }


    const url =
        `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;


    const response =
        await fetch(
            url
        );


    if (!response.ok) {

        throw new Error(
            'Failed to download Telegram file.'
        );
    }


    return Buffer.from(
        await response.arrayBuffer()
    );
}


// ============================================================
// IMAGE EDITOR
// ============================================================

bot.command(
    [
        'text',
        'name',
        'addtext',
        'edit'
    ],
    async (ctx) => {

        let textToOverlay =
            ctx.match?.trim();


        const replyPhoto =
            ctx.message
                .reply_to_message
                ?.photo;


        if (!replyPhoto) {

            await ctx.reply(
                "🖼️ Reply to a photo with:\n/text Your Text"
            );

            return;
        }


        if (!textToOverlay) {

            textToOverlay =
                'Utkarsh';
        }


        const placeholder =
            await ctx.reply(
                '✍️ Adding text to your image...'
            );


        const stopTyping =
            startTyping(ctx);


        try {

            const {
                buffer
            } =
                await downloadTelegramPhoto(
                    ctx,
                    replyPhoto
                );


            const editedBuffer =
                await overlayText(
                    buffer,
                    textToOverlay
                );


            await ctx.replyWithPhoto(
                new InputFile(
                    editedBuffer,
                    'edited.jpg'
                ),
                {
                    caption:
                        `✨ Added "${textToOverlay}"\n\n👨‍💻 @Utkarsh12011`
                }
            );


            await ctx.api
                .deleteMessage(
                    ctx.chat.id,
                    placeholder.message_id
                )
                .catch(() => {});


        } catch (error) {

            console.error(
                'Image editor error:',
                error.message
            );


            await ctx.api
                .editMessageText(
                    ctx.chat.id,
                    placeholder.message_id,
                    "❌ Couldn't edit the image."
                )
                .catch(() => {});


        } finally {

            stopTyping();
        }
    }
);


// ============================================================
// PHOTO HANDLER
// ============================================================

bot.on(
    'message:photo',
    async (ctx) => {

        const chatId =
            ctx.chat.id.toString();


        const caption =
            ctx.message.caption?.trim() ||
            '';


        try {

            const {
                buffer,
                mimeType
            } =
                await downloadTelegramPhoto(
                    ctx,
                    ctx.message.photo
                );


            pendingImages.set(
                chatId,
                {
                    buffer,
                    mimeType,
                    timestamp:
                        Date.now()
                }
            );


            // ------------------------------------------------
            // PHOTO WITHOUT CAPTION
            // ------------------------------------------------

            if (!caption) {

                await ctx.reply(
                    "🖼️ Got the image!\n\nAsk me something about it."
                );

                return;
            }


            // ------------------------------------------------
            // PHOTO + TEXT EDIT
            // ------------------------------------------------

            const editCommand =
                caption.match(
                    /^\/(?:text|name|addtext|edit)(?:\s+(.*))?$/i
                );


            if (editCommand) {

                const textToOverlay =
                    editCommand[1]?.trim() ||
                    'Utkarsh';


                const placeholder =
                    await ctx.reply(
                        `✍️ Adding "${textToOverlay}"...`
                    );


                const stopTyping =
                    startTyping(ctx);


                try {

                    const editedBuffer =
                        await overlayText(
                            buffer,
                            textToOverlay
                        );


                    await ctx.replyWithPhoto(
                        new InputFile(
                            editedBuffer,
                            'edited.jpg'
                        ),
                        {
                            caption:
                                `✨ Added "${textToOverlay}"\n\n👨‍💻 @Utkarsh12011`
                        }
                    );


                    await ctx.api
                        .deleteMessage(
                            ctx.chat.id,
                            placeholder.message_id
                        )
                        .catch(() => {});


                } catch (error) {

                    console.error(
                        'Photo edit error:',
                        error.message
                    );


                    await ctx.api
                        .editMessageText(
                            ctx.chat.id,
                            placeholder.message_id,
                            "❌ Couldn't edit the image."
                        )
                        .catch(() => {});


                } finally {

                    stopTyping();
                }


                return;
            }


            // ------------------------------------------------
            // PHOTO + QUESTION
            // ------------------------------------------------

            const placeholder =
                await ctx.reply(
                    '🖼️ Analyzing your image...'
                );


            const stopTyping =
                startTyping(ctx);


            try {

                const answer =
                    await analyzeImage(
                        buffer,
                        mimeType,
                        caption
                    );


                await ctx.api
                    .editMessageText(
                        ctx.chat.id,
                        placeholder.message_id,
                        answer
                    )
                    .catch(
                        async () => {

                            await ctx.reply(
                                answer
                            );
                        }
                    );


            } catch (error) {

                console.error(
                    'Photo analysis error:',
                    error.message
                );


                await ctx.api
                    .editMessageText(
                        ctx.chat.id,
                        placeholder.message_id,
                        "❌ I couldn't analyze that image."
                    )
                    .catch(() => {});


            } finally {

                stopTyping();
            }


        } catch (error) {

            console.error(
                'Photo handler error:',
                error.message
            );


            await ctx.reply(
                "❌ I couldn't process that photo."
            );
        }
    }
);


// ============================================================
// STICKER HANDLER
// ============================================================

bot.on(
    'message:sticker',
    async (ctx) => {

        const sticker =
            ctx.message.sticker;


        const placeholder =
            await ctx.reply(
                '🎭 Analyzing sticker...'
            );


        const stopTyping =
            startTyping(ctx);


        try {

            let buffer =
                null;


            if (
                sticker.thumbnail?.file_id
            ) {

                try {

                    const thumbnail =
                        await downloadTelegramFile(
                            ctx,
                            sticker.thumbnail.file_id
                        );


                    buffer =
                        await sharp(
                            thumbnail
                        )
                            .png()
                            .toBuffer();

                } catch (error) {

                    console.log(
                        'Sticker thumbnail failed:',
                        error.message
                    );
                }
            }


            if (
                !buffer &&
                !sticker.is_animated &&
                !sticker.is_video
            ) {

                try {

                    const stickerFile =
                        await downloadTelegramFile(
                            ctx,
                            sticker.file_id
                        );


                    buffer =
                        await sharp(
                            stickerFile
                        )
                            .png()
                            .toBuffer();

                } catch (error) {

                    console.log(
                        'Sticker file failed:',
                        error.message
                    );
                }
            }


            if (!buffer) {

                throw new Error(
                    'No sticker preview.'
                );
            }


            const answer =
                await analyzeImage(
                    buffer,
                    'image/png',
                    `
Analyze this Telegram sticker.

Explain what is shown, its emotion,
what it communicates and when someone
would naturally use it.

If text is visible, read it.

Do not invent details.
Keep the answer concise.
`
                );


            await ctx.api
                .editMessageText(
                    ctx.chat.id,
                    placeholder.message_id,
                    answer
                )
                .catch(
                    async () => {

                        await ctx.reply(
                            answer
                        );
                    }
                );


        } catch (error) {

            console.error(
                'Sticker analysis error:',
                error.message
            );


            await ctx.api
                .editMessageText(
                    ctx.chat.id,
                    placeholder.message_id,
                    "❌ I couldn't analyze this sticker."
                )
                .catch(() => {});


        } finally {

            stopTyping();
        }
    }
);


// ============================================================
// MAIN TEXT HANDLER
// ============================================================

bot.on(
    'message:text',
    async (ctx) => {

        const userMessage =
            ctx.message.text.trim();


        if (!userMessage) {
            return;
        }


        if (
            userMessage.startsWith('/')
        ) {
            return;
        }


        const chatId =
            ctx.chat.id.toString();


        const repliedMessage =
            ctx.message.reply_to_message;


        // ====================================================
        // 1. REPLY TO PHOTO
        // ====================================================

        if (
            repliedMessage?.photo
        ) {

            const placeholder =
                await ctx.reply(
                    '🖼️ Analyzing the image you replied to...'
                );


            const stopTyping =
                startTyping(ctx);


            try {

                const {
                    buffer,
                    mimeType
                } =
                    await downloadTelegramPhoto(
                        ctx,
                        repliedMessage.photo
                    );


                const answer =
                    await analyzeImage(
                        buffer,
                        mimeType,
                        userMessage
                    );


                await ctx.api
                    .editMessageText(
                        ctx.chat.id,
                        placeholder.message_id,
                        answer
                    )
                    .catch(
                        async () => {

                            await ctx.reply(
                                answer
                            );
                        }
                    );


            } catch (error) {

                console.error(
                    'Reply image error:',
                    error.message
                );


                await ctx.api
                    .editMessageText(
                        ctx.chat.id,
                        placeholder.message_id,
                        "❌ I couldn't analyze that image."
                    )
                    .catch(() => {});


            } finally {

                stopTyping();
            }


            return;
        }


        // ====================================================
        // 2. IMAGE GENERATION
        //
        // THIS IS THE IMPORTANT PART.
        //
        // It runs BEFORE generateAIResponse().
        // ====================================================

        if (
            isImageGenerationRequest(
                userMessage
            )
        ) {

            console.log(
                '🎨 IMAGE REQUEST DETECTED'
            );


            console.log(
                '👤 Request:',
                userMessage
            );


            const prompt =
                extractImagePrompt(
                    userMessage
                );


            console.log(
                '📝 Image prompt:',
                prompt
            );


            // DIRECTLY CALL IMAGE GENERATOR

            await generateAndSendImage(
                ctx,
                prompt
            );


            // NEVER CONTINUE TO NORMAL AI

            return;
        }


        // ====================================================
        // 3. PENDING IMAGE QUESTION
        // ====================================================

        const pending =
            pendingImages.get(
                chatId
            );


        if (pending) {

            const age =
                Date.now() -
                pending.timestamp;


            if (
                age <= IMAGE_EXPIRY
            ) {

                pendingImages.delete(
                    chatId
                );


                const placeholder =
                    await ctx.reply(
                        '🖼️ Analyzing your image...'
                    );


                const stopTyping =
                    startTyping(ctx);


                try {

                    const answer =
                        await analyzeImage(
                            pending.buffer,
                            pending.mimeType,
                            userMessage
                        );


                    await ctx.api
                        .editMessageText(
                            ctx.chat.id,
                            placeholder.message_id,
                            answer
                        )
                        .catch(
                            async () => {

                                await ctx.reply(
                                    answer
                                );
                            }
                        );


                } catch (error) {

                    console.error(
                        'Pending image error:',
                        error.message
                    );


                    await ctx.api
                        .editMessageText(
                            ctx.chat.id,
                            placeholder.message_id,
                            "❌ I couldn't analyze that image."
                        )
                        .catch(() => {});


                } finally {

                    stopTyping();
                }


                return;
            }


            pendingImages.delete(
                chatId
            );
        }


        // ====================================================
        // 4. NORMAL TEXT AI
        // ====================================================

        const stopTyping =
            startTyping(ctx);


        try {

            const profile =
                await db.getOrCreateUserProfile(
                    chatId,
                    ctx.from || {}
                );


            const chatDoc =
                await db.getChatHistory(
                    chatId
                );


            const history =
                chatDoc.messages
                    .slice(-20)
                    .map(
                        message => ({
                            role:
                                message.role,
                            text:
                                message.text
                        })
                    );


            let messageForAI =
                userMessage;


            // =================================================
            // REPLY CONTEXT
            // =================================================

            if (repliedMessage) {

                const repliedText =
                    (
                        repliedMessage.text ||
                        repliedMessage.caption ||
                        ''
                    ).slice(
                        0,
                        5000
                    );


                if (repliedText) {

                    const senderName =
                        repliedMessage.from?.first_name ||
                        repliedMessage.author_signature ||
                        'previous message';


                    messageForAI =
                        `The user is replying to a previous Telegram message.

Previous message from ${senderName}:

"${repliedText}"

The user's new message is:

${userMessage}

Answer the new message naturally using the previous message as context when relevant.`;
                }
            }


            const answer =
                await generateAIResponse(
                    history,
                    messageForAI,
                    profile
                );


            await db.addMessages(
                chatId,
                [
                    {
                        role:
                            'user',

                        text:
                            userMessage
                    },

                    {
                        role:
                            'model',

                        text:
                            answer
                    }
                ]
            );


            await ctx.reply(
                answer
            );


        } catch (error) {

            console.error(
                'Normal AI error:',
                error.message
            );


            await ctx.reply(
                "❌ Something went wrong while processing your message. Please try again."
            );


        } finally {

            stopTyping();
        }
    }
);


// ============================================================
// CALLBACKS
// ============================================================

bot.callbackQuery(
    'btn_help',
    async (ctx) => {

        await ctx.answerCallbackQuery();

        await ctx.reply(
            startMessage,
            {
                reply_markup:
                    buildStartKeyboard()
            }
        );
    }
);


bot.callbackQuery(
    'btn_newchat',
    async (ctx) => {

        const chatId =
            ctx.chat.id.toString();


        try {

            await db.clearChatHistory(
                chatId
            );

        } catch (error) {

            console.error(
                'New chat error:',
                error.message
            );
        }


        pendingImages.delete(
            chatId
        );


        await ctx.answerCallbackQuery(
            'Chat cleared!'
        );


        await ctx.reply(
            '🧹 Fresh start! Your conversation history has been cleared.'
        );
    }
);


bot.callbackQuery(
    'btn_history',
    async (ctx) => {

        await ctx.answerCallbackQuery();


        const chatId =
            ctx.chat.id.toString();


        try {

            const chatDoc =
                await db.getChatHistory(
                    chatId
                );


            if (
                !chatDoc.messages ||
                chatDoc.messages.length === 0
            ) {

                await ctx.reply(
                    '📜 No conversation history yet.'
                );

                return;
            }


            const recent =
                chatDoc.messages.slice(-10);


            const summary =
                recent
                    .map(
                        message =>
                            `${message.role === 'user' ? '👤 You' : '🤖 AI'}: ${message.text.slice(0, 100)}${message.text.length > 100 ? '...' : ''}`
                    )
                    .join('\n');


            await ctx.reply(
                `📜 Recent Conversation History\n\n${summary}`,
                {
                    reply_markup:
                        buildStartKeyboard()
                }
            );


        } catch (error) {

            console.error(
                'History error:',
                error.message
            );


            await ctx.reply(
                "❌ Couldn't load history."
            );
        }
    }
);


bot.callbackQuery(
    'btn_about',
    async (ctx) => {

        await ctx.answerCallbackQuery();

        await ctx.reply(
            aboutMessage
        );
    }
);


bot.callbackQuery(
    /^btn_library_(\d+)$/,
    async (ctx) => {

        await ctx.answerCallbackQuery();


        const page =
            Number(
                ctx.match[1]
            ) || 0;


        const chatId =
            ctx.chat.id.toString();


        try {

            const {
                images,
                pages
            } =
                await db.getImageLibrary(
                    chatId,
                    page,
                    5
                );


            if (
                !images ||
                images.length === 0
            ) {

                await ctx.reply(
                    '🎨 Your image library is empty.'
                );

                return;
            }


            for (
                const image of images
            ) {

                await ctx.replyWithPhoto(
                    image.imageUrl,
                    {
                        caption:
                            `🎨 ${image.prompt}`
                    }
                );
            }


            await ctx.reply(
                `📚 Image Library — Page ${page + 1}/${pages || 1}`,
                {
                    reply_markup:
                        buildLibraryKeyboard(
                            page,
                            pages || 1
                        )
                }
            );


        } catch (error) {

            console.error(
                'Library error:',
                error.message
            );


            await ctx.reply(
                "❌ Couldn't load image library."
            );
        }
    }
);


bot.callbackQuery(
    'btn_noop',
    async (ctx) => {

        await ctx.answerCallbackQuery();
    }
);


bot.callbackQuery(
    'btn_backmenu',
    async (ctx) => {

        await ctx.answerCallbackQuery();


        await ctx.reply(
            startMessage,
            {
                reply_markup:
                    buildStartKeyboard()
            }
        );
    }
);


bot.callbackQuery(
    'btn_fonts_info',
    async (ctx) => {

        await ctx.answerCallbackQuery();


        await ctx.reply(
            '🔤 Use:\n/font Your Text'
        );
    }
);


bot.callbackQuery(
    'btn_editor_info',
    async (ctx) => {

        await ctx.answerCallbackQuery();


        await ctx.reply(
            '🖼️ Reply to a photo with:\n/text Your Text'
        );
    }
);


bot.callbackQuery(
    'btn_tips',
    async (ctx) => {

        await ctx.answerCallbackQuery();


        await ctx.reply(
            `⚡ ChatPro Tips

• Ask normal questions
• Reply to your own messages
• Reply to bot messages
• Send photos for analysis
• Reply to photos with questions
• Send stickers for analysis
• Ask to generate/create/make/draw visual content
• Use /imagine for direct image generation
• Use /font for fonts
• Use /text for image editing`
        );
    }
);


bot.callbackQuery(
    'btn_creator',
    async (ctx) => {

        await ctx.answerCallbackQuery();


        await ctx.reply(
            '👨‍💻 Created by @Utkarsh12011\n\n🤖 ChatPro AI'
        );
    }
);


// ============================================================
// ERROR HANDLER
// ============================================================

bot.catch(
    (error) => {

        console.error(
            '❌ Bot error:',
            error.error
        );
    }
);


// ============================================================
// RENDER HEALTH SERVER
// ============================================================

const PORT =
    Number(
        process.env.PORT
    ) || 3000;


const server =
    http.createServer(
        (req, res) => {

            if (
                req.url === '/' ||
                req.url === '/health'
            ) {

                res.writeHead(
                    200,
                    {
                        'Content-Type':
                            'text/plain'
                    }
                );


                res.end(
                    'ChatPro AI is running 🚀'
                );


                return;
            }


            res.writeHead(
                404,
                {
                    'Content-Type':
                        'text/plain'
                }
            );


            res.end(
                'Not Found'
            );
        }
    );


server.listen(
    PORT,
    '0.0.0.0',
    () => {

        console.log(
            `🌐 Health server running on port ${PORT}`
        );
    }
);


// ============================================================
// START BOT
// ============================================================

bot.start(
    {
        drop_pending_updates:
            true
    }
)
    .then(
        () => {

            console.log(
                '🤖 ChatPro AI bot started successfully!'
            );
        }
    )
    .catch(
        (error) => {

            console.error(
                '❌ Failed to start bot:',
                error
            );

            process.exit(1);
        }
    );


// ============================================================
// SHUTDOWN
// ============================================================

process.once(
    'SIGINT',
    () => bot.stop()
);

process.once(
    'SIGTERM',
    () => bot.stop()
);
