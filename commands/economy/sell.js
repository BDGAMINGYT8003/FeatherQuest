const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ContainerBuilder, SectionBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { userOps, birdOps, transactionOps } = require('../../database/database.js');
const { createUserIfNotExists } = require('../../utils/economy.js');
const config = require('../../config.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sell')
        .setDescription('Sell birds or items from your collection')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('What do you want to sell?')
                .setRequired(true)
                .addChoices(
                    { name: 'Birds', value: 'birds' },
                    { name: 'Items', value: 'items' }
                )),
    
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        try {
            await createUserIfNotExists(interaction.user.id, interaction.user.username);
            
            const sellType = interaction.options.getString('type');
            
            if (sellType === 'birds') {
                await this.handleBirdSelling(interaction);
            } else {
                await this.handleItemSelling(interaction);
            }
            
        } catch (error) {
            console.error('Error in sell command:', error);
            
            const errorContainer = new ContainerBuilder()
                .setAccentColor(config.colors.error)
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('❌ **Error**\n\nSomething went wrong while setting up the selling interface. Please try again.')
                );
            
            await interaction.editReply({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2
            });
        }
    },
    
    async handleBirdSelling(interaction) {
        const userBirds = birdOps.getUserBirds.all(interaction.user.id);
        
        if (userBirds.length === 0) {
            const emptyContainer = new ContainerBuilder()
                .setAccentColor(config.colors.info)
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('📔 **No Birds to Sell**\n\nYou don\'t have any birds in your collection to sell.\n\nUse `/hunt` to capture some birds first!')
                );
            
            return await interaction.editReply({
                components: [emptyContainer],
                flags: MessageFlags.IsComponentsV2
            });
        }
        
        // Create bird selling interface
        const sellContainer = new ContainerBuilder()
            .setAccentColor(config.colors.warning)
            .addSectionComponents(
                section => section
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent(`🦅 **Bird Marketplace**\n\nYou have **${userBirds.length}** birds available for sale.\n\n⚠️ **Warning:** Selling birds permanently removes them from your collection. Consider using `/release` instead for a compassionate alternative.`),
                        textDisplay => textDisplay
                            .setContent(`**Selling Information:**\n• Sale Price: 70% of base value + bond bonus\n• Bond Bonus: 15% per bond level\n• Rare birds have higher market value\n• This action cannot be undone`)
                    )
            );
        
        // Create bird selection menu
        const birdOptions = userBirds.slice(0, 25).map(bird => {
            const bondBonus = Math.floor(bird.bond_level * bird.base_value * 0.15);
            const salePrice = Math.floor(bird.base_value * 0.7) + bondBonus;
            const rarityEmoji = {
                common: '🟢',
                uncommon: '🔵',
                rare: '🟣',
                epic: '🟠',
                legendary: '🟡'
            }[bird.rarity];
            
            return {
                label: `${bird.custom_name || bird.name}`,
                description: `${rarityEmoji} ${bird.rarity} | Sale Price: ${salePrice} coins`,
                value: `sell_bird_${bird.id}`,
                emoji: '🦅'
            };
        });
        
        const birdSelect = new StringSelectMenuBuilder()
            .setCustomId('select_bird_to_sell')
            .setPlaceholder('Select a bird to sell...')
            .addOptions(birdOptions);
        
        const selectRow = new ActionRowBuilder().addComponents(birdSelect);
        
        // Quick sell buttons
        const quickSellCommon = new ButtonBuilder()
            .setCustomId('quick_sell_common')
            .setLabel('Quick Sell All Common')
            .setStyle(ButtonStyle.Danger);
        
        const cancelButton = new ButtonBuilder()
            .setCustomId('cancel_selling')
            .setLabel('❌ Cancel')
            .setStyle(ButtonStyle.Secondary);
        
        const buttonRow = new ActionRowBuilder().addComponents(quickSellCommon, cancelButton);
        
        await interaction.editReply({
            components: [sellContainer, selectRow, buttonRow],
            flags: MessageFlags.IsComponentsV2
        });
    },
    
    async handleItemSelling(interaction) {
        // For now, show placeholder since item inventory system would be more complex
        const notImplementedContainer = new ContainerBuilder()
            .setAccentColor(config.colors.info)
            .addTextDisplayComponents(
                textDisplay => textDisplay
                    .setContent('🔧 **Feature Coming Soon**\n\nItem selling is not yet implemented. This feature will be available in a future update.\n\nFor now, you can only sell birds using the birds option.')
            );
        
        await interaction.editReply({
            components: [notImplementedContainer],
            flags: MessageFlags.IsComponentsV2
        });
    },
    
    async handleBirdSale(interaction, birdId) {
        try {
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
            
            // Calculate sale price
            const bondBonus = Math.floor(bird.bond_level * bird.base_value * 0.15);
            const salePrice = Math.floor(bird.base_value * 0.7) + bondBonus;
            
            const rarityColor = config.colors[bird.rarity] || config.colors.primary;
            const rarityEmoji = {
                common: '🟢',
                uncommon: '🔵',
                rare: '🟣',
                epic: '🟠',
                legendary: '🟡'
            }[bird.rarity];
            
            // Create sale confirmation
            const confirmContainer = new ContainerBuilder()
                .setAccentColor(rarityColor)
                .addSectionComponents(
                    section => section
                        .addTextDisplayComponents(
                            textDisplay => textDisplay
                                .setContent(`💰 **Confirm Bird Sale**\n\nAre you sure you want to sell **${bird.custom_name || bird.name}**?`),
                            textDisplay => textDisplay
                                .setContent(`**Bird Details:**\n${rarityEmoji} ${bird.name}\n*${bird.scientific_name}*\n\n**Bond Level:** ${bird.bond_level} ⭐\n**Times Observed:** ${bird.times_observed}\n**Captured:** ${new Date(bird.captured_at).toLocaleDateString()}`),
                            textDisplay => textDisplay
                                .setContent(`**Sale Calculation:**\n• Base Sale (70%): ${Math.floor(bird.base_value * 0.7)} coins\n• Bond Bonus (15% × ${bird.bond_level}): ${bondBonus} coins\n**Total Sale Price:** ${salePrice} coins\n\n⚠️ **This will permanently remove the bird!**`)
                        )
                );
            
            const confirmButton = new ButtonBuilder()
                .setCustomId(`confirm_sell_${birdId}`)
                .setLabel('✅ Confirm Sale')
                .setStyle(ButtonStyle.Danger);
                
            const cancelButton = new ButtonBuilder()
                .setCustomId('cancel_bird_sale')
                .setLabel('❌ Cancel')
                .setStyle(ButtonStyle.Secondary);
            
            const actionRow = new ActionRowBuilder().addComponents(confirmButton, cancelButton);
            
            await interaction.update({
                components: [confirmContainer, actionRow],
                flags: MessageFlags.IsComponentsV2
            });
            
        } catch (error) {
            console.error('Error in bird sale handler:', error);
            
            const errorContainer = new ContainerBuilder()
                .setAccentColor(config.colors.error)
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('❌ **Error**\n\nSomething went wrong while preparing the sale. Please try again.')
                );
            
            await interaction.update({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2
            });
        }
    },
    
    async confirmBirdSale(interaction, birdId) {
        try {
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
            
            // Calculate sale price
            const bondBonus = Math.floor(bird.bond_level * bird.base_value * 0.15);
            const salePrice = Math.floor(bird.base_value * 0.7) + bondBonus;
            
            // Remove bird from collection (mark as released/sold)
            birdOps.release.run(birdId, interaction.user.id);
            
            // Update user balance
            const user = userOps.get.get(interaction.user.id);
            const newBalance = user.balance + salePrice;
            userOps.updateBalance.run(newBalance, user.bank_balance, user.last_work, interaction.user.id);
            
            // Record transaction
            transactionOps.create.run(interaction.user.id, 'earn', salePrice, `Sold bird: ${bird.name}`);
            
            // Success response
            const successContainer = new ContainerBuilder()
                .setAccentColor(config.colors.success)
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent(`💰 **Bird Sold Successfully**\n\n**${bird.custom_name || bird.name}** has been sold to a private collector.\n\nYou received **${salePrice} coins** for this transaction.\n\n*The bird will be well cared for in its new home.*`)
                );
            
            await interaction.update({
                components: [successContainer],
                flags: MessageFlags.IsComponentsV2
            });
            
        } catch (error) {
            console.error('Error in confirm bird sale:', error);
            
            const errorContainer = new ContainerBuilder()
                .setAccentColor(config.colors.error)
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('❌ **Error**\n\nSomething went wrong while processing the sale. Please try again.')
                );
            
            await interaction.update({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2
            });
        }
    }
};
