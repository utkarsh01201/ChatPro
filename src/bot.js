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
    analyzeImage,
    editImage
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

const bot =
    new Bot(
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
Reply to a photo or image file with an editing instruction.

Examples:
"add a person to the background"
"remove the car"
"change the background to a beach"
"make it PNG"
"convert it to WEBP"

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
            '❓ Help',
            'btn_help'
        )

        .text(
            '🆕 New Chat',
            'btn_newchat'
        )

        .row()

        .text(
            '📜 History',
            'btn_history'
        )

        .text(
            'ℹ️ About',
            'btn_about'
        )

        .row()

        .text(
            '🎨 Image Library',
            'btn_library_0'
        )

        .text(
            '🔤 Fonts',
            'btn_fonts_info'
        )

        .row()

        .text(
            '🖼️ Image Editor',
            'btn_editor_info'
        )

        .text(
            '⚡ Tips',
            'btn_tips'
        )

        .row()

        .text(
            '👨‍💻 Created By',
            'btn_creator'
        )

        .url(
            '🌟 Community',
            'https://t.me/shiddatXXSociety'
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
            '⬅️ Prev',
            `btn_library_${page - 1}`
        );
    }

    if (
        page > 0 &&
        page < totalPages - 1
    ) {

        keyboard.text(
            `${page + 1}/${totalPages}`,
            'btn_noop'
        );
    }

    if (
        page < totalPages - 1
    ) {

        keyboard.text(
            'Next ➡️',
            `btn_library_${page + 1}`
        );
    }

    keyboard
        .row()
        .text(
            '🏠 Back to Menu',
            'btn_backmenu'
        );

    return keyboard;
}


// ============================================================
// IMAGE GENERATION DETECTION
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

    const explicitImageRequest =
        /\b(generate|create|make|draw|design|produce)\b[\s\S]*\b(image|picture|photo|art|artwork|illustration|wallpaper|portrait|logo)\b/i
            .test(message)
        ||
        /\b(image|picture|photo|art|artwork|illustration|wallpaper|portrait|logo)\b[\s\S]*\b(generate|create|make|draw|design|produce)\b/i
            .test(message);

    if (explicitImageRequest) {
        return true;
    }

    const hindiImageRequest =
        /\b(image|photo|picture)\b[\s\S]*\b(bana|banao|banado|bana\s+do|generate|create|make)\b/i
            .test(message)
        ||
        /\b(bana|banao|banado|bana\s+do)\b[\s\S]*\b(image|photo|picture)\b/i
            .test(message);

    if (hindiImageRequest) {
        return true;
    }

    const generationVerb =
        /\b(generate|create|make|draw|design|render|paint)\b/i
            .test(message);

    if (!generationVerb) {
        return false;
    }

    const visualWords = [

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

    return (
        generationVerb &&
        hasVisualSubject
    );
}


// ============================================================
// IMAGE PROMPT EXTRACTION
// ============================================================

function extractImagePrompt(text) {

    let prompt =
        String(text || '').trim();

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

    prompt =
        prompt.replace(
            /\s+(karni|karna|karo|kar\s+do|bana|banao|banado|bana\s+do|do|hai)\s*$/i,
            ''
        );

    prompt =
        prompt.trim();

    if (!prompt) {
        prompt =
            String(text || '').trim();
    }

    return prompt;
}


// ============================================================
// IMAGE EDIT REQUEST DETECTION
// ============================================================

function isImageEditRequest(text) {

    const message =
        String(text || '')
            .toLowerCase()
            .trim()
            .replace(/\s+/g, ' ');

    if (!message) {
        return false;
    }

    const editPatterns = [

        /\b(add|remove|delete|erase|change|replace|modify|edit|alter|insert|put|move)\b/,

        /\b(background|bg)\b.*\b(change|replace|remove|add|put|make|blur|edit)\b/,

        /\b(change|replace|remove|add|put|make|blur|edit)\b.*\b(background|bg)\b/,

        /\bmake\b.*\bbackground\b/,

        /\bput\b.*\bbackground\b/,

        /\badd\b.*\bto the bg\b/,

        /\badd\b.*\bto the background\b/,

        /\bremove\b.*\bfrom the image\b/,

        /\bremove\b.*\bfrom the background\b/,

        /\bchange\b.*\bto\b/,

        /\bturn\b.*\binto\b/,

        /\breplace\b.*\bwith\b/,

        /\b(badal|badlo|change|hata|hatao|remove|jod|jodo|add|laga|lagao|daal|daalo)\b/,

        /\bbackground\b.*\b(badal|badlo|change)\b/,

        /\bbg\b.*\b(badal|badlo|change)\b/
    ];

    return editPatterns.some(
        pattern =>
            pattern.test(message)
    );
}


