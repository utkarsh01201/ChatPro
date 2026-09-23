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
// TELEGRAM TYPING INDICATOR
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

        clearInterval(
            interval
        );

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
Use /imagine [prompt] to generate AI images.

🖼️ Image Editor
Send or reply to any photo with /text [your text] to stamp your name on it!

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
// IMAGE GENERATION
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

        const chatId =
            ctx.chat.id.toString();

        const placeholder =
            await ctx.reply(
                "🎨 Creating your image with AI, please wait..."
            );

        const stopTyping =
            startTyping(ctx);

        try {

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
                    "Sorry, the image server is busy right now. Please try again in a moment!"
                )
                .catch(() => {});

        } finally {

            stopTyping();

        }

    }
);


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

    const url =
        `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

    const response =
        await fetch(url);

    if (!response.ok) {

        throw new Error(
            "Could not download photo from Telegram."
        );

    }

    const buffer =
        Buffer.from(
            await response.arrayBuffer()
        );

    return {
        buffer,
        mimeType: 'image/jpeg'
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
// GET STICKER PREVIEW
// ============================================================

async function getStickerPreview(
    ctx,
    sticker
) {

    // ========================================================
    // 1. DIRECT STICKER THUMBNAIL
    // ========================================================

    if (sticker.thumbnail?.file_id) {

        try {

            console.log(
                "🎭 Using Telegram sticker thumbnail."
            );


            const thumbnailBuffer =
                await downloadTelegramFile(
                    ctx,
                    sticker.thumbnail.file_id
                );


            const pngBuffer =
                await sharp(
                    thumbnailBuffer
                )
                    .png()
                    .toBuffer();


            return {
                buffer: pngBuffer,
                mimeType: 'image/png',
                sourceType:
                    sticker.is_animated
                        ? 'animated-preview'
                        : sticker.is_video
                            ? 'video-preview'
                            : 'static'
            };

        } catch (error) {

            console.log(
                "⚠️ Direct sticker thumbnail failed:",
                error.message
            );

        }

    }


    // ========================================================
    // 2. STICKER SET FALLBACK
    // ========================================================

    if (sticker.set_name) {

        try {

            console.log(
                `🎭 Trying sticker set preview: ${sticker.set_name}`
            );


            const stickerSet =
                await ctx.api.getStickerSet(
                    sticker.set_name
                );


            // ------------------------------------------------
            // Try to find the exact sticker again
            // ------------------------------------------------

            const matchingSticker =
                stickerSet.stickers?.find(
                    item =>
                        item.file_unique_id ===
                        sticker.file_unique_id
                );


            if (
                matchingSticker?.thumbnail?.file_id
            ) {

                const thumbnailBuffer =
                    await downloadTelegramFile(
                        ctx,
                        matchingSticker.thumbnail.file_id
                    );


                const pngBuffer =
                    await sharp(
                        thumbnailBuffer
                    )
                        .png()
                        .toBuffer();


                return {
                    buffer: pngBuffer,
                    mimeType: 'image/png',
                    sourceType:
                        sticker.is_animated
                            ? 'animated-preview'
                            : sticker.is_video
                                ? 'video-preview'
                                : 'static'
                };

            }


            // ------------------------------------------------
            // Try sticker-set thumbnail
            // ------------------------------------------------

            if (
                stickerSet.thumbnail?.file_id
            ) {

                const thumbnailBuffer =
                    await downloadTelegramFile(
                        ctx,
                        stickerSet.thumbnail.file_id
                    );


                const pngBuffer =
                    await sharp(
                        thumbnailBuffer
                    )
                        .png()
                        .toBuffer();


                return {
                    buffer: pngBuffer,
                    mimeType: 'image/png',
                    sourceType:
                        'sticker-set-preview'
                };

            }

        } catch (error) {

            console.log(
                "⚠️ Sticker set preview unavailable:",
                error.message
            );

        }

    }


    // ========================================================
    // 3. STATIC STICKER DIRECT FILE
    // ========================================================

    if (
        !sticker.is_animated &&
        !sticker.is_video
    ) {

        try {

            const stickerBuffer =
                await downloadTelegramFile(
                    ctx,
                    sticker.file_id
                );


            const pngBuffer =
                await sharp(
                    stickerBuffer
                )
                    .png()
                    .toBuffer();


            return {
                buffer: pngBuffer,
                mimeType: 'image/png',
                sourceType: 'static'
            };

        } catch (error) {

            console.log(
                "⚠️ Static sticker conversion failed:",
                error.message
            );

        }

    }


    // ========================================================
    // NO PREVIEW
    // ========================================================

    throw new Error(
        "Telegram did not provide an accessible preview for this sticker."
    );
}


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
                sticker.is_animated
                    ? "🎭 Studying your animated sticker..."
                    : sticker.is_video
                        ? "🎭 Studying your video sticker..."
                        : "🎭 Studying your sticker..."
            );


        const stopTyping =
            startTyping(ctx);


        try {

            const {
                buffer,
                mimeType,
                sourceType
            } =
                await getStickerPreview(
                    ctx,
                    sticker
                );


            const stickerType =
                sticker.is_animated
                    ? "animated TGS sticker"
                    : sticker.is_video
                        ? "video WEBM sticker"
                        : "static sticker";


            const stickerPrompt = `
You are ChatPro AI's sticker understanding system.

Study this Telegram ${stickerType} carefully.

IMPORTANT:
You are looking at the visual preview available from Telegram.

Do not invent animation or movement that is not visible in
the provided image.

Analyze the sticker like a human who understands internet
and chat culture.

