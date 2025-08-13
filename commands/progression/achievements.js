const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ContainerBuilder, SectionBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { queries, utils } = require('../../database/database.js');
const { loadAchievements } = require('../../utils/birds.js');
const config = require('../../config.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('achievements')
        .setDescription('View your achievements and progress towards unlocking new ones')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('View another user\'s achievements')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('category')
                .setDescription('Filter achievements by category')
                .setRequired(false)
                .addChoices(
                    { name: '🎯 Hunting', value: 'hunting' },
                    { name: '🐦 Collection', value: 'collection' },
                    { name: '👁️ Observation', value: 'observation' },
                    { name: '💰 Economy', value: 'economy' },
                    { name: '🤝 Social', value: 'social' },
                    { name: '🎮 Gaming', value: 'gaming' },
                    { name: '⭐ Special', value: 'special' }
                ))
        .addStringOption(option =>
            option.setName('status')
                .setDescription('Show achievements by completion status')
                .setRequired(false)
                .addChoices(
                    { name: '✅ Unlocked', value: 'unlocked' },
                    { name: '🔒 Locked', value: 'locked' },
                    { name: '🕐 In Progress', value: 'progress' },
                    { name: '📋 All', value: 'all' }
                )),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const category = interaction.options.getString('category') || 'all';
        const status = interaction.options.getString('status') || 'all';
        const isOwner = targetUser.id === interaction.user.id;

        const user = utils.getOrCreateUser(targetUser.id, targetUser.username);
        const userAchievements = queries.achievement.getUserAchievements.all(targetUser.id);
        const userBirds = queries.bird.getUserBirds.all(targetUser.id);

        await displayAchievements(interaction, targetUser, user, userAchievements, userBirds, category, status, isOwner);
    }
};

