const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, SectionBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { userOps, birdOps, transactionOps } = require('../../database/database.js');
const { createUserIfNotExists } = require('../../utils/economy.js');
const config = require('../../config.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('release')
        .setDescription('Release a bird from your collection back to the wild')
        .addIntegerOption(option =>
            option.setName('bird_id')
                .setDescription('The ID of the bird you want to release')
                .setRequired(true)),
    
    async execute(interaction) {
        try {
            await createUserIfNotExists(interaction.user.id, interaction.user.username);
            
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
            
            // Calculate refund amount (50% base value + bond bonus)
            const bondBonus = Math.floor(bird.bond_level * bird.base_value * 0.1);
            const refundAmount = Math.floor(bird.base_value * 0.5) + bondBonus;
            
            // Create confirmation interface
            const rarityColor = config.colors[bird.rarity] || config.colors.primary;
            const rarityEmoji = {
                common: '🟢',
                uncommon: '🔵',
                rare: '🟣',
                epic: '🟠',
                legendary: '🟡'
            }[bird.rarity];
            
            const confirmContainer = new ContainerBuilder()
                .setAccentColor(rarityColor)
                .addSectionComponents(
                    section => section
                        .addTextDisplayComponents(
                            textDisplay => textDisplay
                                .setContent(`🕊️ **Release Confirmation**\n\nAre you sure you want to release **${bird.custom_name || bird.name}**?`),
                            textDisplay => textDisplay
                                .setContent(`**Bird Details:**\n${rarityEmoji} ${bird.name}\n*${bird.scientific_name}*\n\n**Bond Level:** ${bird.bond_level} ⭐\n**Times Observed:** ${bird.times_observed}\n**Captured:** ${new Date(bird.captured_at).toLocaleDateString()}`),
                            textDisplay => textDisplay
                                .setContent(`**Refund Calculation:**\n• Base Refund (50%): ${Math.floor(bird.base_value * 0.5)} coins\n• Bond Bonus: ${bondBonus} coins\n**Total Refund:** ${refundAmount} coins\n\n⚠️ **This action cannot be undone!**`)
                        )
                );
            
            const confirmButton = new ButtonBuilder()
                .setCustomId(`confirm_release_${birdId}`)
                .setLabel('✅ Confirm Release')
                .setStyle(ButtonStyle.Danger);
                
            const cancelButton = new ButtonBuilder()
                .setCustomId('cancel_release')
                .setLabel('❌ Cancel')
                .setStyle(ButtonStyle.Secondary);
            
            const actionRow = new ActionRowBuilder().addComponents(confirmButton, cancelButton);
            
            await interaction.reply({
                components: [confirmContainer, actionRow],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
            
        } catch (error) {
            console.error('Error in release command:', error);
            
            const errorContainer = new ContainerBuilder()
                .setAccentColor(config.colors.error)
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('❌ **Error**\n\nSomething went wrong while preparing the release. Please try again.')
                );
            
            await interaction.reply({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
        }
    },
    
    async handleConfirm(interaction, birdId) {
        try {
            // Get the bird again to ensure it still exists
            const bird = birdOps.getBird.get(birdId, interaction.user.id);
            
            if (!bird) {
                const errorContainer = new ContainerBuilder()
                    .setAccentColor(config.colors.error)
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent('❌ **Bird Not Found**\n\nThis bird is no longer in your collection.')
                    );
                
                return await interaction.update({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2
                });
            }
            
            // Calculate refund
            const bondBonus = Math.floor(bird.bond_level * bird.base_value * 0.1);
            const refundAmount = Math.floor(bird.base_value * 0.5) + bondBonus;
            
            // Release the bird
            birdOps.release.run(birdId, interaction.user.id);
            
            // Update user balance
            const user = userOps.get.get(interaction.user.id);
            const newBalance = user.balance + refundAmount;
            userOps.updateBalance.run(newBalance, user.bank_balance, user.last_work, interaction.user.id);
            
            // Record transaction
            transactionOps.create.run(interaction.user.id, 'earn', refundAmount, `Released bird: ${bird.name}`);
            
            // Success response
            const successContainer = new ContainerBuilder()
                .setAccentColor(config.colors.success)
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent(`🕊️ **Bird Released Successfully**\n\n**${bird.custom_name || bird.name}** has been released back to the wild.\n\nThe bird spreads its wings and flies away, free once again. You've been refunded **${refundAmount} coins** for your compassionate decision.\n\n*"If you love something, set it free..."*`)
                );
            
            await interaction.update({
                components: [successContainer],
                flags: MessageFlags.IsComponentsV2
            });
            
        } catch (error) {
            console.error('Error in release confirmation:', error);
            
            const errorContainer = new ContainerBuilder()
                .setAccentColor(config.colors.error)
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('❌ **Error**\n\nSomething went wrong while releasing the bird. Please try again.')
                );
            
            await interaction.update({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2
            });
        }
    },
    
    async handleCancel(interaction) {
        const cancelContainer = new ContainerBuilder()
            .setAccentColor(config.colors.info)
            .addTextDisplayComponents(
                textDisplay => textDisplay
                    .setContent('🏠 **Release Cancelled**\n\nYour bird remains safely in your collection.\n\nYou can view your birds anytime with `/album`.')
            );
        
        await interaction.update({
            components: [cancelContainer],
            flags: MessageFlags.IsComponentsV2
        });
    }
};
