const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, SectionBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { userOps, birdOps, transactionOps, cooldownOps } = require('../../database/database.js');
const { createUserIfNotExists } = require('../../utils/economy.js');
const { setCooldown, getCooldown } = require('../../utils/cooldowns.js');
const { getRandomBird } = require('../../services/huntingService.js');
const config = require('../../config.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hunt')
        .setDescription('Go bird hunting! Find and capture birds to add to your collection.')
        .addStringOption(option =>
            option.setName('equipment')
                .setDescription('Select equipment to use for hunting')
                .addChoices(
                    { name: 'Basic Trap', value: 'basic_trap' },
                    { name: 'Advanced Trap', value: 'advanced_trap' },
                    { name: 'No Equipment', value: 'none' }
                )),
    
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        try {
            // Create user if not exists
            await createUserIfNotExists(interaction.user.id, interaction.user.username);
            
            // Check cooldown
            const cooldownTime = getCooldown(interaction.user.id, 'hunt');
            if (cooldownTime > 0) {
                const minutes = Math.ceil(cooldownTime / (1000 * 60));
                
                const errorContainer = new ContainerBuilder()
                    .setAccentColor(config.colors.warning)
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent(`⏰ **Cooldown Active**\n\nYou need to wait **${minutes} minutes** before hunting again.\n\nUse this time to observe your current birds or work for some coins!`)
                    );
                
                return await interaction.editReply({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2
                });
            }
            
            // Check balance for hunt cost
            const user = userOps.get.get(interaction.user.id);
            if (user.balance < config.economy.huntCost) {
                const errorContainer = new ContainerBuilder()
                    .setAccentColor(config.colors.error)
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent(`💰 **Insufficient Funds**\n\nYou need **${config.economy.huntCost}** coins to go hunting.\nYour current balance: **${user.balance}** coins\n\nTry using \`/work\` to earn some coins first!`)
                    );
                
                return await interaction.editReply({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2
                });
            }
            
            // Deduct hunt cost
            const newBalance = user.balance - config.economy.huntCost;
            userOps.updateBalance.run(newBalance, user.bank_balance, user.last_work, interaction.user.id);
            
            // Record transaction
            transactionOps.create.run(interaction.user.id, 'spend', -config.economy.huntCost, 'Hunt expedition cost');
            
            // Get equipment bonus
            const equipment = interaction.options.getString('equipment') || 'none';
            let rarityBonus = 0;
            let equipmentText = '';
            
            switch (equipment) {
                case 'basic_trap':
                    rarityBonus = 0.1;
                    equipmentText = 'Using your **Basic Trap** (+10% common bird rate)';
                    break;
                case 'advanced_trap':
                    rarityBonus = 0.15;
                    equipmentText = 'Using your **Advanced Trap** (+15% rare bird rate)';
                    break;
                default:
                    equipmentText = 'Hunting with **no equipment** (natural approach)';
            }
            
            // Hunt for a bird
            const foundBird = getRandomBird(rarityBonus);
            
            if (!foundBird) {
                // No bird found
                setCooldown(interaction.user.id, 'hunt', config.cooldowns.hunt);
                
                const noLuckContainer = new ContainerBuilder()
                    .setAccentColor(config.colors.info)
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent(`🔍 **Hunt Complete**\n\n${equipmentText}\n\nYou spent hours searching the area but didn't spot any birds this time. Sometimes nature keeps her secrets!\n\n*Better luck next time. Your patience will be rewarded.*`)
                    );
                
                const retryButton = new ButtonBuilder()
                    .setCustomId('hunt_again')
                    .setLabel('Hunt Again Later')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true);
                
                const actionRow = new ActionRowBuilder().addComponents(retryButton);
                
                return await interaction.editReply({
                    components: [noLuckContainer, actionRow],
                    flags: MessageFlags.IsComponentsV2
                });
            }
            
            // Bird found! Create capture interface
            const rarityColor = config.colors[foundBird.rarity] || config.colors.primary;
            const rarityEmoji = {
                common: '🟢',
                uncommon: '🔵',
                rare: '🟣',
                epic: '🟠',
                legendary: '🟡'
            }[foundBird.rarity];
            
            const huntContainer = new ContainerBuilder()
                .setAccentColor(rarityColor)
                .addSectionComponents(
                    section => section
                        .addTextDisplayComponents(
                            textDisplay => textDisplay
                                .setContent(`🦅 **Bird Spotted!**\n\n${equipmentText}`),
                            textDisplay => textDisplay
                                .setContent(`**${foundBird.name}** ${rarityEmoji}\n*${foundBird.scientific_name}*\n\n${foundBird.description}\n\n**Habitat:** ${foundBird.habitat}\n**Rarity:** ${foundBird.rarity.charAt(0).toUpperCase() + foundBird.rarity.slice(1)}\n**Base Value:** ${foundBird.base_value} coins`)
                        )
                );
            
            const captureButton = new ButtonBuilder()
                .setCustomId(`capture_bird_${foundBird.id}`)
                .setLabel('🎯 Capture Bird')
                .setStyle(ButtonStyle.Success);
                
            const observeButton = new ButtonBuilder()
                .setCustomId(`observe_wild_${foundBird.id}`)
                .setLabel('👁️ Observe Only')
                .setStyle(ButtonStyle.Primary);
                
            const leaveButton = new ButtonBuilder()
                .setCustomId('leave_bird')
                .setLabel('🚶 Leave Quietly')
                .setStyle(ButtonStyle.Secondary);
            
            const actionRow = new ActionRowBuilder().addComponents(captureButton, observeButton, leaveButton);
            
            // Set hunt cooldown
            setCooldown(interaction.user.id, 'hunt', config.cooldowns.hunt);
            
            await interaction.editReply({
                components: [huntContainer, actionRow],
                flags: MessageFlags.IsComponentsV2
            });
            
        } catch (error) {
            console.error('Error in hunt command:', error);
            
            const errorContainer = new ContainerBuilder()
                .setAccentColor(config.colors.error)
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('❌ **Error**\n\nSomething went wrong during your hunt. Please try again later.')
                );
            
            await interaction.editReply({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2
            });
        }
    }
};
