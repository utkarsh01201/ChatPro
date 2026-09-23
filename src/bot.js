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

const IMAGE_EXPIRY = 5 * 60 * 1000;

const pendingImages = new Map();

let cachedVideoFileId = null;


// ============================================================
// TYPING INDICATOR
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

I can help you with:

💬 Normal Chat
Ask anything and have a natural conversation.

💻 Coding
Programming, debugging, explanations and projects.

📚 Learning
Learn difficult topics in simple language.

🖼️ Image Understanding
Send an image and ask me about it.

🎭 Sticker Understanding
Send a sticker and I'll analyze it.

🎨 Image Generation
Simply ask me to create/generate an image.
I'll directly generate it using the configured image model.

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


// ============================================================
// ABOUT
// ============================================================

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
// MAIN KEYBOARD
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


// ============================================================
// LIBRARY KEYBOARD
// ============================================================

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
        page <
        totalPages - 1
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
// IMAGE GENERATION DETECTOR
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


    const patterns = [

        // ====================================================
        // ENGLISH
        // ====================================================

        /\b(generate|create|make|draw)\b.*\b(image|picture|photo|art|artwork)\b/i,

        /\b(image|picture|photo|art|artwork)\b.*\b(generate|create|make|draw)\b/i,

        /\b(generate|create|make|draw)\s+(the|an?|a)?\s*(image|picture|photo|art|artwork)\b/i,

        /\b(generate|create|make|draw)\s+me\b/i,

        /\b(i\s+want|i\s+need|i'd\s+like|i\s+would\s+like)\b.*\b(image|picture|photo|art|artwork)\b/i,

        /\b(can\s+you|could\s+you|please)\b.*\b(generate|create|make|draw)\b/i,

        /\b(show|give|send)\s+me\b.*\b(image|picture|photo)\b/i,

        /\b(turn|convert)\b.*\binto\b.*\b(image|picture|photo|art|artwork)\b/i,


        // ====================================================
        // HINGLISH / HINDI
        // ====================================================

        /\b(image|photo|picture)\b.*\b(generate|create|make)\b.*\b(karni|karna|karo|kar\s+do|do|hai)\b/i,

        /\b(image|photo|picture)\b.*\b(generate|create|make)\b.*\b(karo|kar\s+do|do)\b/i,

        /\b(generate|create|make)\b.*\b(image|photo|picture)\b.*\b(karo|kar\s+do|do)\b/i,

        /\b(image|photo|picture)\b.*\b(bana|banao|banado|bana\s+do|banana|banani)\b/i,

        /\b(bana|banao|banado|bana\s+do)\b.*\b(image|photo|picture)\b/i,

        /\bek\s+(image|photo|picture)\b.*\b(generate|create|make|bana|banao|banado)\b/i,

        /\bek\s+(image|photo|picture)\b.*\b(bana|banao|banado|bana\s+do)\b/i,

        /\b(mere\s+liye|mere\s+lie)\b.*\b(image|photo|picture)\b.*\b(bana|banao|generate|create|make)\b/i,

        /\bimage\s+generate\s+karni\s+hai\b/i,

        /\bimage\s+generate\s+karna\s+hai\b/i,

        /\bimage\s+generate\s+karo\b/i,

        /\bimage\s+generate\s+kar\s+do\b/i,

        /\bphoto\s+bana\s+do\b/i,

        /\bphoto\s+banao\b/i,

        /\bphoto\s+banado\b/i,

        /\bimage\s+bana\s+do\b/i,

        /\bimage\s+banao\b/i,

        /\bimage\s+banado\b/i
    ];


    return patterns.some(
        pattern =>
            pattern.test(message)
    );
}


// ============================================================
// IMAGE PROMPT EXTRACTION
// ============================================================

function extractImagePrompt(text) {

    let prompt =
        String(text || '').trim();


    // --------------------------------------------------------
    // English
    // --------------------------------------------------------

    prompt =
        prompt.replace(
            /^(please\s+)?(generate|create|make|draw)\s+(the\s+)?(image|picture|photo|art|artwork)\s*(of|showing|with|:)?\s*/i,
            ''
        );


    prompt =
        prompt.replace(
            /^(please\s+)?(generate|create|make|draw)\s+me\s+(an?\s+)?/i,
            ''
        );


    prompt =
        prompt.replace(
            /^(please\s+)?(generate|create|make|draw)\s+/i,
            ''
        );


    // --------------------------------------------------------
    // Hinglish
    // --------------------------------------------------------

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


    return (
        prompt ||
        String(text || '').trim()
    );
}


