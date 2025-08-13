const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ContainerBuilder, SectionBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { queries, utils } = require('../../database/database.js');
const { getBirdById } = require('../../utils/birds.js');
const config = require('../../config.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('View and customize your bird watcher profile')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('View another user\'s profile')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('section')
                .setDescription('Jump to a specific profile section')
                .setRequired(false)
                .addChoices(
                    { name: '📊 Statistics', value: 'stats' },
                    { name: '🐦 Bird Collection', value: 'birds' },
                    { name: '🏆 Achievements', value: 'achievements' },
                    { name: '⚙️ Settings', value: 'settings' }
                )
        ),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const section = interaction.options.getString('section') || 'overview';
        const isOwner = targetUser.id === interaction.user.id;

        const user = utils.getOrCreateUser(targetUser.id, targetUser.username);
        const userBirds = queries.bird.getUserBirds.all(targetUser.id);
        const userItems = queries.item.getUserItems.all(targetUser.id);

        await displayProfile(interaction, targetUser, user, userBirds, userItems, section, isOwner);
    }
};

async function displayProfile(interaction, targetUser, userData, userBirds, userItems, section, isOwner) {
    const profileContainer = new ContainerBuilder()
        .setAccentColor(config.colors.primary);

    // Profile Header
    profileContainer.addSectionComponents(
        section => section
            .addTextDisplayComponents(
                textDisplay => textDisplay
                    .setContent(`👤 **${targetUser.username}'s Profile**\n\n${userData.title || 'Novice Bird Watcher'}`)
                    .setId('profile_header'),
                textDisplay => textDisplay
                    .setContent(`**Member Since:** <t:${Math.floor(new Date(userData.created_at).getTime() / 1000)}:R>\n**Total Worth:** ${((userData.balance || 0) + (userData.bank_balance || 0)).toLocaleString()} coins`)
                    .setId('profile_basic_info'),
                userData.bio ? textDisplay => textDisplay
                    .setContent(`**Bio:** *"${userData.bio}"*`)
                    .setId('profile_bio') : null
            ).filter(Boolean)
            .setThumbnailAccessory(
                thumbnail => thumbnail
                    .setURL(targetUser.displayAvatarURL({ size: 256 }))
                    .setDescription(`${targetUser.username}'s avatar`)
            )
    );

    // Statistics Overview
    const stats = calculateUserStats(userData, userBirds, userItems);
    profileContainer.addSectionComponents(
        section => section
            .addTextDisplayComponents(
                textDisplay => textDisplay
                    .setContent('📊 **Profile Statistics**')
                    .setId('stats_header'),
                textDisplay => textDisplay
                    .setContent(`**Birds Collected:** ${stats.totalBirds}\n**Hunts Completed:** ${userData.total_hunts || 0}\n**Observations Made:** ${userData.total_observations || 0}`)
                    .setId('stats_main'),
                textDisplay => textDisplay
                    .setContent(`**Favorite Rarity:** ${stats.favoriteRarity}\n**Rarest Bird:** ${stats.rarestBird}\n**Profile Level:** ${calculateLevel(stats.totalXP)}`)
                    .setId('stats_special')
            )
            .setButtonAccessory(
                button => button
                    .setCustomId(`detailed_stats_${targetUser.id}`)
                    .setLabel('📈 Detailed')
                    .setStyle(ButtonStyle.Secondary)
            )
    );

    // Bird Collection Highlights
    if (userBirds.length > 0) {
        const collectionStats = getCollectionStats(userBirds);
        profileContainer.addSectionComponents(
            section => section
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('🐦 **Bird Collection Highlights**')
                        .setId('collection_header'),
                    textDisplay => textDisplay
                        .setContent(Object.entries(collectionStats.byRarity)
                            .filter(([rarity, count]) => count > 0)
                            .map(([rarity, count]) => `**${rarity.charAt(0).toUpperCase() + rarity.slice(1)}:** ${count}`)
                            .join('\n'))
                        .setId('collection_breakdown')
                )
                .setButtonAccessory(
                    button => button
                        .setCustomId(`view_full_album_${targetUser.id}`)
                        .setLabel('📖 Full Album')
                        .setStyle(ButtonStyle.Primary)
                )
        );

        // Showcase favorite birds
        const favoriteBirds = userBirds
            .filter(bird => bird.is_favorite || bird.observations > 5)
            .slice(0, 3);

        if (favoriteBirds.length > 0) {
            for (const userBird of favoriteBirds) {
                const bird = getBirdById(userBird.bird_id);
                if (bird) {
                    profileContainer.addSectionComponents(
                        section => section
                            .addTextDisplayComponents(
                                textDisplay => textDisplay
                                    .setContent(`⭐ **${bird.name}**\n*${userBird.rarity} - ${userBird.observations} observations*`)
                                    .setId(`showcase_${userBird.id}_name`),
                                textDisplay => textDisplay
                                    .setContent(`Caught <t:${Math.floor(new Date(userBird.caught_at).getTime() / 1000)}:R> at ${userBird.location}`)
                                    .setId(`showcase_${userBird.id}_details`)
                            )
                            .setButtonAccessory(
                                button => button
                                    .setCustomId(`observe_showcase_${userBird.id}`)
                                    .setLabel('🔍 View')
                                    .setStyle(ButtonStyle.Secondary)
                            )
                    );
                }
            }
        }
    } else {
        profileContainer.addTextDisplayComponents(
            textDisplay => textDisplay
                .setContent('🐦 **Bird Collection**\n\nNo birds collected yet. Start your journey with `/hunt`!')
                .setId('empty_collection')
        );
    }

    // Achievements Preview
    const achievements = await getUserAchievements(targetUser.id);
    if (achievements.length > 0) {
        profileContainer.addSectionComponents(
            section => section
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent(`🏆 **Recent Achievements**\n\n${achievements.slice(0, 3).map(ach => `${ach.emoji} **${ach.name}**`).join('\n')}`)
                        .setId('achievements_preview'),
                    textDisplay => textDisplay
                        .setContent(`**Total Unlocked:** ${achievements.length} achievements`)
                        .setId('achievements_count')
                )
                .setButtonAccessory(
                    button => button
                        .setCustomId(`view_achievements_${targetUser.id}`)
                        .setLabel('🏆 All Achievements')
                        .setStyle(ButtonStyle.Success)
                )
        );
    }

    // Guild Information
    const userGuild = queries.guild.getUserGuild.get(targetUser.id);
    if (userGuild) {
        profileContainer.addSectionComponents(
            section => section
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent(`🏛️ **Guild Membership**\n\n**${userGuild.name}**`)
                        .setId('guild_info'),
                    textDisplay => textDisplay
                        .setContent(`**Role:** ${userGuild.role.charAt(0).toUpperCase() + userGuild.role.slice(1)}\n**Joined:** <t:${Math.floor(new Date(userGuild.joined_at).getTime() / 1000)}:R>`)
                        .setId('guild_details')
                )
                .setButtonAccessory(
                    button => button
                        .setCustomId(`view_guild_${userGuild.id}`)
                        .setLabel('🏛️ Guild')
                        .setStyle(ButtonStyle.Secondary)
                )
        );
    }

    // Navigation and action buttons
    const navigationRow = new ActionRowBuilder();
    
    if (isOwner) {
        navigationRow.addComponents(
            new ButtonBuilder()
                .setCustomId('edit_profile')
                .setLabel('✏️ Edit Profile')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('profile_settings')
                .setLabel('⚙️ Settings')
                .setStyle(ButtonStyle.Secondary)
        );
    }

    navigationRow.addComponents(
        new ButtonBuilder()
            .setCustomId(`compare_profiles_${targetUser.id}`)
            .setLabel('⚖️ Compare')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!isOwner), // Only owners can initiate comparisons
        new StringSelectMenuBuilder()
            .setCustomId(`profile_section_${targetUser.id}`)
            .setPlaceholder('Jump to section')
            .addOptions([
                { label: '📊 Statistics', value: 'stats', description: 'Detailed performance statistics' },
                { label: '🐦 Bird Collection', value: 'birds', description: 'Complete bird album' },
                { label: '🏆 Achievements', value: 'achievements', description: 'Unlocked achievements' },
                { label: '📜 Activity Log', value: 'activity', description: 'Recent activities' }
            ])
    );

    // Social actions
    const socialRow = new ActionRowBuilder();
    
    if (!isOwner) {
        socialRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`send_gift_${targetUser.id}`)
                .setLabel('🎁 Send Gift')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`challenge_duel_${targetUser.id}`)
                .setLabel('⚔️ Challenge')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`trade_with_${targetUser.id}`)
                .setLabel('🤝 Trade')
                .setStyle(ButtonStyle.Primary)
        );
    } else {
        socialRow.addComponents(
            new ButtonBuilder()
                .setCustomId('find_trading_partners')
                .setLabel('🔍 Find Partners')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('export_profile')
                .setLabel('💾 Export')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('profile_privacy')
                .setLabel('🔒 Privacy')
                .setStyle(ButtonStyle.Secondary)
        );
    }

    const components = [profileContainer, navigationRow];
    if (socialRow.components.length > 0) {
        components.push(socialRow);
    }

    await interaction.reply({
        components,
        flags: MessageFlags.IsComponentsV2,
        ephemeral: isOwner
    });
}

