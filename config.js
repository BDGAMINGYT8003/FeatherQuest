require('dotenv').config();

module.exports = {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.CLIENT_ID,
    guildId: process.env.GUILD_ID,
    ownerId: process.env.OWNER_ID,
    
    // Economy settings
    economy: {
        startingBalance: 100,
        dailyWorkMin: 50,
        dailyWorkMax: 200,
        huntCost: 10,
        huntReward: { min: 25, max: 100 },
        tradeFee: 0.05, // 5% fee
        bankInterestRate: 0.02, // 2% daily
        maxBankBalance: 1000000
    },
    
    // Cooldowns (in milliseconds)
    cooldowns: {
        hunt: 30 * 60 * 1000, // 30 minutes
        work: 24 * 60 * 60 * 1000, // 24 hours
        observe: 2 * 60 * 60 * 1000, // 2 hours
        trade: 5 * 60 * 1000, // 5 minutes
        minigame: 10 * 60 * 1000 // 10 minutes
    },
    
    // Bird rarity weights
    birdRarity: {
        common: 60,
        uncommon: 25,
        rare: 10,
        epic: 4,
        legendary: 1
    },
    
    // Colors for embeds
    colors: {
        primary: 0x0099FF,
        success: 0x00FF00,
        warning: 0xFFFF00,
        error: 0xFF0000,
        info: 0x808080,
        rare: 0x800080,
        epic: 0xFF4500,
        legendary: 0xFFD700
    }
};