async function displayAchievements(interaction, targetUser, userData, userAchievements, userBirds, category, status, isOwner) {
    const allAchievements = loadAchievements();
    const achievementProgress = calculateAchievementProgress(userData, userBirds, userAchievements);

    const achievementContainer = new ContainerBuilder()
        .setAccentColor(config.colors.legendary);

    // Header section
    const unlockedCount = userAchievements.length;
    const totalCount = allAchievements.length;
    const completionRate = Math.round((unlockedCount / totalCount) * 100);

    achievementContainer.addSectionComponents(
        section => section
            .addTextDisplayComponents(
                textDisplay => textDisplay
                    .setContent(`🏆 **${targetUser.username}'s Achievements**\n\n**Progress:** ${unlockedCount}/${totalCount} (${completionRate}%)`)
                    .setId('achievement_header'),
                textDisplay => textDisplay
                    .setContent(`**Achievement Points:** ${calculateAchievementPoints(userAchievements)}\n**Latest Unlock:** ${getLatestAchievement(userAchievements) || 'None'}\n**Rarest Achievement:** ${getRarestAchievement(userAchievements) || 'None'}`)
                    .setId('achievement_stats')
            )
            .setThumbnailAccessory(
                thumbnail => thumbnail
                    .setURL(targetUser.displayAvatarURL({ size: 256 }))
                    .setDescription(`${targetUser.username}'s avatar`)
            )
    );

    // Progress bar for overall completion
    const progressBar = createProgressBar(unlockedCount, totalCount);
    achievementContainer.addSectionComponents(
        section => section
            .addTextDisplayComponents(
                textDisplay => textDisplay
                    .setContent(`📊 **Overall Progress**\n\n${progressBar}`)
                    .setId('overall_progress'),
                textDisplay => textDisplay
                    .setContent(`**Next Milestone:** ${getNextMilestone(completionRate)}\n**Rank:** ${getAchievementRank(completionRate)}`)
                    .setId('progress_details')
            )
            .setButtonAccessory(
                button => button
                    .setCustomId(`progress_breakdown_${targetUser.id}`)
                    .setLabel('📈 Breakdown')
                    .setStyle(ButtonStyle.Secondary)
            )
    );

    // Filter and display achievements
    const filteredAchievements = filterAchievements(allAchievements, userAchievements, achievementProgress, category, status);

    if (filteredAchievements.length === 0) {
        achievementContainer.addTextDisplayComponents(
            textDisplay => textDisplay
                .setContent(`🔍 **No Achievements Found**\n\nNo achievements match your current filters.\n\nTry changing the category or status filter.`)
                .setId('no_achievements')
        );
    } else {
        // Group achievements by category
        const groupedAchievements = groupAchievementsByCategory(filteredAchievements);

        for (const [categoryName, achievements] of Object.entries(groupedAchievements)) {
            if (achievements.length === 0) continue;

            const categoryEmoji = getCategoryEmoji(categoryName);
            const categoryColor = getCategoryColor(categoryName);

            achievementContainer.addSectionComponents(
                section => section
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent(`${categoryEmoji} **${categoryName} Achievements**\n\n**Unlocked:** ${achievements.filter(a => a.unlocked).length}/${achievements.length}`)
                            .setId(`category_${categoryName}_header`)
                    )
                    .setButtonAccessory(
                        button => button
                            .setCustomId(`expand_category_${categoryName}`)
                            .setLabel('👁️ View All')
                            .setStyle(ButtonStyle.Secondary)
                    )
            );

            // Show first few achievements in each category
            for (const achievement of achievements.slice(0, 3)) {
                achievementContainer.addSectionComponents(
                    section => section
                        .addTextDisplayComponents(
                            textDisplay => textDisplay
                                .setContent(`${achievement.unlocked ? '✅' : '🔒'} **${achievement.name}**\n*${achievement.rarity} • ${achievement.points} points*`)
                                .setId(`achievement_${achievement.id}_name`),
                            textDisplay => textDisplay
                                .setContent(`${achievement.description}\n\n${achievement.unlocked ? `**Unlocked:** <t:${Math.floor(new Date(achievement.unlockedAt || Date.now()).getTime() / 1000)}:R>` : `**Progress:** ${achievement.progress || '0'}/${achievement.requirement || '?'}`}`)
                                .setId(`achievement_${achievement.id}_details`)
                        )
                        .setButtonAccessory(
                            button => button
                                .setCustomId(`achievement_details_${achievement.id}`)
                                .setLabel(achievement.unlocked ? '🏆 View' : '🎯 Track')
                                .setStyle(achievement.unlocked ? ButtonStyle.Success : ButtonStyle.Primary)
                        )
                );
            }
        }
    }

    // Recent achievements showcase
    const recentUnlocks = getRecentUnlocks(userAchievements);
    if (recentUnlocks.length > 0) {
        achievementContainer.addSectionComponents(
            section => section
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('🆕 **Recent Unlocks**')
                        .setId('recent_unlocks_header'),
                    textDisplay => textDisplay
                        .setContent(recentUnlocks.map(ach => `${ach.emoji} **${ach.name}** (<t:${Math.floor(new Date(ach.unlocked_at).getTime() / 1000)}:R>)`).join('\n'))
                        .setId('recent_unlocks_list')
                )
                .setButtonAccessory(
                    button => button
                        .setCustomId(`showcase_achievements_${targetUser.id}`)
                        .setLabel('✨ Showcase')
                        .setStyle(ButtonStyle.Success)
                )
        );
    }

    // Close to unlocking
    const nearCompletion = getNearCompletionAchievements(allAchievements, userAchievements, achievementProgress);
    if (nearCompletion.length > 0) {
        achievementContainer.addSectionComponents(
            section => section
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('🎯 **Almost There!**')
                        .setId('near_completion_header'),
                    textDisplay => textDisplay
                        .setContent(nearCompletion.map(ach => `${ach.emoji} **${ach.name}** - ${ach.progress}/${ach.requirement}`).join('\n'))
                        .setId('near_completion_list')
                )
                .setButtonAccessory(
                    button => button
                        .setCustomId(`focus_achievements_${targetUser.id}`)
                        .setLabel('🎯 Focus')
                        .setStyle(ButtonStyle.Primary)
                )
        );
    }

    // Achievement rewards
    const unclaimedRewards = getUnclaimedRewards(userAchievements);
    if (unclaimedRewards.length > 0) {
        achievementContainer.addSectionComponents(
            section => section
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('🎁 **Unclaimed Rewards**')
                        .setId('unclaimed_rewards_header'),
                    textDisplay => textDisplay
                        .setContent(`You have **${unclaimedRewards.length}** achievement rewards waiting to be claimed!`)
                        .setId('unclaimed_rewards_count')
                )
                .setButtonAccessory(
                    button => button
                        .setCustomId(`claim_all_rewards_${targetUser.id}`)
                        .setLabel('🎁 Claim All')
                        .setStyle(ButtonStyle.Success)
                )
        );
    }

    // Category and status filters
    const filterRow = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`achievement_category_${targetUser.id}`)
                .setPlaceholder('Filter by category')
                .addOptions([
                    { label: '📋 All Categories', value: 'all', description: 'Show all achievements' },
                    { label: '🎯 Hunting', value: 'hunting', description: 'Bird hunting achievements' },
                    { label: '🐦 Collection', value: 'collection', description: 'Collection milestones' },
                    { label: '👁️ Observation', value: 'observation', description: 'Observation achievements' },
                    { label: '💰 Economy', value: 'economy', description: 'Economic achievements' },
                    { label: '🤝 Social', value: 'social', description: 'Social interaction achievements' },
                    { label: '🎮 Gaming', value: 'gaming', description: 'Mini-game achievements' },
                    { label: '⭐ Special', value: 'special', description: 'Rare and special achievements' }
                ]),
            new StringSelectMenuBuilder()
                .setCustomId(`achievement_status_${targetUser.id}`)
                .setPlaceholder('Filter by status')
                .addOptions([
                    { label: '📋 All Achievements', value: 'all', description: 'Show all achievements' },
                    { label: '✅ Unlocked', value: 'unlocked', description: 'Completed achievements' },
                    { label: '🔒 Locked', value: 'locked', description: 'Not yet unlocked' },
                    { label: '🕐 In Progress', value: 'progress', description: 'Currently working on' }
                ])
        );

    // Action buttons
    const actionRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`achievement_search_${targetUser.id}`)
                .setLabel('🔍 Search')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`achievement_guide_${targetUser.id}`)
                .setLabel('📚 Guide')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`achievement_stats_${targetUser.id}`)
                .setLabel('📊 Statistics')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`share_achievements_${targetUser.id}`)
                .setLabel('📤 Share')
                .setStyle(ButtonStyle.Success)
                .setDisabled(!isOwner)
        );

    // View options for owners
    const viewRow = new ActionRowBuilder();
    if (isOwner) {
        viewRow.addComponents(
            new ButtonBuilder()
                .setCustomId('refresh_achievements')
                .setLabel('🔄 Refresh')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('export_achievements')
                .setLabel('💾 Export')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('achievement_settings')
                .setLabel('⚙️ Settings')
                .setStyle(ButtonStyle.Secondary)
        );
    } else {
        viewRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`compare_achievements_${targetUser.id}`)
                .setLabel('⚖️ Compare')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`achievement_tips_${targetUser.id}`)
                .setLabel('💡 Tips')
                .setStyle(ButtonStyle.Secondary)
        );
    }

    const components = [achievementContainer, filterRow, actionRow];
    if (viewRow.components.length > 0) {
        components.push(viewRow);
    }

    await interaction.reply({
        components,
        flags: MessageFlags.IsComponentsV2,
        ephemeral: isOwner
    });
}