// ============================================================
// DETECT REQUESTED OUTPUT FORMAT
// ============================================================

function getRequestedImageFormat(
    instruction,
    originalMimeType = 'image/jpeg'
) {

    const text =
        String(
            instruction || ''
        ).toLowerCase();

    if (
        /\b(jpeg|jpg)\b/i.test(text)
    ) {
        return 'jpeg';
    }

    if (
        /\bpng\b/i.test(text)
    ) {
        return 'png';
    }

    if (
        /\bwebp\b/i.test(text)
    ) {
        return 'webp';
    }

    if (
        /\bavif\b/i.test(text)
    ) {
        return 'avif';
    }

    if (
        /\btiff?\b/i.test(text)
    ) {
        return 'tiff';
    }

    if (
        /\bgif\b/i.test(text)
    ) {
        return 'gif';
    }

    const mime =
        String(
            originalMimeType || ''
        ).toLowerCase();

    if (
        mime.includes('png')
    ) {
        return 'png';
    }

    if (
        mime.includes('webp')
    ) {
        return 'webp';
    }

    if (
        mime.includes('avif')
    ) {
        return 'avif';
    }

    if (
        mime.includes('tiff')
    ) {
        return 'tiff';
    }

    if (
        mime.includes('gif')
    ) {
        return 'gif';
    }

    return 'jpeg';
}


// ============================================================
// CONVERT EDITED IMAGE TO REQUESTED FORMAT
// ============================================================

async function convertEditedImage(
    buffer,
    format
) {

    const image =
        sharp(buffer);

    switch (format) {

        case 'png':

            return {
                buffer:
                    await image
                        .png()
                        .toBuffer(),

                extension:
                    'png',

                mimeType:
                    'image/png'
            };


        case 'webp':

            return {
                buffer:
                    await image
                        .webp({
                            quality:
                                95
                        })
                        .toBuffer(),

                extension:
                    'webp',

                mimeType:
                    'image/webp'
            };


        case 'avif':

            return {
                buffer:
                    await image
                        .avif({
                            quality:
                                90
                        })
                        .toBuffer(),

                extension:
                    'avif',

                mimeType:
                    'image/avif'
            };


        case 'tiff':

            return {
                buffer:
                    await image
                        .tiff({
                            quality:
                                95
                        })
                        .toBuffer(),

                extension:
                    'tiff',

                mimeType:
                    'image/tiff'
            };


        case 'gif':

            /*
             * Gemini returns a static image.
             * A true animated GIF cannot be reconstructed
             * from one Gemini output frame.
             *
             * Send a PNG instead so image quality is preserved.
             */

            return {
                buffer:
                    await image
                        .png()
                        .toBuffer(),

                extension:
                    'png',

                mimeType:
                    'image/png'
            };


        case 'jpeg':
        default:

            return {
                buffer:
                    await image
                        .jpeg({
                            quality:
                                95
                        })
                        .toBuffer(),

                extension:
                    'jpg',

                mimeType:
                    'image/jpeg'
            };
    }
}


// ============================================================
// SEND IMAGE IN THE MOST APPROPRIATE TELEGRAM FORMAT
// ============================================================

