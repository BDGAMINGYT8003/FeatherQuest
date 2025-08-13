const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ContainerBuilder, SectionBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { userOps, birdOps, transactionOps } = require('../../database/database.js');
const { createUserIfNotExists } = require('../../utils/economy.js');
const { setCooldown, getCooldown } = require('../../utils/cooldowns.js');
const config = require('../../config.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('observe')
        .setDescription('Spend time observing one of your birds to strengthen your bond')
        .addIntegerOption(option =>
            option.setName('bird_id')
                .setDescription('The ID of the bird you want to observe')
                .setRequired(true)),
    
    async execute(interaction) {
        try {
            await createUserIfNotExists(interaction.user.id, interaction.user.username);
            
            // Check cooldown
            const cooldownTime = getCooldown(interaction.user.id, 'observe');
            if (cooldownTime > 0) {
                const minutes = Math.ceil(cooldownTime / (1000 * 60));
                
                const errorContainer = new ContainerBuilder()
                    .setAccentColor(config.colors.warning)
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent(`⏰ **Observation Cooldown**\n\nYou need to wait **${minutes} minutes** before observing again.\n\nTake a break and let your previous observations settle in!`)
                    );
                
                return await interaction.reply({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2,
                    ephemeral: true
                });
            }
            
            const birdId = interaction.options.getInteger('bird_id');
            
            // Get the bird
            const bird = birdOps.getBird.get(birdId, interaction.user.id);
            
            if (!bird) {
                const errorContainer = new ContainerBuilder()
                    .setAccentColor(config.colors.error)
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent('❌ **Bird Not Found**\n\nYou don\'t have a bird with that ID in your collection.\n\nUse `/album` to see your birds and their IDs.')
                    );
                
                return await interaction.reply({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2,
                    ephemeral: true
                });
            }
            
            // Check if bird was observed recently (max 3 observations per day per bird)
            const lastObserved = bird.last_observed ? new Date(bird.last_observed) : null;
            const now = new Date();
            const daysSinceObserved = lastObserved ? (now - lastObserved) / (1000 * 60 * 60 * 24) : 1;
            
            if (lastObserved && daysSinceObserved < 0.33) { // Less than 8 hours
                const hoursLeft = Math.ceil(8 - (daysSinceObserved * 24));
                
                const errorContainer = new ContainerBuilder()
                    .setAccentColor(config.colors.warning)
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent(`🕐 **Bird Needs Rest**\n\n**${bird.custom_name || bird.name}** was observed recently and needs time to rest.\n\nYou can observe this bird again in **${hoursLeft} hours**.\n\nTry observing a different bird from your collection!`)
                    );
                
                return await interaction.reply({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2,
                    ephemeral: true
                });
            }
            
            // Create observation modal
            const modal = new ModalBuilder()
                .setCustomId(`observe_modal_${birdId}`)
                .setTitle(`Observing ${bird.custom_name || bird.name}`);
            
            const observationInput = new TextInputBuilder()
                .setCustomId('observation_notes')
                .setLabel('What did you observe about this bird?')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Describe the bird\'s behavior, appearance, or any interesting details you noticed...')
                .setRequired(true)
                .setMinLength(10)
                .setMaxLength(500);
            
            const timeSpentInput = new TextInputBuilder()
                .setCustomId('time_spent')
                .setLabel('How many minutes did you observe? (15-120)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('30')
                .setRequired(true)
                .setMinLength(2)
                .setMaxLength(3);
            
            const firstActionRow = new ActionRowBuilder().addComponents(observationInput);
            const secondActionRow = new ActionRowBuilder().addComponents(timeSpentInput);
            
            modal.addComponents(firstActionRow, secondActionRow);
            
            await interaction.showModal(modal);
            
        } catch (error) {
            console.error('Error in observe command:', error);
            
            const errorContainer = new ContainerBuilder()
                .setAccentColor(config.colors.error)
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('❌ **Error**\n\nSomething went wrong while setting up the observation. Please try again.')
                );
            
            await interaction.reply({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
        }
    },
    
    async handleModal(interaction) {
        try {
            const birdId = parseInt(interaction.customId.split('_')[2]);
            const observationNotes = interaction.fields.getTextInputValue('observation_notes');
            const timeSpentRaw = interaction.fields.getTextInputValue('time_spent');
            
            // Validate time spent
            const timeSpent = parseInt(timeSpentRaw);
            if (isNaN(timeSpent) || timeSpent < 15 || timeSpent > 120) {
                const errorContainer = new ContainerBuilder()
                    .setAccentColor(config.colors.error)
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent('❌ **Invalid Time**\n\nPlease enter a valid observation time between 15 and 120 minutes.')
                    );
                
                return await interaction.reply({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2,
                    ephemeral: true
                });
            }
            
            // Get the bird again
            const bird = birdOps.getBird.get(birdId, interaction.user.id);
            
            if (!bird) {
                const errorContainer = new ContainerBuilder()
                    .setAccentColor(config.colors.error)
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent('❌ **Bird Not Found**\n\nThis bird is no longer in your collection.')
                    );
                
                return await interaction.reply({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2,
                    ephemeral: true
                });
            }
            
            // Calculate bond increase based on time spent and bird rarity
            const baseIncrease = Math.floor(timeSpent / 15); // 1 bond per 15 minutes
            const rarityMultiplier = {
                common: 1,
                uncommon: 1.2,
                rare: 1.5,
                epic: 2,
                legendary: 3
            }[bird.rarity] || 1;
            
            const bondIncrease = Math.ceil(baseIncrease * rarityMultiplier);
            
            // Calculate coin reward
            const coinReward = Math.floor(timeSpent / 10) * bird.base_value * 0.1;
            
            // Update bird observation
            birdOps.updateObservation.run(bondIncrease, birdId, interaction.user.id);
            
            // Update user balance
            const user = userOps.get.get(interaction.user.id);
            const newBalance = user.balance + coinReward;
            userOps.updateBalance.run(newBalance, user.bank_balance, user.last_work, interaction.user.id);
            
            // Record transaction
            transactionOps.create.run(interaction.user.id, 'earn', coinReward, `Bird observation: ${bird.name}`);
            
            // Set cooldown
            setCooldown(interaction.user.id, 'observe', config.cooldowns.observe);
            
            // Success response
            const rarityColor = config.colors[bird.rarity] || config.colors.primary;
            const bondStars = '⭐'.repeat(Math.min(bird.bond_level + bondIncrease, 5));
            
            const successContainer = new ContainerBuilder()
                .setAccentColor(rarityColor)
                .addSectionComponents(
                    section => section
                        .addTextDisplayComponents(
                            textDisplay => textDisplay
                                .setContent(`👁️ **Observation Complete**\n\nYou spent **${timeSpent} minutes** carefully observing **${bird.custom_name || bird.name}**.`),
                            textDisplay => textDisplay
                                .setContent(`**Your Notes:**\n*"${observationNotes}"*`),
                            textDisplay => textDisplay
                                .setContent(`**Rewards:**\n💎 Bond Level: +${bondIncrease} ${bondStars}\n💰 Coins Earned: **${coinReward}**\n\n*Your connection with this bird grows stronger through patient observation.*`)
                        )
                );
            
            await interaction.reply({
                components: [successContainer],
                flags: MessageFlags.IsComponentsV2
            });
            
        } catch (error) {
            console.error('Error in observe modal handler:', error);
            
            const errorContainer = new ContainerBuilder()
                .setAccentColor(config.colors.error)
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('❌ **Error**\n\nSomething went wrong while processing your observation. Please try again.')
                );
            
            await interaction.reply({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
        }
    }
};
