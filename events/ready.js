const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const config = require('../config.js');

module.exports = {
    name: 'ready',
    once: true,
    execute(client) {
        console.log(`Ready! Logged in as ${client.user.tag}`);

        const rest = new REST({ version: '10' }).setToken(config.token);

        (async () => {
            try {
                console.log('Started refreshing application (/) commands.');

                const commands = client.commands.map(command => command.data.toJSON());

                await rest.put(
                    Routes.applicationCommands(client.user.id),
                    { body: commands },
                );

                console.log('Successfully reloaded application (/) commands.');
            } catch (error) {
                console.error(error);
            }
        })();
    },
};