// ============================================================
// IMAGE GENERATION
// ============================================================

async function generateAndSendImage(
    ctx,
    prompt
) {

    const chatId =
        ctx.chat.id.toString();


    console.log(
        "========================================"
    );

    console.log(
        "🎨 IMAGE REQUEST DETECTED"
    );

    console.log(
        "📝 Prompt:",
        prompt
    );

    console.log(
        "🚀 Calling image.js → Hugging Face..."
    );

    console.log(
        "========================================"
    );


    const placeholder =
        await ctx.reply(
            "🎨 Creating your image with AI..."
        );


    const stopTyping =
        startTyping(ctx);


    try {

        // ====================================================
        // DIRECT IMAGE GENERATION
        //
        // image.js calls Hugging Face first.
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
                "Image generator returned no image."
            );
        }


        console.log(
            "✅ Image generated successfully."
        );

        console.log(
            "Provider:",
            result.provider
        );


        const cleanPrompt =
            prompt.length > 250
                ? prompt.slice(0, 247) + "..."
                : prompt;


        // ====================================================
        // SEND ACTUAL IMAGE
        // ====================================================

        const sent =
            await ctx.replyWithPhoto(
                new InputFile(
                    result.buffer,
                    "generated.jpg"
                ),
                {
                    caption:
                        `🎨 Generated with ${result.provider || "Hugging Face"}\n\nPrompt: "${cleanPrompt}"\n\n👨‍💻 by @Utkarsh12011`
                }
            );


        // ====================================================
        // SAVE TO IMAGE LIBRARY
        // ====================================================

        const fileId =
            sent.photo?.[
                sent.photo.length - 1
            ]?.file_id || "";


        if (fileId) {

            try {

                await db.saveImageToLibrary(
                    chatId,
                    prompt,
                    fileId
                );

            } catch (error) {

                console.error(
                    "Image library save failed:",
                    error.message
                );
            }
        }


        // ====================================================
        // DELETE LOADING MESSAGE
        // ====================================================

        await ctx.api
            .deleteMessage(
                ctx.chat.id,
                placeholder.message_id
            )
            .catch(() => {});


    } catch (error) {

        console.error(
            "❌ IMAGE GENERATION ERROR:",
            error
        );


        await ctx.api
            .editMessageText(
                ctx.chat.id,
                placeholder.message_id,
                "❌ Image generation failed. Please try again."
            )
            .catch(() => {});


    } finally {

        stopTyping();
    }
}


// ============================================================
// /START / HELP
// ============================================================

