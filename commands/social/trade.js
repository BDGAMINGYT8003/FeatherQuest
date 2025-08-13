const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ContainerBuilder, SectionBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { userOps, birdOps, tradeOps, transactionOps } = require('../../database/database.js');
const { createUserIfNotExists } = require('../../utils/economy.js');
const { setCooldown, getCooldown } = require('../../utils/cooldowns.js');
const config = require('../../config.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('trade')
        .setDescription('Trade birds or coins with another user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user you want to trade with')
                .setRequired(true)),
    
    async execute(interaction) {
        await interaction.deferReply();
        
        try {
            const targetUser = interaction.options.getUser('user');
            
            // Validate target user
            if (targetUser.id === interaction.user.id) {
                const errorContainer = new ContainerBuilder()
                    .setAccentColor(config.colors.error)
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent('❌ **Invalid Trade**\n\nYou cannot trade with yourself!\n\nFind another user to trade with.')
                    );
                
                return await interaction.editReply({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2
                });
            }
            
            if (targetUser.bot) {
                const errorContainer = new ContainerBuilder()
                    .setAccentColor(config.colors.error)
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent('❌ **Invalid Trade**\n\nYou cannot trade with bots!\n\nTrades are only available between users.')
                    );
                
                return await interaction.editReply({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2
                });
            }
            
            // Check cooldown
            const cooldownTime = getCooldown(interaction.user.id, 'trade');
            if (cooldownTime > 0) {
                const minutes = Math.ceil(cooldownTime / (1000 * 60));
                
                const errorContainer = new ContainerBuilder()
                    .setAccentColor(config.colors.warning)
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent(`⏰ **Trade Cooldown**\n\nYou need to wait **${minutes} minutes** before initiating another trade.\n\nThis cooldown prevents trade spam and ensures fair play.`)
                    );
                
                return await interaction.editReply({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2
                });
            }
            
            // Create both users if they don't exist
            await createUserIfNotExists(interaction.user.id, interaction.user.username);
            await createUserIfNotExists(targetUser.id, targetUser.username);
            
            // Get user data
            const initiator = userOps.get.get(interaction.user.id);
            const target = userOps.get.get(targetUser.id);
            const initiatorBirds = birdOps.getUserBirds.all(interaction.user.id);
            
            // Create trade interface
            const tradeContainer = new ContainerBuilder()
                .setAccentColor(config.colors.primary)
                .addSectionComponents(
                    section => section
                        .addTextDisplayComponents(
                            textDisplay => textDisplay
                                .setContent(`🤝 **Trade Proposal**\n\nInitiating a trade with **${targetUser.username}**`),
                            textDisplay => textDisplay
                                .setContent(`**Your Assets:**\n💰 Wallet: **${initiator.balance.toLocaleString()}** coins\n🦅 Birds: **${initiatorBirds.length}** available\n\n**Trade Fee:** ${(config.economy.tradeFee * 100)}% of coin value traded\n**Cooldown:** ${config.cooldowns.trade / (1000 * 60)} minutes`)
                        )
                );
            
            // Trade type selection
            const tradeTypeSelect = new StringSelectMenuBuilder()
                .setCustomId(`trade_type_${targetUser.id}`)
                .setPlaceholder('What do you want to offer?')
                .addOptions([
                    {
                        label: 'Coins Only',
                        description: 'Offer coins in exchange',
                        value: 'coins',
                        emoji: '💰'
                    },
                    {
                        label: 'Birds Only',
                        description: 'Offer birds from your collection',
                        value: 'birds',
                        emoji: '🦅'
                    },
                    {
                        label: 'Mixed Trade',
                        description: 'Offer both coins and birds',
                        value: 'mixed',
                        emoji: '🔄'
                    }
                ]);
            
            const selectRow = new ActionRowBuilder().addComponents(tradeTypeSelect);
            
            // Quick trade buttons
            const viewTargetButton = new ButtonBuilder()
                .setCustomId(`view_user_birds_${targetUser.id}`)
                .setLabel(`View ${targetUser.username}'s Birds`)
                .setStyle(ButtonStyle.Secondary);
            
            const cancelButton = new ButtonBuilder()
                .setCustomId('cancel_trade')
                .setLabel('❌ Cancel')
                .setStyle(ButtonStyle.Secondary);
            
            const buttonRow = new ActionRowBuilder().addComponents(viewTargetButton, cancelButton);
            
            await interaction.editReply({
                components: [tradeContainer, selectRow, buttonRow],
                flags: MessageFlags.IsComponentsV2
            });
            
        } catch (error) {
            console.error('Error in trade command:', error);
            
            const errorContainer = new ContainerBuilder()
                .setAccentColor(config.colors.error)
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('❌ **Error**\n\nSomething went wrong while setting up the trade. Please try again.')
                );
            
            await interaction.editReply({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2
            });
        }
    },
    
    async handleTradeType(interaction, targetUserId, tradeType) {
        try {
            const targetUser = await interaction.client.users.fetch(targetUserId);
            const initiator = userOps.get.get(interaction.user.id);
            const initiatorBirds = birdOps.getUserBirds.all(interaction.user.id);
            
            let tradeContainer;
            let actionRows = [];
            
            switch (tradeType) {
                case 'coins':
                    tradeContainer = new ContainerBuilder()
                        .setAccentColor(config.colors.warning)
                        .addSectionComponents(
                            section => section
                                .addTextDisplayComponents(
                                    textDisplay => textDisplay
                                        .setContent(`💰 **Coin Trade Setup**\n\nOffering coins to **${targetUser.username}**\n\nYour available balance: **${initiator.balance.toLocaleString()}** coins`),
                                    textDisplay => textDisplay
                                        .setContent(`**Note:** A ${(config.economy.tradeFee * 100)}% fee will be applied to the coin amount.\n\nClick the button below to specify the amount and what you want in return.`)
                                )
                        );
                    
                    const coinTradeButton = new ButtonBuilder()
                        .setCustomId(`setup_coin_trade_${targetUserId}`)
                        .setLabel('💰 Set Coin Amount')
                        .setStyle(ButtonStyle.Success);
                    
                    actionRows.push(new ActionRowBuilder().addComponents(coinTradeButton));
                    break;
                    
                case 'birds':
                    if (initiatorBirds.length === 0) {
                        const errorContainer = new ContainerBuilder()
                            .setAccentColor(config.colors.warning)
                            .addTextDisplayComponents(
                                textDisplay => textDisplay
                                    .setContent('🦅 **No Birds Available**\n\nYou don\'t have any birds to trade!\n\nUse `/hunt` to capture some birds first.')
                            );
                        
                        return await interaction.update({
                            components: [errorContainer],
                            flags: MessageFlags.IsComponentsV2
                        });
                    }
                    
                    tradeContainer = new ContainerBuilder()
                        .setAccentColor(config.colors.rare)
                        .addSectionComponents(
                            section => section
                                .addTextDisplayComponents(
                                    textDisplay => textDisplay
                                        .setContent(`🦅 **Bird Trade Setup**\n\nSelect birds to offer to **${targetUser.username}**\n\nYour collection: **${initiatorBirds.length}** birds available`)
                                )
                        );
                    
                    // Create bird selection menu
                    const birdOptions = initiatorBirds.slice(0, 25).map(bird => {
                        const rarityEmoji = {
                            common: '🟢',
                            uncommon: '🔵',
                            rare: '🟣',
                            epic: '🟠',
                            legendary: '🟡'
                        }[bird.rarity];
                        
                        return {
                            label: `${bird.custom_name || bird.name}`,
                            description: `${rarityEmoji} ${bird.rarity} | Bond: ${bird.bond_level}⭐ | Value: ${bird.base_value}`,
                            value: `select_bird_${bird.id}`,
                            emoji: '🦅'
                        };
                    });
                    
                    const birdSelect = new StringSelectMenuBuilder()
                        .setCustomId(`select_trade_bird_${targetUserId}`)
                        .setPlaceholder('Select a bird to trade...')
                        .setMaxValues(Math.min(5, birdOptions.length))
                        .addOptions(birdOptions);
                    
                    actionRows.push(new ActionRowBuilder().addComponents(birdSelect));
                    break;
                    
                case 'mixed':
                    tradeContainer = new ContainerBuilder()
                        .setAccentColor(config.colors.epic)
                        .addSectionComponents(
                            section => section
                                .addTextDisplayComponents(
                                    textDisplay => textDisplay
                                        .setContent(`🔄 **Mixed Trade Setup**\n\nCombine coins and birds in your offer to **${targetUser.username}**`),
                                    textDisplay => textDisplay
                                        .setContent(`**Your Assets:**\n💰 Coins: **${initiator.balance.toLocaleString()}** available\n🦅 Birds: **${initiatorBirds.length}** available\n\nSet up your mixed offer step by step.`)
                                )
                        );
                    
                    const mixedCoinButton = new ButtonBuilder()
                        .setCustomId(`setup_mixed_coins_${targetUserId}`)
                        .setLabel('💰 Add Coins')
                        .setStyle(ButtonStyle.Success);
                    
                    const mixedBirdButton = new ButtonBuilder()
                        .setCustomId(`setup_mixed_birds_${targetUserId}`)
                        .setLabel('🦅 Add Birds')
                        .setStyle(ButtonStyle.Primary);
                    
                    actionRows.push(new ActionRowBuilder().addComponents(mixedCoinButton, mixedBirdButton));
                    break;
            }
            
            // Add back button
            const backButton = new ButtonBuilder()
                .setCustomId('trade_back')
                .setLabel('⬅️ Back')
                .setStyle(ButtonStyle.Secondary);
            
            const cancelButton = new ButtonBuilder()
                .setCustomId('cancel_trade')
                .setLabel('❌ Cancel')
                .setStyle(ButtonStyle.Secondary);
            
            const navRow = new ActionRowBuilder().addComponents(backButton, cancelButton);
            actionRows.push(navRow);
            
            await interaction.update({
                components: [tradeContainer, ...actionRows],
                flags: MessageFlags.IsComponentsV2
            });
            
        } catch (error) {
            console.error('Error in trade type handler:', error);
            
            const errorContainer = new ContainerBuilder()
                .setAccentColor(config.colors.error)
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('❌ **Error**\n\nSomething went wrong while setting up the trade type.')
                );
            
            await interaction.update({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2
            });
        }
    },
    
    async handleTradeProposal(interaction, tradeData) {
        try {
            // This would handle the final trade proposal and notification to the target user
            // For now, implement a simplified version
            
            const proposalContainer = new ContainerBuilder()
                .setAccentColor(config.colors.info)
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('🚧 **Feature In Development**\n\nComplex trading system is being implemented.\n\nThis will include:\n• Trade proposals and acceptances\n• Escrow system for security\n• Trade history and dispute resolution\n\nCheck back in the next update!')
                );
            
            await interaction.update({
                components: [proposalContainer],
                flags: MessageFlags.IsComponentsV2
            });
            
            // Set cooldown
            setCooldown(interaction.user.id, 'trade', config.cooldowns.trade);
            
        } catch (error) {
            console.error('Error in trade proposal handler:', error);
        }
    }
};