function calculateUserStats(userData, userBirds, userItems) {
    const stats = {
        totalBirds: userBirds.length,
        totalXP: (userData.total_observations || 0) * 10 + (userData.total_hunts || 0) * 5,
        favoriteRarity: 'None',
        rarestBird: 'None'
    };

    if (userBirds.length > 0) {
        // Calculate favorite rarity
        const rarityCount = {};
        let highestRarityValue = 0;
        let rarestBird = null;
        
        const rarityValues = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 };

        for (const bird of userBirds) {
            rarityCount[bird.rarity] = (rarityCount[bird.rarity] || 0) + 1;
            
            if (rarityValues[bird.rarity] > highestRarityValue) {
                highestRarityValue = rarityValues[bird.rarity];
                rarestBird = getBirdById(bird.bird_id);
            }
        }

        // Find most common rarity
        const mostCommonRarity = Object.entries(rarityCount)
            .sort(([,a], [,b]) => b - a)[0];
        
        if (mostCommonRarity) {
            stats.favoriteRarity = mostCommonRarity[0].charAt(0).toUpperCase() + mostCommonRarity[0].slice(1);
        }

        if (rarestBird) {
            stats.rarestBird = rarestBird.name;
        }
    }

    return stats;
}

function calculateLevel(xp) {
    if (xp < 100) return 1;
    if (xp < 500) return 2;
    if (xp < 1200) return 3;
    if (xp < 2500) return 4;
    if (xp < 5000) return 5;
    return Math.floor(xp / 1000) + 1;
}

