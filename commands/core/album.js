const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, SectionBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { userOps, birdOps } = require('../../database/database.js');
const { createUserIfNotExists } = require('../../utils/economy.js');
const config = require('../../config.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('album')
        .setDescription('View your bird collection album')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('View another user\'s album')
                .setRequired(false)),
    
    async execute(interaction) {
        await interaction.deferReply();
        
        try {
            const targetUser = interaction.options.getUser('user') || interaction.user;
            await createUserIfNotExists(targetUser.id, targetUser.username);
            
            // Get user's birds
            const userBirds = birdOps.getUserBirds.all(targetUser.id);
            
            if (userBirds.length === 0) {
                const emptyContainer = new ContainerBuilder()
                    .setAccentColor(config.colors.info)
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent(`📔 **${targetUser.username}'s Bird Album**\n\n*This album is empty.*\n\n${targetUser.id === interaction.user.id ? 'Start your collection by using `/hunt` to find and capture birds!' : 'This user hasn\'t captured any birds yet.'}`)
                    );
                
                return await interaction.editReply({
                    components: [emptyContainer],
                    flags: MessageFlags.IsComponentsV2
                });
            }
            
            // Group birds by rarity
            const birdsByRarity = {
                legendary: [],
                epic: [],
                rare: [],
                uncommon: [],
                common: []
            };
            
            userBirds.forEach(bird => {
                birdsByRarity[bird.rarity].push(bird);
            });
            
            // Calculate stats
            const totalBirds = userBirds.length;
            const uniqueSpecies = new Set(userBirds.map(b => b.bird_id)).size;
            const totalValue = userBirds.reduce((sum, bird) => sum + bird.base_value, 0);
            const averageBondLevel = userBirds.reduce((sum, bird) => sum + bird.bond_level, 0) / totalBirds;
            
            // Create album display
            const albumContainer = new ContainerBuilder()
                .setAccentColor(config.colors.primary)
                .addSectionComponents(
                    section => section
                        .addTextDisplayComponents(
                            textDisplay => textDisplay
                                .setContent(`📔 **${targetUser.username}'s Bird Album**\n\n**Collection Statistics:**\n🦅 Total Birds: **${totalBirds}**\n🔬 Unique Species: **${uniqueSpecies}**\n💎 Collection Value: **${totalValue}** coins\n❤️ Average Bond Level: **${averageBondLevel.toFixed(1)}**`)
                        )
                );
            
            // Add rarity sections
            const rarityEmojis = {
                legendary: '🟡',
                epic: '🟠',
                rare: '🟣',
                uncommon: '🔵',
                common: '🟢'
            };
            
            Object.entries(birdsByRarity).forEach(([rarity, birds]) => {
                if (birds.length > 0) {
                    const rarityText = birds.slice(0, 5).map(bird => {
                        const bondStars = '⭐'.repeat(Math.min(bird.bond_level, 5));
                        const customName = bird.custom_name ? ` "${bird.custom_name}"` : '';
                        return `• ${bird.name}${customName} ${bondStars}`;
                    }).join('\n');
                    
                    const moreText = birds.length > 5 ? `\n*...and ${birds.length - 5} more*` : '';
                    
                    albumContainer.addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent(`${rarityEmojis[rarity]} **${rarity.charAt(0).toUpperCase() + rarity.slice(1)} (${birds.length})**\n${rarityText}${moreText}`)
                    );
                }
            });
            
            // Navigation buttons
            const viewDetailsButton = new ButtonBuilder()
                .setCustomId(`album_details_${targetUser.id}_0`)
                .setLabel('📊 Detailed View')
                .setStyle(ButtonStyle.Primary);
            
            const sortButton = new ButtonBuilder()
                .setCustomId(`album_sort_${targetUser.id}`)
                .setLabel('🔄 Sort Options')
                .setStyle(ButtonStyle.Secondary);
            
            const actionRow = new ActionRowBuilder().addComponents(viewDetailsButton, sortButton);
            
            // Only add share button for own album
            if (targetUser.id === interaction.user.id && totalBirds > 0) {
                const shareButton = new ButtonBuilder()
                    .setCustomId('album_share')
                    .setLabel('📤 Share Album')
                    .setStyle(ButtonStyle.Success);
                actionRow.addComponents(shareButton);
            }
            
            await interaction.editReply({
                components: [albumContainer, actionRow],
                flags: MessageFlags.IsComponentsV2
            });
            
        } catch (error) {
            console.error('Error in album command:', error);
            
            const errorContainer = new ContainerBuilder()
                .setAccentColor(config.colors.error)
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('❌ **Error**\n\nCouldn\'t load the bird album. Please try again later.')
                );
            
            await interaction.editReply({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2
            });
        }
    }
};
