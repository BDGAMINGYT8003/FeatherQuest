const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config.js');
const database = require('./database/database.js');
const { setupCooldowns } = require('./utils/cooldowns.js');

// Create a new client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Initialize collections
client.commands = new Collection();
client.cooldowns = new Collection();

// Setup database
database.initializeDatabase();

// Setup cooldowns
setupCooldowns(client);

// Load command handlers
const commandHandler = require('./handlers/commandHandler.js');
commandHandler.loadCommands(client);

// Load event handlers
const eventHandler = require('./handlers/eventHandler.js');
eventHandler.loadEvents(client);

// Error handling
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
    process.exit(1);
});

// Login to Discord
client.login(config.token);