bot.command(
    ['start', 'help'],
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


            console.log(
                "✅ Start video cached."
            );


        } catch (error) {

            console.error(
                "Start video error:",
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
// /NEWCHAT / CLEAR
// ============================================================

bot.command(
    ['newchat', 'clear'],
    async (ctx) => {

        const chatId =
            ctx.chat.id.toString();


        try {

            await db.clearChatHistory(
                chatId
            );

        } catch (error) {

            console.error(
                "Clear history error:",
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
// /ABOUT
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
                "🎨 Give me an image prompt.\n\nExample:\n/imagine a futuristic BMW in a cyberpunk city at night"
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
// /FONT
// ============================================================

bot.command(
    ['font', 'fonts'],
    async (ctx) => {

        const text =
            ctx.match?.trim();


        if (!text) {

            await ctx.reply(
                "🔤 Font Generator\n\nUsage:\n/font Your Text\n\nExample:\n/font Utkarsh"
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
                    "Markdown"
            }
        );
    }
);


// ============================================================
// DOWNLOAD TELEGRAM PHOTO
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
            "Telegram did not return photo path."
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
            "Could not download Telegram photo."
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
// DOWNLOAD TELEGRAM FILE
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
            "Telegram did not return file path."
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
            "Could not download Telegram file."
        );
    }


    return Buffer.from(
        await response.arrayBuffer()
    );
}


// ============================================================
// /TEXT IMAGE EDITOR
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
                "🖼️ Reply to a photo with:\n\n/text Your Text\n\nExample:\n/text Utkarsh"
            );

            return;
        }


        if (!textToOverlay) {

            textToOverlay =
                "Utkarsh";
        }


        const placeholder =
            await ctx.reply(
                "✍️ Adding text to your image..."
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
                    "edited.jpg"
                ),
                {
                    caption:
                        `✨ Added "${textToOverlay}"\n\n👨‍💻 by @Utkarsh12011`
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
                "Image edit error:",
                error.message
            );


            await ctx.api
                .editMessageText(
                    ctx.chat.id,
                    placeholder.message_id,
                    "❌ I couldn't edit the image."
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


            // Save image temporarily

            pendingImages.set(
                chatId,
                {
                    buffer,
                    mimeType,
                    timestamp:
                        Date.now()
                }
            );


            // =================================================
            // PHOTO WITHOUT CAPTION
            // =================================================

            if (!caption) {

                await ctx.reply(
                    "🖼️ Got the image!\n\nAsk me something about it:\n\n• What is this?\n• Describe this image\n• What objects are visible?\n• Read the text\n• Explain this screenshot"
                );

                return;
            }


            // =================================================
            // PHOTO + /TEXT
            // =================================================

            const editCommand =
                caption.match(
                    /^\/(?:text|name|addtext|edit)(?:\s+(.*))?$/i
                );


            if (editCommand) {

                const textToOverlay =
                    editCommand[1]?.trim() ||
                    "Utkarsh";


                const placeholder =
                    await ctx.reply(
                        `✍️ Adding "${textToOverlay}" to your image...`
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
                            "edited.jpg"
                        ),
                        {
                            caption:
                                `✨ Added "${textToOverlay}"\n\n👨‍💻 by @Utkarsh12011`
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
                        "Photo edit error:",
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


            // =================================================
            // PHOTO + QUESTION
            // =================================================

            const placeholder =
                await ctx.reply(
                    "🖼️ Analyzing your image..."
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
                    "Photo analysis error:",
                    error.message
                );


                await ctx.api
                    .editMessageText(
                        ctx.chat.id,
                        placeholder.message_id,
                        "❌ I couldn't analyze that image right now."
                    )
                    .catch(() => {});


            } finally {

                stopTyping();
            }


        } catch (error) {

            console.error(
                "Photo handler error:",
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
                "🎭 Analyzing sticker..."
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
                        "Sticker thumbnail failed:",
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
                        "Sticker file failed:",
                        error.message
                    );
                }
            }


            if (!buffer) {

                throw new Error(
                    "No sticker preview available."
                );
            }


            const prompt = `
Analyze this Telegram sticker.

Explain:

🎭 What is shown
🙂 Emotion/expression
💭 What it communicates
💬 When it would be used
🎨 Important visual details

If text is visible, read it.

Do not invent details.

Keep the answer concise.
`;


            const answer =
                await analyzeImage(
                    buffer,
                    'image/png',
                    prompt
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
                "Sticker analysis error:",
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


        // Commands handled by bot.command()

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
        // PRIORITY 1
        // REPLY TO PHOTO
        // ====================================================

        if (
            repliedMessage?.photo
        ) {

            const placeholder =
                await ctx.reply(
                    "🖼️ Analyzing the image you replied to..."
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
                    "Reply image error:",
                    error.message
                );


                await ctx.api
                    .editMessageText(
                        ctx.chat.id,
                        placeholder.message_id,
                        "❌ I couldn't analyze the image you replied to."
                    )
                    .catch(() => {});


            } finally {

                stopTyping();
            }


            return;
        }


        // ====================================================
        // PRIORITY 2
        //
        // IMAGE GENERATION
        //
        // THIS MUST COME BEFORE NORMAL AI.
        // ====================================================

        if (
            isImageGenerationRequest(
                userMessage
            )
        ) {

            console.log(
                "🎨🎨🎨 IMAGE REQUEST DETECTED 🎨🎨🎨"
            );

            console.log(
                "User request:",
                userMessage
            );


            const prompt =
                extractImagePrompt(
                    userMessage
                );


            console.log(
                "Image prompt:",
                prompt
            );


            // DIRECTLY CALL HUGGING FACE
            // THROUGH image.js

            await generateAndSendImage(
                ctx,
                prompt
            );


            // DO NOT FALL THROUGH TO AI

            return;
        }


        // ====================================================
        // PRIORITY 3
        // PENDING IMAGE
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
                        "🖼️ Analyzing your image..."
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
                        "Pending image error:",
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
        // PRIORITY 4
        // NORMAL TEXT CHAT
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


            // =================================================
            // REPLY CONTEXT
            //
            // Works when replying to:
            // - your own text
            // - bot's text
            // =================================================

            let messageForAI =
                userMessage;


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

Answer the user's new message naturally and use the previous message as context when relevant.`;
                }
            }


            // =================================================
            // NORMAL AI
            // =================================================

            const answer =
                await generateAIResponse(
                    history,
                    messageForAI,
                    profile
                );


            // =================================================
            // SAVE CHAT
            // =================================================

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


            // =================================================
            // SEND ANSWER
            // =================================================

            await ctx.reply(
                answer
            );


        } catch (error) {

            console.error(
                "Normal text error:",
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
// CALLBACK: HELP
// ============================================================

bot.callbackQuery(
    "btn_help",
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


// ============================================================
// CALLBACK: NEW CHAT
// ============================================================

bot.callbackQuery(
    "btn_newchat",
    async (ctx) => {

        const chatId =
            ctx.chat.id.toString();


        try {

            await db.clearChatHistory(
                chatId
            );

        } catch (error) {

            console.error(
                "New chat error:",
                error.message
            );
        }


        pendingImages.delete(
            chatId
        );


        await ctx.answerCallbackQuery(
            "Chat cleared!"
        );


        await ctx.reply(
            "🧹 Fresh start! Your conversation history has been cleared."
        );
    }
);


// ============================================================
// CALLBACK: HISTORY
// ============================================================

bot.callbackQuery(
    "btn_history",
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
                    "📜 No conversation history yet."
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
                    .join(
                        '\n'
                    );


            await ctx.reply(
                `📜 Recent Conversation History\n\n${summary}`,
                {
                    reply_markup:
                        buildStartKeyboard()
                }
            );


        } catch (error) {

            console.error(
                "History error:",
                error.message
            );


            await ctx.reply(
                "❌ Couldn't load conversation history."
            );
        }
    }
);


// ============================================================
// CALLBACK: ABOUT
// ============================================================

bot.callbackQuery(
    "btn_about",
    async (ctx) => {

        await ctx.answerCallbackQuery();


        await ctx.reply(
            aboutMessage
        );
    }
);


// ============================================================
// CALLBACK: IMAGE LIBRARY
// ============================================================

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
                    "🎨 Your image library is empty.\n\nUse /imagine to create your first AI image!"
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
                "Library error:",
                error.message
            );


            await ctx.reply(
                "❌ Couldn't load your image library."
            );
        }
    }
);