function calculateAchievementProgress(userData, userBirds, userAchievements) {
    const progress = {};
    
    // Calculate progress for various achievement types
    progress.totalHunts = userData.total_hunts || 0;
    progress.totalObservations = userData.total_observations || 0;
    progress.totalBirds = userBirds.length;
    progress.netWorth = (userData.balance || 0) + (userData.bank_balance || 0);
    
    // Bird rarity counts
    progress.rarityCount = {
        common: 0,
        uncommon: 0,
        rare: 0,
        epic: 0,
        legendary: 0
    };
    
    userBirds.forEach(bird => {
        if (progress.rarityCount.hasOwnProperty(bird.rarity)) {
            progress.rarityCount[bird.rarity]++;
        }
    });
    
    // Calculate various milestones
    progress.observationsPerBird = userBirds.length > 0 ? Math.round((userData.total_observations || 0) / userBirds.length) : 0;
    progress.totalValue = calculateCollectionValue(userBirds);
    
    return progress;
}

function filterAchievements(allAchievements, userAchievements, progress, category, status) {
    const unlockedIds = new Set(userAchievements.map(ua => ua.achievement_id));
    
    return allAchievements.filter(achievement => {
        // Category filter
        if (category !== 'all' && achievement.category !== category) {
            return false;
        }
        
        const isUnlocked = unlockedIds.has(achievement.id);
        const currentProgress = calculateIndividualProgress(achievement, progress);
        const isInProgress = !isUnlocked && currentProgress > 0;
        
        // Status filter
        switch (status) {
            case 'unlocked':
                return isUnlocked;
            case 'locked':
                return !isUnlocked && !isInProgress;
            case 'progress':
                return isInProgress;
            case 'all':
            default:
                return true;
        }
    }).map(achievement => {
        const isUnlocked = unlockedIds.has(achievement.id);
        const userAchievement = userAchievements.find(ua => ua.achievement_id === achievement.id);
        
        return {
            ...achievement,
            unlocked: isUnlocked,
            unlockedAt: userAchievement?.unlocked_at,
            progress: calculateIndividualProgress(achievement, progress)
        };
    });
}

