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
// PENDING IMAGES
// ============================================================

const pendingImages = new Map();

const IMAGE_EXPIRY =
    5 * 60 * 1000;


// ============================================================
// TYPING INDICATOR
// ============================================================

function startTyping(ctx) {

    const sendTyping = () => {

        if (!ctx.chat?.id) return;

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
// MESSAGES
// ============================================================

const startMessage = `🤖 ChatPro AI — Help

Here's what I can help you with:

💬 Chat
Have natural conversations and ask questions.

💻 Code
Get programming help, explanations and debugging assistance.

📚 Learn
Understand difficult topics in a simple way.

✍️ Create
Write, rewrite, brainstorm and improve your content.

🧠 Explore
Discuss ideas, solve problems and discover new possibilities.

🖼️ Image Understanding
Send me a photo and ask questions about it.

🎭 Sticker Understanding
Send me a sticker and I'll study its character, emotion, design and meaning.

🎨 Image Generation
Use /imagine [prompt] or simply ask me to create an image.

🖼️ Image Editor
Send or reply to any photo with /text [your text] to add text.

🔤 Font Styles
Use /font [text] to stylize any text.

━━━━━━━━━━━━━━━━━━

Commands:

/start — Start ChatPro AI
/help — View available features
/newchat — Start a fresh conversation
/clear — Clear current conversation
/font [text] — Generate fancy fonts
/imagine [prompt] — Generate an AI image
/text [name] — Add text to a photo
/about — About ChatPro AI

🌟 Community
👉 @shiddatXXSociety`;


const aboutMessage = `🤖 ChatPro AI

Think. Create. Explore. ⚡
Your AI. Your space. Your possibilities.

💬 Chat • 💻 Code • 📚 Learn • 🖼️ Vision • 🎭 Stickers • 🎨 Create

🚀 Built for what's next.

👨‍💻 @Utkarsh12011
🌟 @shiddatXXSociety`;


// ============================================================
// KEYBOARDS
// ============================================================

function buildStartKeyboard() {

    return new InlineKeyboard()

        .text("❓ Help", "btn_help")
        .text("🆕 New Chat", "btn_newchat")

        .row()

        .text("📜 History", "btn_history")
        .text("ℹ️ About", "btn_about")

        .row()

        .text("🎨 Image Library", "btn_library_0")
        .text("🔤 Fonts", "btn_fonts_info")

        .row()

        .text("🖼️ Image Editor", "btn_editor_info")
        .text("⚡ Tips", "btn_tips")

        .row()

        .text("👨‍💻 Created By", "btn_creator")
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

    const hasPrev =
        page > 0;

    const hasNext =
        page < totalPages - 1;

    if (hasPrev) {

        keyboard.text(
            "⬅️ Prev",
            `btn_library_${page - 1}`
        );

    }

    if (hasPrev && hasNext) {

        keyboard.text(
            `${page + 1}/${totalPages}`,
            "btn_noop"
        );

    }

    if (hasNext) {

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
// START / HELP
// ============================================================

let cachedVideoFileId = null;

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
                        caption: startMessage,
                        reply_markup: keyboard
                    }
                );

            } else {

                const videoPath =
                    path.join(
                        __dirname,
                        '..',
                        'keep_only_last_seconds.mp4'
                    );

                const sent =
                    await ctx.replyWithVideo(
                        new InputFile(videoPath),
                        {
                            caption: startMessage,
                            reply_markup: keyboard
                        }
                    );

                cachedVideoFileId =
                    sent.video.file_id;

                console.log(
                    "✅ Video file_id cached."
                );
            }

        } catch (error) {

            console.error(
                "Failed to send video:",
                error.message
            );

            await ctx.reply(
                startMessage,
                {
                    reply_markup: keyboard
                }
            );
        }
    }
);


// ============================================================
// NEW CHAT / CLEAR
// ============================================================