async function sendImageResult(
    ctx,
    imageBuffer,
    format,
    caption
) {

    const converted =
        await convertEditedImage(
            imageBuffer,
            format
        );


    // ========================================================
    // TELEGRAM PHOTO
    //
    // JPEG + PNG can be sent as photos.
    // Other formats are sent as documents so the
    // original requested file format is preserved.
    // ========================================================

    if (
        converted.mimeType === 'image/jpeg' ||
        converted.mimeType === 'image/png'
    ) {

        return await ctx.replyWithPhoto(
            new InputFile(
                converted.buffer,
                `edited.${converted.extension}`
            ),
            {
                caption
            }
        );
    }


    return await ctx.replyWithDocument(
        new InputFile(
            converted.buffer,
            `edited.${converted.extension}`
        ),
        {
            caption
        }
    );
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
        '=========================================='
    );

    console.log(
        '🎨 IMAGE GENERATION REQUEST'
    );

    console.log(
        '📝 User prompt:',
        prompt
    );

    console.log(
        '🚀 CALLING IMAGE GENERATOR...'
    );

    console.log(
        '=========================================='
    );

    const placeholder =
        await ctx.reply(
            '🎨 Creating your image...'
        );

    const stopTyping =
        startTyping(ctx);

    try {

        const result =
            await generateImage(
                prompt
            );

        if (
            !result ||
            !result.buffer
        ) {

            throw new Error(
                'No image buffer returned.'
            );
        }

        console.log(
            '✅ IMAGE GENERATED'
        );

        console.log(
            'Provider:',
            result.provider
        );

        const cleanPrompt =
            prompt.length > 250
                ? prompt.slice(0, 247) + '...'
                : prompt;

        const sent =
            await ctx.replyWithPhoto(
                new InputFile(
                    result.buffer,
                    'generated.jpg'
                ),
                {
                    caption:
                        `🎨 Generated with ${result.provider || 'AI'}\n\nPrompt: "${cleanPrompt}"\n\n👨‍💻 @Utkarsh12011`
                }
            );

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
                    'Image library save error:',
                    error.message
                );
            }
        }

        await ctx.api
            .deleteMessage(
                ctx.chat.id,
                placeholder.message_id
            )
            .catch(() => {});

    } catch (error) {

        console.error(
            '❌ IMAGE GENERATION ERROR:',
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
                'Start error:',
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
                'Clear error:',
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
                '🎨 Example:\n/imagine a futuristic city at night'
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
                '🔤 Usage:\n/font Your Text'
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

    const buffer =
        Buffer.from(
            await response.arrayBuffer()
        );

    let mimeType =
        'image/jpeg';

    try {

        const metadata =
            await sharp(
                buffer
            ).metadata();

        if (
            metadata.format === 'png'
        ) {
            mimeType =
                'image/png';
        } else if (
            metadata.format === 'webp'
        ) {
            mimeType =
                'image/webp';
        } else if (
            metadata.format === 'avif'
        ) {
            mimeType =
                'image/avif';
        } else if (
            metadata.format === 'tiff'
        ) {
            mimeType =
                'image/tiff';
        } else if (
            metadata.format === 'gif'
        ) {
            mimeType =
                'image/gif';
        } else if (
            metadata.format === 'heif' ||
            metadata.format === 'heic'
        ) {
            mimeType =
                'image/heic';
        } else if (
            metadata.format === 'jpeg'
        ) {
            mimeType =
                'image/jpeg';
        }

    } catch (error) {

        console.log(
            'Image format detection failed:',
            error.message
        );
    }

    return {
        buffer,
        mimeType
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
// TELEGRAM DOCUMENT IMAGE DOWNLOAD
// ============================================================

async function downloadTelegramImageDocument(
    ctx,
    document
) {

    if (!document?.file_id) {

        throw new Error(
            'No image document received.'
        );
    }

    const buffer =
        await downloadTelegramFile(
            ctx,
            document.file_id
        );

    let mimeType =
        document.mime_type ||
        '';

    try {

        const metadata =
            await sharp(
                buffer
            ).metadata();

        if (
            metadata.format === 'jpeg'
        ) {
            mimeType =
                'image/jpeg';
        } else if (
            metadata.format === 'png'
        ) {
            mimeType =
                'image/png';
        } else if (
            metadata.format === 'webp'
        ) {
            mimeType =
                'image/webp';
        } else if (
            metadata.format === 'avif'
        ) {
            mimeType =
                'image/avif';
        } else if (
            metadata.format === 'tiff'
        ) {
            mimeType =
                'image/tiff';
        } else if (
            metadata.format === 'gif'
        ) {
            mimeType =
                'image/gif';
        } else if (
            metadata.format === 'heif'
        ) {
            mimeType =
                'image/heif';
        }

    } catch (error) {

        console.log(
            'Document image format detection failed:',
            error.message
        );
    }

    if (
        !mimeType.startsWith(
            'image/'
        )
    ) {

        throw new Error(
            'The uploaded document is not a supported image.'
        );
    }

    return {
        buffer,
        mimeType
    };
}


// ============================================================
// OLD TEXT IMAGE EDITOR
// ============================================================

bot.command(
    [
        'text',
        'name',
        'addtext'
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
                '🖼️ Reply to a photo with:\n/text Your Text'
            );

            return;
        }

        if (!textToOverlay) {
            textToOverlay = 'Utkarsh';
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

            if (!caption) {

                await ctx.reply(
                    '🖼️ Got the image!\n\nAsk me something about it.'
                );

                return;
            }


            // =================================================
            // TEXT OVERLAY
            // =================================================

            const editCommand =
                caption.match(
                    /^\/(?:text|name|addtext)(?:\s+(.*))?$/i
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


            // =================================================
            // PHOTO + QUESTION
            // =================================================

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
// IMAGE DOCUMENT HANDLER
//
// Supports:
// JPG / JPEG
// PNG
// WEBP
// AVIF
// TIFF
// GIF
// HEIC / HEIF where Sharp supports decoding
// ============================================================

bot.on(
    'message:document',
    async (ctx) => {

        const document =
            ctx.message.document;

        const declaredMime =
            String(
                document.mime_type || ''
            ).toLowerCase();

        const filename =
            String(
                document.file_name || ''
            ).toLowerCase();

        const imageExtension =
            /\.(jpg|jpeg|png|webp|avif|tif|tiff|gif|bmp|heic|heif)$/i
                .test(filename);

        if (
            !declaredMime.startsWith('image/') &&
            !imageExtension
        ) {

            return;
        }

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
                await downloadTelegramImageDocument(
                    ctx,
                    document
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

            if (!caption) {

                await ctx.reply(
                    '🖼️ Got the image file!\n\nAsk me something about it or reply to this file with an editing instruction.'
                );

                return;
            }

            const placeholder =
                await ctx.reply(
                    '🖼️ Processing your image...'
                );

            const stopTyping =
                startTyping(ctx);

            try {

                if (
                    isImageEditRequest(
                        caption
                    )
                ) {

                    const result =
                        await editImage(
                            buffer,
                            mimeType,
                            caption
                        );

                    if (
                        !result ||
                        !result.buffer
                    ) {

                        throw new Error(
                            'No edited image returned.'
                        );
                    }

                    const outputFormat =
                        getRequestedImageFormat(
                            caption,
                            mimeType
                        );

                    await sendImageResult(
                        ctx,
                        result.buffer,
                        outputFormat,
                        `🎨 Edited with ${result.provider || 'Gemini 3.1 Flash Image'}\n\nFormat: ${outputFormat.toUpperCase()}\n\nEdit: "${caption.slice(0, 250)}"\n\n👨‍💻 @Utkarsh12011`
                    );

                    await ctx.api
                        .deleteMessage(
                            ctx.chat.id,
                            placeholder.message_id
                        )
                        .catch(() => {});

                } else {

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
                }

            } catch (error) {

                console.error(
                    'Document image processing error:',
                    error.message
                );

                await ctx.api
                    .editMessageText(
                        ctx.chat.id,
                        placeholder.message_id,
                        "❌ I couldn't process that image."
                    )
                    .catch(() => {});

            } finally {

                stopTyping();
            }

        } catch (error) {

            console.error(
                'Image document handler error:',
                error.message
            );

            await ctx.reply(
                "❌ I couldn't process that image file."
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
        // 1. REPLY TO PHOTO OR IMAGE DOCUMENT
        // ====================================================

        const repliedPhoto =
            repliedMessage?.photo;

        const repliedDocument =
            repliedMessage?.document;

        const repliedDocumentIsImage =
            repliedDocument &&
            (
                String(
                    repliedDocument.mime_type || ''
                )
                    .toLowerCase()
                    .startsWith('image/')
                ||
                /\.(jpg|jpeg|png|webp|avif|tif|tiff|gif|bmp|heic|heif)$/i
                    .test(
                        String(
                            repliedDocument.file_name || ''
                        )
                    )
            );

        if (
            repliedPhoto ||
            repliedDocumentIsImage
        ) {


            // =================================================
            // IMAGE EDITING
            // =================================================

            if (
                isImageEditRequest(
                    userMessage
                )
            ) {

                const placeholder =
                    await ctx.reply(
                        '🎨 Editing your image...'
                    );

                const stopTyping =
                    startTyping(ctx);

                try {

                    let buffer;
                    let mimeType;

                    if (repliedPhoto) {

                        const downloaded =
                            await downloadTelegramPhoto(
                                ctx,
                                repliedPhoto
                            );

                        buffer =
                            downloaded.buffer;

                        mimeType =
                            downloaded.mimeType;

                    } else {

                        const downloaded =
                            await downloadTelegramImageDocument(
                                ctx,
                                repliedDocument
                            );

                        buffer =
                            downloaded.buffer;

                        mimeType =
                            downloaded.mimeType;
                    }

                    console.log(
                        '🖼️ Source image MIME:',
                        mimeType
                    );


                    const result =
                        await editImage(
                            buffer,
                            mimeType,
                            userMessage
                        );

                    if (
                        !result ||
                        !result.buffer
                    ) {

                        throw new Error(
                            'No edited image returned.'
                        );
                    }


                    // =========================================
                    // FORMAT SELECTION
                    //
                    // User can explicitly say:
                    //
                    // "make it PNG"
                    // "convert to WEBP"
                    // "give JPG"
                    // "save as AVIF"
                    //
                    // Otherwise preserve the source format
                    // whenever possible.
                    // =========================================

                    const outputFormat =
                        getRequestedImageFormat(
                            userMessage,
                            mimeType
                        );

                    console.log(
                        '📦 Output format:',
                        outputFormat
                    );


                    const converted =
                        await convertEditedImage(
                            result.buffer,
                            outputFormat
                        );


                    const caption =
                        `🎨 Edited with ${result.provider || 'Gemini 3.1 Flash Image'}\n\nFormat: ${converted.extension.toUpperCase()}\n\nEdit: "${userMessage.slice(0, 250)}"\n\n👨‍💻 @Utkarsh12011`;


                    if (
                        converted.mimeType === 'image/jpeg' ||
                        converted.mimeType === 'image/png'
                    ) {

                        await ctx.replyWithPhoto(
                            new InputFile(
                                converted.buffer,
                                `edited.${converted.extension}`
                            ),
                            {
                                caption
                            }
                        );

                    } else {

                        await ctx.replyWithDocument(
                            new InputFile(
                                converted.buffer,
                                `edited.${converted.extension}`
                            ),
                            {
                                caption
                            }
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
                        '❌ Image edit error:',
                        error.message
                    );

                    await ctx.api
                        .editMessageText(
                            ctx.chat.id,
                            placeholder.message_id,
                            "❌ I couldn't edit that image right now. Please try again."
                        )
                        .catch(() => {});

                } finally {

                    stopTyping();
                }

                return;
            }


            // =================================================
            // NORMAL IMAGE ANALYSIS
            // =================================================

            const placeholder =
                await ctx.reply(
                    '🖼️ Analyzing the image you replied to...'
                );

            const stopTyping =
                startTyping(ctx);

            try {

                let buffer;
                let mimeType;

                if (repliedPhoto) {

                    const downloaded =
                        await downloadTelegramPhoto(
                            ctx,
                            repliedPhoto
                        );

                    buffer =
                        downloaded.buffer;

                    mimeType =
                        downloaded.mimeType;

                } else {

                    const downloaded =
                        await downloadTelegramImageDocument(
                            ctx,
                            repliedDocument
                        );

                    buffer =
                        downloaded.buffer;

                    mimeType =
                        downloaded.mimeType;
                }

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

            await generateAndSendImage(
                ctx,
                prompt
            );

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
                '❌ Something went wrong while processing your message. Please try again.'
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
            '🖼️ Reply to a photo or image file with:\n"add a person to the background"\n"remove the car"\n"change the background"\n\nYou can also request:\n"make it PNG"\n"convert to WEBP"\n"save as AVIF"\n\nOr use:\n/text Your Text'
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
• Reply to photos with editing instructions
• Send JPG / PNG / WEBP / AVIF / TIFF image files
• Reply to image files with editing instructions
• Ask for PNG / JPG / WEBP / AVIF / TIFF output
• Send stickers for analysis
• Ask to generate/create/make/draw visual content
• Use /imagine for direct image generation
• Use /font for fonts
• Use /text for text overlay`
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
