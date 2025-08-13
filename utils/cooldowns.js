const { Collection } = require('discord.js');

function setupCooldowns(client) {
    client.cooldowns = new Collection();
}

function getCooldown(client, command, user) {
    if (!client.cooldowns.has(command.data.name)) {
        client.cooldowns.set(command.data.name, new Collection());
    }

    const now = Date.now();
    const timestamps = client.cooldowns.get(command.data.name);
    const cooldownAmount = (command.cooldown || 3) * 1000;

    if (timestamps.has(user.id)) {
        const expirationTime = timestamps.get(user.id) + cooldownAmount;

        if (now < expirationTime) {
            const timeLeft = (expirationTime - now) / 1000;
            return timeLeft;
        }
    }

    return null;
}

function setCooldown(client, command, user) {
    const timestamps = client.cooldowns.get(command.data.name);
    const now = Date.now();
    timestamps.set(user.id, now);
}

module.exports = {
    setupCooldowns,
    getCooldown,
    setCooldown
};