bot.command(
    ['newchat', 'clear'],
    async (ctx) => {

        const chatId =
            ctx.chat.id.toString();

        await db.clearChatHistory(
            chatId
        );

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
// IMAGE GENERATION COMMAND
// ============================================================

bot.command(
    'imagine',
    async (ctx) => {

        const prompt =
            ctx.match?.trim();

        if (!prompt) {

            return ctx.reply(
                "Please provide a prompt after /imagine\n\nExample:\n/imagine a futuristic city at night"
            );
        }

        await generateAndSendImage(
            ctx,
            prompt
        );
    }
);


// ============================================================
// AUTOMATIC IMAGE GENERATION DETECTION
// ============================================================

function isImageGenerationRequest(text) {

    const message =
        text.toLowerCase().trim();

    const patterns = [

        /\bcreate\s+(an?\s+)?(image|picture|photo|art|artwork)\b/i,

        /\bgenerate\s+(an?\s+)?(image|picture|photo|art|artwork)\b/i,

        /\bmake\s+(an?\s+)?(image|picture|photo|art|artwork)\b/i,

        /\bcreate\s+me\s+(a|an)?\s*/i,

        /\bgenerate\s+me\s+(a|an)?\s*/i,

        /\bmake\s+me\s+(a|an)?\s*/i,

        /\bdraw\s+(an?\s+)?(image|picture|photo|art|artwork)?/i,

        /\bshow\s+me\s+(an?\s+)?(image|picture|photo)\b/i

    ];

    return patterns.some(
        pattern =>
            pattern.test(message)
    );
}


// ============================================================
// EXTRACT IMAGE PROMPT
// ============================================================

function extractImagePrompt(text) {

    let prompt =
        text.trim();

    prompt =
        prompt.replace(
            /^(please\s+)?(create|generate|make|draw)\s+(me\s+)?(an?\s+)?(image|picture|photo|art|artwork)\s*(of|showing|with|:)?\s*/i,
            ''
        );

    prompt =
        prompt.replace(
            /^(please\s+)?(create|generate|make|draw)\s+me\s*/i,
            ''
        );

    return prompt.trim() || text.trim();
}


// ============================================================
// GENERATE + SEND IMAGE
// ============================================================

async function generateAndSendImage(
    ctx,
    prompt
) {

    const chatId =
        ctx.chat.id.toString();

    const placeholder =
        await ctx.reply(
            "🎨 Creating your image with AI, please wait..."
        );

    const stopTyping =
        startTyping(ctx);

    try {

        console.log(
            `🎨 Image generation request: ${prompt}`
        );

        const {
            buffer,
            provider
        } =
            await generateImage(
                prompt
            );

        const cleanPrompt =
            prompt.length > 200
                ? prompt.slice(0, 197) + '...'
                : prompt;

        const sent =
            await ctx.replyWithPhoto(
                new InputFile(
                    buffer,
                    'generated.jpg'
                ),
                {
                    caption:
                        `🎨 Generated with ${provider}\n\nPrompt: "${cleanPrompt}"\n\n👨‍💻 by @Utkarsh12011`
                }
            );

        const fileId =
            sent.photo?.[
                sent.photo.length - 1
            ]?.file_id || '';

        if (fileId) {

            await db.saveImageToLibrary(
                chatId,
                prompt,
                fileId
            );
        }

        await ctx.api
            .deleteMessage(
                ctx.chat.id,
                placeholder.message_id
            )
            .catch(() => {});

    } catch (error) {

        console.error(
            "Image generation error:",
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
// FONT GENERATOR
// ============================================================

bot.command(
    ['font', 'fonts'],
    async (ctx) => {

        const text =
            ctx.match?.trim();

        if (!text) {

            return ctx.reply(
                "🔤 Font Generator\n\nUsage:\n/font [your text]\n\nExample:\n/font Utkarsh\n/font Hello World"
            );
        }

        const styles =
            getAllFontStyles(text);

        const formatted =
            styles
                .map(
                    style =>
                        `${style.name}:\n\`${style.text}\``
                )
                .join('\n\n');

        await ctx.reply(
            `🔤 *Stylized Fonts for:* "${text}"\n\n💡 _Tap any text to copy directly:_\n\n${formatted}`,
            {
                parse_mode: "Markdown"
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

    const url =
        `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

    const response =
        await fetch(url);

    if (!response.ok) {

        throw new Error(
            "Could not download photo from Telegram."
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
            "Telegram did not return a file path."
        );
    }

    const url =
        `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

    const response =
        await fetch(url);

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
// IMAGE EDITOR
// ============================================================

bot.command(
    ['text', 'name', 'addtext'],
    async (ctx) => {

        let textToOverlay =
            ctx.match?.trim();

        const replyPhoto =
            ctx.message
                .reply_to_message
                ?.photo;

        if (!replyPhoto) {

            return ctx.reply(
                "🖼️ *Image Editor*\n\nReply to any photo with:\n`/text Your Name`\n\nOr send a photo with caption:\n`/text Your Name`",
                {
                    parse_mode: "Markdown"
                }
            );
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
                    'edited.jpg'
                ),
                {
                    caption:
                        `✨ Edited Image with "${textToOverlay}"\n\n👨‍💻 by @Utkarsh12011`
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
                "Edit error:",
                error.message
            );

            await ctx.api
                .editMessageText(
                    ctx.chat.id,
                    placeholder.message_id,
                    "❌ Sorry, I couldn't edit the image."
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
            ctx.message.caption?.trim() || '';

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
                    timestamp: Date.now()
                }
            );

            // ------------------------------------------------
            // NO CAPTION
            // ------------------------------------------------

            if (!caption) {

                await ctx.reply(
                    "🖼️ Got the image!\n\nAsk me something about it, for example:\n\n• What is this?\n• Describe this image\n• What objects are visible?\n• Read the text in this image\n• Explain this screenshot"
                );

                return;
            }

            // ------------------------------------------------
            // PHOTO + /TEXT
            // ------------------------------------------------

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
                            'edited.jpg'
                        ),
                        {
                            caption:
                                `✨ Added "${textToOverlay}" to your image!\n\n👨‍💻 by @Utkarsh12011`
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

            // ------------------------------------------------
            // PHOTO + QUESTION
            // ------------------------------------------------

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
                    "Image analysis error:",
                    error.message
                );

                await ctx.api
                    .editMessageText(
                        ctx.chat.id,
                        placeholder.message_id,
                        "❌ I couldn't analyze this image right now. Please try again."
                    )
                    .catch(() => {});

            } finally {

                stopTyping();
            }

        } catch (error) {

            console.error(
                "Photo download error:",
                error.message
            );

            await ctx.reply(
                "❌ I couldn't process that image. Please try sending it again."
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
                "🎭 Studying your sticker..."
            );

        const stopTyping =
            startTyping(ctx);

        try {

            let buffer = null;

            let mimeType =
                'image/png';

            // Try thumbnail first
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

            // Static sticker fallback
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
                    "No accessible sticker preview."
                );
            }

            const prompt = `
Analyze this Telegram sticker.

Explain:

🎭 What is shown

🙂 Facial expression and emotion

💭 What the sticker communicates

💬 When someone would naturally use it in chat

🎨 Important visual details

If there is visible text, read it.

If something is uncertain, say so.

Do not invent details.

Keep the answer concise and natural.

Use Telegram-friendly plain text.
`;

            const answer =
                await analyzeImage(
                    buffer,
                    mimeType,
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
                    "❌ I couldn't access the sticker preview. Try sending it as a photo."
                )
                .catch(() => {});

        } finally {

            stopTyping();
        }
    }
);


// ============================================================
// HELP BUTTON
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
// NEW CHAT BUTTON
// ============================================================

bot.callbackQuery(
    "btn_newchat",
    async (ctx) => {

        const chatId =
            ctx.chat.id.toString();

        await db.clearChatHistory(
            chatId
        );

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
// HISTORY BUTTON
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

                return ctx.reply(
                    "📜 No conversation history yet. Start chatting to build your history!"
                );
            }

            const recent =
                chatDoc.messages.slice(-10);

            const summary =
                recent
                    .map(
                        message =>
                            `${message.role === 'user' ? '👤 You' : '🤖 AI'}: ${message.text.slice(0, 80)}${message.text.length > 80 ? '...' : ''}`
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
                "History error:",
                error.message
            );

            await ctx.reply(
                "❌ Couldn't load your conversation history right now."
            );
        }
    }
);


// ============================================================
// ABOUT BUTTON
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
// IMAGE LIBRARY
// ============================================================

bot.callbackQuery(
    /^btn_library_(\d+)$/,
    async (ctx) => {

        await ctx.answerCallbackQuery();

        const page =
            Number(ctx.match[1]) || 0;

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

                return ctx.reply(
                    "🎨 Your image library is empty.\n\nUse /imagine to create your first AI image!"
                );
            }

            for (
                const image
                of images
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
// NO-OP BUTTON
// ============================================================

bot.callbackQuery(
    "btn_noop",
    async (ctx) => {

        await ctx.answerCallbackQuery();
    }
);


// ============================================================
// BACK TO MENU
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
// FONT INFO
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
// EDITOR INFO
// ============================================================

bot.callbackQuery(
    "btn_editor_info",
    async (ctx) => {

        await ctx.answerCallbackQuery();

        await ctx.reply(
            "🖼️ Image Editor\n\nSend a photo with:\n/text Your Name\n\nOr reply to a photo with:\n/text Your Name"
        );
    }
);


// ============================================================
// TIPS
// ============================================================

bot.callbackQuery(
    "btn_tips",
    async (ctx) => {

        await ctx.answerCallbackQuery();

        await ctx.reply(
            "⚡ ChatPro Tips\n\n• Ask follow-up questions naturally\n• Send a photo and ask what is in it\n• Reply to a photo with a question\n• Send a sticker to analyze it\n• Ask naturally to create an image\n• Use /imagine for direct image generation\n• Use /font for stylish text\n• Use /text to edit photos"
        );
    }
);


// ============================================================
// CREATOR
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
// TEXT MESSAGE HANDLER
// ============================================================

bot.on(
    'message:text',
    async (ctx) => {

        const userMessage =
            ctx.message.text.trim();

        // Ignore commands
        if (
            userMessage.startsWith('/')
        ) {

            return;
        }

        const chatId =
            ctx.chat.id.toString();


        // ====================================================
        // REPLY TO A PHOTO
        // ====================================================

        const repliedMessage =
            ctx.message.reply_to_message;

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
                    "Reply image analysis error:",
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
        // AUTOMATIC IMAGE GENERATION
        // ====================================================

        if (
            isImageGenerationRequest(
                userMessage
            )
        ) {

            const prompt =
                extractImagePrompt(
                    userMessage
                );

            await generateAndSendImage(
                ctx,
                prompt
            );

            return;
        }


        // ====================================================
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
                        "Pending image analysis error:",
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

                return;
            }

            pendingImages.delete(
                chatId
            );
        }


        // ====================================================
        // NORMAL AI CHAT
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


            // ------------------------------------------------
            // REPLY CONTEXT
            // ------------------------------------------------

            let messageForAI =
                userMessage;

            if (
                repliedMessage?.text
            ) {

                messageForAI =
                    `The user is replying to this previous message:

"${repliedMessage.text.slice(0, 4000)}"

Now answer the user's new message:

${userMessage}`;
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
                        role: 'user',
                        text: userMessage
                    },
                    {
                        role: 'model',
                        text: answer
                    }
                ]
            );


            await ctx.reply(
                answer
            );

        } catch (error) {

            console.error(
                "Text chat error:",
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
    Number(process.env.PORT) || 3000;

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

bot.start({
    drop_pending_updates: true
})
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