Cover the useful details naturally:

🎭 What is shown
Explain the main character, person, animal, object or scene.

🙂 Expression
Explain the visible facial expression and emotion.

💭 Meaning
Explain what emotion, reaction or message the sticker
appears to communicate.

💬 Chat usage
Explain when someone might naturally use this sticker.

🎨 Visual details
Mention interesting colors, pose, clothing, objects,
style, text, symbols or other visible details.

If the sticker contains visible text, read it when possible.

If something is uncertain, say so instead of inventing it.

Make the answer:
• Natural
• Interesting
• Slightly entertaining
• Professional
• Concise but informative

Do not produce a giant report.

Use a short opening paragraph followed by useful sections
only where they improve readability.

Do not use Markdown headings.

Do not use:

#
##
###
**bold**
*italic*
---
> blockquotes

Use simple Telegram-friendly formatting.
`;


            const answer =
                await analyzeImage(
                    buffer,
                    mimeType,
                    stickerPrompt
                );


            const previewLabel =
                sourceType === 'animated-preview'
                    ? "🎞️ Animated sticker preview"
                    : sourceType === 'video-preview'
                        ? "🎬 Video sticker preview"
                        : sourceType === 'sticker-set-preview'
                            ? "🖼️ Sticker-set preview"
                            : "🖼️ Sticker";


            await ctx.api
                .editMessageText(
                    ctx.chat.id,
                    placeholder.message_id,
                    `🎭 Sticker Study\n${previewLabel}\n\n${answer}`
                )
                .catch(
                    async () => {

                        await ctx.reply(
                            `🎭 Sticker Study\n${previewLabel}\n\n${answer}`
                        );

                    }
                );


        } catch (error) {

            console.error(
                "Sticker analysis error:",
                error.message
            );


            const stickerType =
                sticker.is_animated
                    ? "animated"
                    : sticker.is_video
                        ? "video"
                        : "static";


            await ctx.api
                .editMessageText(
                    ctx.chat.id,
                    placeholder.message_id,
                    `🎭 I received your ${stickerType} sticker, but Telegram didn't provide an accessible preview for this particular sticker.\n\nTry sending another sticker from the same pack and I'll study it.`
                )
                .catch(() => {});


        } finally {

            stopTyping();

        }

    }
);


// ============================================================
// IMAGE EDITOR COMMAND
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
                    "Sorry, I couldn't edit the image. Please try again!"
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


            if (!caption) {

                await ctx.reply(
                    "🖼️ Got the image!\n\nAsk me something about it, for example:\n\n• What is this?\n• Describe this image\n• What objects are visible?\n• Read the text in this image\n• Explain this screenshot"
                );

                return;
            }


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
                            "Sorry, couldn't edit the image. Please try again!"
                        )
                        .catch(() => {});


                } finally {

                    stopTyping();

                }

                return;
            }


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
            "🧹 Fresh start! Your conversation history has been cleared. Say something to begin!"
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


            if (pages > 1) {

                await ctx.reply(
                    `📚 Image Library — Page ${page + 1}/${pages}`,
                    {
                        reply_markup:
                            buildLibraryKeyboard(
                                page,
                                pages
                            )
                    }
                );

            } else {

                await ctx.reply(
                    "📚 Image Library",
                    {
                        reply_markup:
                            buildLibraryKeyboard(
                                page,
                                pages || 1
                            )
                    }
                );

            }


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
// FONT INFO BUTTON
// ============================================================

bot.callbackQuery(
    "btn_fonts_info",
    async (ctx) => {

        await ctx.answerCallbackQuery();

        await ctx.reply(
            "🔤 Font Generator\n\nUse:\n/font Your Text\n\nExample:\n/font Utkarsh\n\nI'll generate multiple Unicode font styles for you."
        );

    }
);


// ============================================================
// IMAGE EDITOR INFO BUTTON
// ============================================================

bot.callbackQuery(
    "btn_editor_info",
    async (ctx) => {

        await ctx.answerCallbackQuery();

        await ctx.reply(
            "🖼️ Image Editor\n\nSend a photo with:\n/text Your Name\n\nOr reply to an existing photo with:\n/text Your Name"
        );

    }
);


// ============================================================
// TIPS BUTTON
// ============================================================

bot.callbackQuery(
    "btn_tips",
    async (ctx) => {

        await ctx.answerCallbackQuery();

        await ctx.reply(
            "⚡ ChatPro Tips\n\n• Ask follow-up questions naturally\n• Send a photo and ask what is in it\n• Send a static, animated or video sticker and I'll study its available preview\n• Use /imagine for AI images\n• Use /font for stylish text\n• Use /text to edit photos\n• Use /newchat for a fresh conversation"
        );

    }
);


// ============================================================
// CREATOR BUTTON
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
// NORMAL TEXT MESSAGE HANDLER
// ============================================================

bot.on(
    'message:text',
    async (ctx) => {

        const userMessage =
            ctx.message.text.trim();


        if (
            userMessage.startsWith('/')
        ) {

            return;

        }


        const chatId =
            ctx.chat.id.toString();


        // ----------------------------------------------------
        // PENDING IMAGE
        // ----------------------------------------------------

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
                            "❌ I couldn't analyze that image right now. Please try again."
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


        // ----------------------------------------------------
        // NORMAL AI CHAT
        // ----------------------------------------------------

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


            const answer =
                await generateAIResponse(
                    history,
                    userMessage,
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
// HEALTH SERVER FOR RENDER
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
// START HTTP SERVER
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
// START TELEGRAM BOT
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
