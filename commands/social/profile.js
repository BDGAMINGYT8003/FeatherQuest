const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, SectionBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { userOps, birdOps } = require('../../database/database.js');
const { createUserIfNotExists } = require('../../utils/economy.js');
const config = require('../../config.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('View and edit your bird hunter profile')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('View another user\'s profile')
                .setRequired(false)),
    
    async execute(interaction) {
        await interaction.deferReply();
        
        try {
            const targetUser = interaction.options.getUser('user') || interaction.user;
            await createUserIfNotExists(targetUser.id, targetUser.username);
            
            const user = userOps.get.get(targetUser.id);
            const userBirds = birdOps.getUserBirds.all(targetUser.id);
            const isOwnProfile = targetUser.id === interaction.user.id;
            
            // Calculate profile statistics
            const totalWealth = user.balance + user.bank_balance;
            const memberSince = new Date(user.created_at);
            const daysSinceJoined = Math.floor((new Date() - memberSince) / (1000 * 60 * 60 * 24));
            
            // Bird collection stats
            const birdsByRarity = {
                common: userBirds.filter(b => b.rarity === 'common').length,
                uncommon: userBirds.filter(b => b.rarity === 'uncommon').length,
                rare: userBirds.filter(b => b.rarity === 'rare').length,
                epic: userBirds.filter(b => b.rarity === 'epic').length,
                legendary: userBirds.filter(b => b.rarity === 'legendary').length
            };
            
            const totalObservations = userBirds.reduce((sum, bird) => sum + bird.times_observed, 0);
            const averageBondLevel = userBirds.length > 0 
                ? userBirds.reduce((sum, bird) => sum + bird.bond_level, 0) / userBirds.length 
                : 0;
            
            const collectionValue = userBirds.reduce((sum, bird) => sum + bird.base_value, 0);
            
            // Create profile display
            const profileContainer = new ContainerBuilder()
                .setAccentColor(config.colors.primary)
                .addSectionComponents(
                    section => section
                        .addTextDisplayComponents(
                            textDisplay => textDisplay
                                .setContent(`👤 **${targetUser.username}'s Profile**\n\n${user.title ? `**Title:** ${user.title}\n` : ''}${user.bio ? `**Bio:** ${user.bio}\n` : '**Bio:** *No bio set*'}\n\n📅 **Member Since:** ${memberSince.toLocaleDateString()} (${daysSinceJoined} days ago)`),
                            textDisplay => textDisplay
                                .setContent(`**Financial Status:**\n💰 Total Wealth: **${totalWealth.toLocaleString()}** coins\n💸 Lifetime Earnings: **${user.total_money_earned.toLocaleString()}** coins\n📊 Daily Earning Rate: **${Math.floor(user.total_money_earned / Math.max(daysSinceJoined, 1)).toLocaleString()}** coins/day`)
                        )
                );
            
            // Bird collection section
            profileContainer.addSectionComponents(
                section => section
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent(`🦅 **Bird Collection (${userBirds.length} total)**\n🟢 Common: ${birdsByRarity.common} | 🔵 Uncommon: ${birdsByRarity.uncommon}\n🟣 Rare: ${birdsByRarity.rare} | 🟠 Epic: ${birdsByRarity.epic} | 🟡 Legendary: ${birdsByRarity.legendary}`),
                        textDisplay => textDisplay
                            .setContent(`**Collection Stats:**\n💎 Collection Value: **${collectionValue.toLocaleString()}** coins\n👁️ Total Observations: **${totalObservations.toLocaleString()}**\n❤️ Average Bond Level: **${averageBondLevel.toFixed(1)}**\n🏆 Birds Caught: **${user.total_birds_caught}**`)
                    )
            );
            
            // Show favorite birds if any
            if (userBirds.length > 0) {
                const topBirds = userBirds
                    .sort((a, b) => b.bond_level - a.bond_level)
                    .slice(0, 3)
                    .map(bird => {
                        const rarityEmoji = {
                            common: '🟢',
                            uncommon: '🔵',
                            rare: '🟣',
                            epic: '🟠',
                            legendary: '🟡'
                        }[bird.rarity];
                        const stars = '⭐'.repeat(Math.min(bird.bond_level, 5));
                        return `${rarityEmoji} ${bird.custom_name || bird.name} ${stars}`;
                    }).join('\n');
                
                profileContainer.addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent(`**Strongest Bonds:**\n${topBirds}`)
                );
            }
            
            // Profile actions (only for own profile)
            const actionRows = [];
            if (isOwnProfile) {
                const editProfileButton = new ButtonBuilder()
                    .setCustomId('edit_profile')
                    .setLabel('✏️ Edit Profile')
                    .setStyle(ButtonStyle.Primary);
                
                const changeAvatarButton = new ButtonBuilder()
                    .setCustomId('change_avatar')
                    .setLabel('🖼️ Change Avatar')
                    .setStyle(ButtonStyle.Secondary);
                
                const showcaseButton = new ButtonBuilder()
                    .setCustomId('edit_showcase')
                    .setLabel('🌟 Edit Showcase')
                    .setStyle(ButtonStyle.Secondary);
                
                actionRows.push(new ActionRowBuilder().addComponents(editProfileButton, changeAvatarButton, showcaseButton));
            }
            
            // General action buttons
            const viewAlbumButton = new ButtonBuilder()
                .setCustomId(`view_album_${targetUser.id}`)
                .setLabel('📔 View Album')
                .setStyle(ButtonStyle.Success);
            
            const viewStatsButton = new ButtonBuilder()
                .setCustomId(`view_detailed_stats_${targetUser.id}`)
                .setLabel('📊 Detailed Stats')
                .setStyle(ButtonStyle.Secondary);
            
            const generalRow = new ActionRowBuilder().addComponents(viewAlbumButton, viewStatsButton);
            actionRows.push(generalRow);
            
            await interaction.editReply({
                components: [profileContainer, ...actionRows],
                flags: MessageFlags.IsComponentsV2
            });
            
        } catch (error) {
            console.error('Error in profile command:', error);
            
            const errorContainer = new ContainerBuilder()
                .setAccentColor(config.colors.error)
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('❌ **Error**\n\nCouldn\'t load the profile. Please try again later.')
                );
            
            await interaction.editReply({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2
            });
        }
    },
    
    async handleEditProfile(interaction) {
        try {
            const user = userOps.get.get(interaction.user.id);
            
            const modal = new ModalBuilder()
                .setCustomId('edit_profile_modal')
                .setTitle('Edit Your Profile');
            
            const titleInput = new TextInputBuilder()
                .setCustomId('profile_title')
                .setLabel('Title (optional)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Master Bird Observer, Rare Hunter, etc.')
                .setRequired(false)
                .setMaxLength(50)
                .setValue(user.title || '');
            
            const bioInput = new TextInputBuilder()
                .setCustomId('profile_bio')
                .setLabel('Bio (optional)')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Tell others about your bird hunting journey...')
                .setRequired(false)
                .setMaxLength(500)
                .setValue(user.bio || '');
            
            const firstRow = new ActionRowBuilder().addComponents(titleInput);
            const secondRow = new ActionRowBuilder().addComponents(bioInput);
            
            modal.addComponents(firstRow, secondRow);
            
            await interaction.showModal(modal);
            
        } catch (error) {
            console.error('Error in edit profile handler:', error);
            
            const errorContainer = new ContainerBuilder()
                .setAccentColor(config.colors.error)
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('❌ **Error**\n\nCouldn\'t open the profile editor. Please try again.')
                );
            
            await interaction.update({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2
            });
        }
    },
    
    async handleProfileModal(interaction) {
        try {
            const title = interaction.fields.getTextInputValue('profile_title').trim();
            const bio = interaction.fields.getTextInputValue('profile_bio').trim();
            
            // Update profile
            userOps.updateProfile.run(
                interaction.user.username,
                title || null,
                bio || null,
                null, // avatar_url (not implemented yet)
                interaction.user.id
            );
            
            // Success response
            const successContainer = new ContainerBuilder()
                .setAccentColor(config.colors.success)
                .addSectionComponents(
                    section => section
                        .addTextDisplayComponents(
                            textDisplay => textDisplay
                                .setContent(`✅ **Profile Updated!**\n\nYour profile has been successfully updated.`),
                            textDisplay => textDisplay
                                .setContent(`**New Information:**\n${title ? `**Title:** ${title}\n` : '**Title:** *Not set*\n'}${bio ? `**Bio:** ${bio}` : '**Bio:** *Not set*'}\n\nOther users can now see your updated profile when they use \`/profile @you\`.`)
                        )
                );
            
            await interaction.reply({
                components: [successContainer],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
            
        } catch (error) {
            console.error('Error in profile modal handler:', error);
            
            const errorContainer = new ContainerBuilder()
                .setAccentColor(config.colors.error)
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('❌ **Error**\n\nCouldn\'t save your profile changes. Please try again.')
                );
            
            await interaction.reply({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
        }
    }
};