// ============================================================
// CALLBACK: NO OP
// ============================================================

bot.callbackQuery(
    "btn_noop",
    async (ctx) => {

        await ctx.answerCallbackQuery();
    }
);


// ============================================================
// CALLBACK: BACK MENU
// ============================================================

bot.callbackQuery(
    "btn_backmenu",
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


// ============================================================
// CALLBACK: FONTS
// ============================================================

bot.callbackQuery(
    "btn_fonts_info",
    async (ctx) => {

        await ctx.answerCallbackQuery();


        await ctx.reply(
            "🔤 Font Generator\n\nUse:\n/font Your Text\n\nExample:\n/font Utkarsh"
        );
    }
);


// ============================================================
// CALLBACK: IMAGE EDITOR
// ============================================================

bot.callbackQuery(
    "btn_editor_info",
    async (ctx) => {

        await ctx.answerCallbackQuery();


        await ctx.reply(
            "🖼️ Image Editor\n\nReply to a photo with:\n/text Your Text"
        );
    }
);


// ============================================================
// CALLBACK: TIPS
// ============================================================

bot.callbackQuery(
    "btn_tips",
    async (ctx) => {

        await ctx.answerCallbackQuery();


        await ctx.reply(
            "⚡ ChatPro Tips\n\n• Ask normal questions\n• Reply to your own messages\n• Reply to bot messages\n• Send a photo and ask questions\n• Reply to a photo with a question\n• Send stickers for analysis\n• Ask naturally to generate an image\n• Use /imagine for direct image generation\n• Use /font for stylish text\n• Use /text for image editing"
        );
    }
);


// ============================================================
// CALLBACK: CREATOR
// ============================================================

bot.callbackQuery(
    "btn_creator",
    async (ctx) => {

        await ctx.answerCallbackQuery();


        await ctx.reply(
            "👨‍💻 Created by @Utkarsh12011\n\n🤖 ChatPro AI\n⚡ Think. Create. Explore."
        );
    }
);


// ============================================================
// BOT ERROR HANDLER
// ============================================================

bot.catch(
    (error) => {

        console.error(
            "❌ Bot error:",
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


// ============================================================
// START SERVER
// ============================================================

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
                "🤖 ChatPro AI bot started successfully!"
            );
        }
    )
    .catch(
        (error) => {

            console.error(
                "❌ Failed to start bot:",
                error
            );

            process.exit(1);
        }
    );


// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

process.once(
    'SIGINT',
    () => bot.stop()
);

process.once(
    'SIGTERM',
    () => bot.stop()
);