function calculateIndividualProgress(achievement, progress) {
    switch (achievement.type) {
        case 'hunt_count':
            return progress.totalHunts;
        case 'observation_count':
            return progress.totalObservations;
        case 'bird_count':
            return progress.totalBirds;
        case 'wealth':
            return progress.netWorth;
        case 'rarity_count':
            return progress.rarityCount[achievement.rarity] || 0;
        default:
            return 0;
    }
}

function groupAchievementsByCategory(achievements) {
    const groups = {};
    
    achievements.forEach(achievement => {
        const category = achievement.category;
        if (!groups[category]) {
            groups[category] = [];
        }
        groups[category].push(achievement);
    });
    
    return groups;
}

function createProgressBar(current, total) {
    const percentage = Math.min(100, Math.round((current / total) * 100));
    const filledBars = Math.round(percentage / 5);
    const emptyBars = 20 - filledBars;
    
    return '▓'.repeat(filledBars) + '░'.repeat(emptyBars) + ` ${percentage}%`;
}

function calculateAchievementPoints(userAchievements) {
    // This would sum up points from actual achievement data
    return userAchievements.length * 25; // Simplified calculation
}

function getLatestAchievement(userAchievements) {
    if (!userAchievements.length) return null;
    
    const latest = userAchievements.reduce((latest, current) => {
        return new Date(current.unlocked_at) > new Date(latest.unlocked_at) ? current : latest;
    });
    
    return latest.achievement_id; // Would need to look up actual name
}

function getRarestAchievement(userAchievements) {
    // This would check rarity from achievement data
    return userAchievements.length > 5 ? 'Legendary Hunter' : null;
}

function getNextMilestone(completionRate) {
    const milestones = [25, 50, 75, 90, 100];
    const nextMilestone = milestones.find(m => m > completionRate);
    return nextMilestone ? `${nextMilestone}% completion` : 'All milestones reached!';
}

function getAchievementRank(completionRate) {
    if (completionRate >= 90) return 'Achievement Master';
    if (completionRate >= 75) return 'Achievement Expert';
    if (completionRate >= 50) return 'Achievement Hunter';
    if (completionRate >= 25) return 'Achievement Seeker';
    return 'Novice';
}

