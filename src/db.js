const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch((err) => console.error('❌ MongoDB Connection Error:', err));

// Define Schema for Chat History
const chatHistorySchema = new mongoose.Schema({
    chatId: { type: String, required: true, unique: true },
    messages: [
        {
            role: { type: String, enum: ['user', 'model'], required: true },
            text: { type: String, required: true }
        }
    ]
});

const ChatHistory = mongoose.model('ChatHistory', chatHistorySchema);

// --- Image Library Schema ---
const imageLibrarySchema = new mongoose.Schema({
    chatId: { type: String, required: true },
    prompt: { type: String, required: true },
    imageUrl: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});
const ImageLibrary = mongoose.model('ImageLibrary', imageLibrarySchema);

async function saveImageToLibrary(chatId, prompt, imageUrl) {
    const entry = new ImageLibrary({ chatId, prompt, imageUrl });
    await entry.save();
}

async function getImageLibrary(chatId, page = 0, perPage = 5) {
    const total = await ImageLibrary.countDocuments({ chatId });
    const images = await ImageLibrary.find({ chatId })
        .sort({ createdAt: -1 })
        .skip(page * perPage)
        .limit(perPage);
    return { images, total, pages: Math.ceil(total / perPage) };
}

// --- Permanent User Profile & Long-Term Memory ---
const userProfileSchema = new mongoose.Schema({
    chatId: { type: String, required: true, unique: true },
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    username: { type: String, default: '' },
    preferredName: { type: String, default: '' },
    facts: [{ type: String }],
    lastSeen: { type: Date, default: Date.now }
});
const UserProfile = mongoose.model('UserProfile', userProfileSchema);

const profileCache = new Map();

async function getOrCreateUserProfile(chatId, from = {}) {
    if (profileCache.has(chatId)) {
        const cached = profileCache.get(chatId);
        if (from.first_name && !cached.firstName) cached.firstName = from.first_name;
        if (from.username && !cached.username) cached.username = from.username;
        return cached;
    }

    let profile = await UserProfile.findOne({ chatId });
    if (!profile) {
        profile = new UserProfile({
            chatId,
            firstName: from.first_name || '',
            lastName: from.last_name || '',
            username: from.username || '',
            preferredName: from.first_name || '',
            facts: []
        });
        await profile.save();
    } else {
        let changed = false;
        if (from.first_name && profile.firstName !== from.first_name) {
            profile.firstName = from.first_name;
            if (!profile.preferredName) profile.preferredName = from.first_name;
            changed = true;
        }
        if (from.username && profile.username !== from.username) {
            profile.username = from.username;
            changed = true;
        }
        if (changed) await profile.save();
    }

    profileCache.set(chatId, profile);
    return profile;
}

async function addFactToProfile(chatId, fact) {
    const profile = await getOrCreateUserProfile(chatId);
    if (!profile.facts.includes(fact)) {
        profile.facts.push(fact);
        profileCache.set(chatId, profile);
        await UserProfile.updateOne({ chatId }, { $addToSet: { facts: fact } });
    }
}

// In-memory cache for ultra-fast history fetching
const historyCache = new Map();

// Helper functions
async function getChatHistory(chatId) {
    // Return instantly if we have it in memory!
    if (historyCache.has(chatId)) {
        return historyCache.get(chatId);
    }
    
    let chat = await ChatHistory.findOne({ chatId });
    if (!chat) {
        chat = new ChatHistory({ chatId, messages: [] });
        await chat.save();
    }
    
    historyCache.set(chatId, chat);
    return chat;
}

async function addMessages(chatId, newMessages) {
    let chat = await getChatHistory(chatId);
    chat.messages.push(...newMessages);
    
    // Await the save to prevent ParallelSaveErrors
    await chat.save();
}

async function clearChatHistory(chatId) {
    historyCache.delete(chatId);
    // Delete in background
    ChatHistory.deleteOne({ chatId }).catch(e => console.error("DB Delete Error:", e));
}

module.exports = {
    ChatHistory,
    UserProfile,
    getChatHistory,
    addMessages,
    clearChatHistory,
    saveImageToLibrary,
    getImageLibrary,
    getOrCreateUserProfile,
    addFactToProfile
};
