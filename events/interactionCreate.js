const { InteractionType } = require('discord.js');
const { getCooldown, setCooldown } = require('../utils/cooldowns.js');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (interaction.type !== InteractionType.ApplicationCommand) {
            return;
        }

        const command = client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            await interaction.reply({ content: 'Error: This command does not exist.', ephemeral: true });
            return;
        }

        // Cooldown logic
        const cooldown = getCooldown(client, command, interaction.user);
        if (cooldown) {
            await interaction.reply({ content: `Please wait ${cooldown.toFixed(1)} more second(s) before reusing the \`${command.data.name}\` command.`, ephemeral: true });
            return;
        }
        setCooldown(client, command, interaction.user);

        try {
            await command.execute(interaction, client);
        } catch (error) {
            console.error(`Error executing ${interaction.commandName}`);
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
            } else {
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
            }
        }
    },
};