function getRecentUnlocks(userAchievements) {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    return userAchievements
        .filter(ua => new Date(ua.unlocked_at) > oneWeekAgo)
        .sort((a, b) => new Date(b.unlocked_at) - new Date(a.unlocked_at))
        .slice(0, 3)
        .map(ua => ({
            name: ua.achievement_id, // Would need to look up actual achievement data
            emoji: '🏆',
            unlocked_at: ua.unlocked_at
        }));
}

function getNearCompletionAchievements(allAchievements, userAchievements, progress) {
    const unlockedIds = new Set(userAchievements.map(ua => ua.achievement_id));
    
    return allAchievements
        .filter(achievement => !unlockedIds.has(achievement.id))
        .map(achievement => {
            const currentProgress = calculateIndividualProgress(achievement, progress);
            return {
                ...achievement,
                progress: currentProgress,
                completion: achievement.requirement ? currentProgress / achievement.requirement : 0
            };
        })
        .filter(achievement => achievement.completion >= 0.7 && achievement.completion < 1)
        .sort((a, b) => b.completion - a.completion)
        .slice(0, 3);
}

function getUnclaimedRewards(userAchievements) {
    // This would check for achievements with unclaimed rewards
    return userAchievements.filter(ua => !ua.claimed).slice(0, 5);
}

function getCategoryEmoji(category) {
    const emojis = {
        hunting: '🎯',
        collection: '🐦',
        observation: '👁️',
        economy: '💰',
        social: '🤝',
        gaming: '🎮',
        special: '⭐'
    };
    return emojis[category] || '🏆';
}

function getCategoryColor(category) {
    const colors = {
        hunting: config.colors.warning,
        collection: config.colors.primary,
        observation: config.colors.rare,
        economy: config.colors.success,
        social: config.colors.epic,
        gaming: config.colors.error,
        special: config.colors.legendary
    };
    return colors[category] || config.colors.primary;
}

function calculateCollectionValue(userBirds) {
    const rarityValues = {
        common: 30,
        uncommon: 60,
        rare: 150,
        epic: 400,
        legendary: 1200
    };

    let totalValue = 0;
    for (const bird of userBirds) {
        const baseValue = rarityValues[bird.rarity] || 30;
        const observationBonus = (bird.observations || 0) * 5;
        totalValue += baseValue + observationBonus;
    }

    return totalValue;
}

// Handle achievement interactions
module.exports.claimAchievementReward = async function(interaction, achievementId) {
    const userId = interaction.user.id;
    
    // Process reward claiming (simplified)
    const user = utils.getOrCreateUser(userId);
    const rewardAmount = 100; // Would come from achievement data
    
    queries.user.updateBalance.run(user.balance + rewardAmount, user.bank_balance, userId);
    
    const claimContainer = new ContainerBuilder()
        .setAccentColor(config.colors.success)
        .addTextDisplayComponents(
            textDisplay => textDisplay
                .setContent(`🎁 **Reward Claimed!**\n\nYou received **${rewardAmount} coins** for completing an achievement!\n\nKeep up the great work!`)
        );

    await interaction.update({
        components: [claimContainer],
        flags: MessageFlags.IsComponentsV2
    });
};

module.exports.shareAchievements = async function(interaction, userId) {
    const targetUser = await interaction.client.users.fetch(userId);
    const userAchievements = queries.achievement.getUserAchievements.all(userId);
    const completionRate = Math.round((userAchievements.length / 50) * 100); // Mock total

    const shareContainer = new ContainerBuilder()
        .setAccentColor(config.colors.legendary)
        .addTextDisplayComponents(
            textDisplay => textDisplay
                .setContent(`🏆 **${targetUser.username}'s Achievement Showcase**\n\n**Completion:** ${completionRate}%\n**Unlocked:** ${userAchievements.length} achievements\n**Latest:** ${getLatestAchievement(userAchievements) || 'None'}\n\nJoin the bird watching adventure!`)
        );

    await interaction.reply({
        components: [shareContainer],
        flags: MessageFlags.IsComponentsV2,
        ephemeral: false
    });
};