function getCollectionStats(userBirds) {
    const stats = {
        byRarity: {
            common: 0,
            uncommon: 0,
            rare: 0,
            epic: 0,
            legendary: 0
        },
        totalObservations: 0,
        averageObservations: 0
    };

    for (const bird of userBirds) {
        if (stats.byRarity.hasOwnProperty(bird.rarity)) {
            stats.byRarity[bird.rarity]++;
        }
        stats.totalObservations += bird.observations || 0;
    }

    stats.averageObservations = userBirds.length > 0 
        ? Math.round(stats.totalObservations / userBirds.length * 10) / 10 
        : 0;

    return stats;
}

async function getUserAchievements(userId) {
    // Mock achievements for now
    return [
        { name: 'First Hunt', emoji: '🎯', description: 'Completed your first bird hunt' },
        { name: 'Observer', emoji: '👁️', description: 'Made 10 bird observations' },
        { name: 'Collector', emoji: '📚', description: 'Collected 5 different birds' }
    ];
}

// Handle profile editing
module.exports.showEditProfileModal = async function(interaction) {
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const user = utils.getOrCreateUser(interaction.user.id);

    const editModal = new ModalBuilder()
        .setCustomId('edit_profile_modal')
        .setTitle('Edit Your Profile');

    const titleInput = new TextInputBuilder()
        .setCustomId('profile_title')
        .setLabel('Profile Title')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., Master Bird Watcher, Novice Observer')
        .setValue(user.title || '')
        .setRequired(false)
        .setMaxLength(50);

    const bioInput = new TextInputBuilder()
        .setCustomId('profile_bio')
        .setLabel('Bio')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Tell other bird watchers about yourself...')
        .setValue(user.bio || '')
        .setRequired(false)
        .setMaxLength(500);

    const firstRow = new ActionRowBuilder().addComponents(titleInput);
    const secondRow = new ActionRowBuilder().addComponents(bioInput);

    editModal.addComponents(firstRow, secondRow);

    await interaction.showModal(editModal);
};

// Handle profile edit submission
module.exports.handleProfileEdit = async function(interaction) {
    const userId = interaction.user.id;
    const title = interaction.fields.getTextInputValue('profile_title') || null;
    const bio = interaction.fields.getTextInputValue('profile_bio') || null;

    // Update user profile
    queries.user.updateProfile.run(interaction.user.username, bio, title, null, userId);

    const successContainer = new ContainerBuilder()
        .setAccentColor(config.colors.success)
        .addTextDisplayComponents(
            textDisplay => textDisplay
                .setContent('✅ **Profile Updated**\n\nYour profile has been successfully updated!')
        );

    await interaction.reply({
        components: [successContainer],
        flags: MessageFlags.IsComponentsV2,
        ephemeral: true
    });
};

// Handle section navigation
module.exports.navigateToSection = async function(interaction, userId, section) {
    const targetUser = await interaction.client.users.fetch(userId);
    const userData = utils.getOrCreateUser(userId);
    const userBirds = queries.bird.getUserBirds.all(userId);
    const userItems = queries.item.getUserItems.all(userId);
    const isOwner = userId === interaction.user.id;

    await displayProfile(interaction, targetUser, userData, userBirds, userItems, section, isOwner);
};
