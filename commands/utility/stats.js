const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ContainerBuilder, SectionBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { queries, utils } = require('../../database/database.js');
const { getBirdById } = require('../../utils/birds.js');
const config = require('../../config.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('View detailed statistics about your bird watching activities')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('View another user\'s statistics')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('period')
                .setDescription('Time period for statistics')
                .setRequired(false)
                .addChoices(
                    { name: '📅 Today', value: 'today' },
                    { name: '📆 This Week', value: 'week' },
                    { name: '🗓️ This Month', value: 'month' },
                    { name: '📋 All Time', value: 'all' }
                ))
        .addStringOption(option =>
            option.setName('category')
                .setDescription('Focus on specific statistics')
                .setRequired(false)
                .addChoices(
                    { name: '🎯 Hunting Stats', value: 'hunting' },
                    { name: '💰 Economy Stats', value: 'economy' },
                    { name: '🐦 Collection Stats', value: 'collection' },
                    { name: '🤝 Social Stats', value: 'social' },
                    { name: '🎮 Gaming Stats', value: 'gaming' }
                )),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const period = interaction.options.getString('period') || 'all';
        const category = interaction.options.getString('category') || 'overview';
        const isOwner = targetUser.id === interaction.user.id;

        const user = utils.getOrCreateUser(targetUser.id, targetUser.username);
        const userBirds = queries.bird.getUserBirds.all(targetUser.id);
        const userItems = queries.item.getUserItems.all(targetUser.id);

        await displayStats(interaction, targetUser, user, userBirds, userItems, period, category, isOwner);
    }
};

async function displayStats(interaction, targetUser, userData, userBirds, userItems, period, category, isOwner) {
    const stats = await calculateStats(targetUser.id, userData, userBirds, userItems, period);
    
    const statsContainer = new ContainerBuilder()
        .setAccentColor(config.colors.primary);

    // Header section
    statsContainer.addSectionComponents(
        section => section
            .addTextDisplayComponents(
                textDisplay => textDisplay
                    .setContent(`📊 **${targetUser.username}'s Statistics**\n\n**Period:** ${getPeriodName(period)}\n**Category:** ${getCategoryName(category)}`)
                    .setId('stats_header'),
                textDisplay => textDisplay
                    .setContent(`**Data Collection Since:** <t:${Math.floor(new Date(userData.created_at).getTime() / 1000)}:R>\n**Last Active:** <t:${Math.floor(Date.now() / 1000)}:R>`)
                    .setId('stats_meta')
            )
            .setThumbnailAccessory(
                thumbnail => thumbnail
                    .setURL(targetUser.displayAvatarURL({ size: 256 }))
                    .setDescription(`${targetUser.username}'s avatar`)
            )
    );

    if (category === 'overview' || category === 'hunting') {
        // Hunting Statistics
        statsContainer.addSectionComponents(
            section => section
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('🎯 **Hunting Performance**')
                        .setId('hunting_header'),
                    textDisplay => textDisplay
                        .setContent(`**Total Hunts:** ${stats.hunting.totalHunts}\n**Success Rate:** ${stats.hunting.successRate}%\n**Average per Day:** ${stats.hunting.averagePerDay}`)
                        .setId('hunting_main'),
                    textDisplay => textDisplay
                        .setContent(`**Favorite Location:** ${stats.hunting.favoriteLocation}\n**Best Equipment:** ${stats.hunting.bestEquipment}\n**Streak Record:** ${stats.hunting.longestStreak} days`)
                        .setId('hunting_details')
                )
                .setButtonAccessory(
                    button => button
                        .setCustomId(`hunting_breakdown_${targetUser.id}`)
                        .setLabel('📈 Breakdown')
                        .setStyle(ButtonStyle.Secondary)
                )
        );
    }

    if (category === 'overview' || category === 'collection') {
        // Collection Statistics
        const rarityStats = stats.collection.byRarity;
        const rarityText = Object.entries(rarityStats)
            .filter(([rarity, count]) => count > 0)
            .map(([rarity, count]) => `**${rarity.charAt(0).toUpperCase() + rarity.slice(1)}:** ${count}`)
            .join('\n') || 'No birds collected';

        statsContainer.addSectionComponents(
            section => section
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent(`🐦 **Collection Overview**\n\n**Total Birds:** ${stats.collection.totalBirds}`)
                        .setId('collection_header'),
                    textDisplay => textDisplay
                        .setContent(rarityStats)
                        .setId('collection_rarity'),
                    textDisplay => textDisplay
                        .setContent(`**Collection Value:** ${stats.collection.totalValue.toLocaleString()} coins\n**Completion:** ${stats.collection.completionRate}%\n**Rarest Find:** ${stats.collection.rarestBird}`)
                        .setId('collection_stats')
                )
                .setButtonAccessory(
                    button => button
                        .setCustomId(`collection_analysis_${targetUser.id}`)
                        .setLabel('🔍 Analysis')
                        .setStyle(ButtonStyle.Primary)
                )
        );

        // Observation Statistics
        statsContainer.addSectionComponents(
            section => section
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('👁️ **Observation Records**')
                        .setId('observation_header'),
                    textDisplay => textDisplay
                        .setContent(`**Total Observations:** ${stats.observation.totalObservations}\n**Average per Bird:** ${stats.observation.averagePerBird}\n**Most Observed:** ${stats.observation.mostObserved}`)
                        .setId('observation_stats')
                )
                .setButtonAccessory(
                    button => button
                        .setCustomId(`observation_details_${targetUser.id}`)
                        .setLabel('👁️ Details')
                        .setStyle(ButtonStyle.Secondary)
                )
        );
    }

    if (category === 'overview' || category === 'economy') {
        // Economic Statistics
        statsContainer.addSectionComponents(
            section => section
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('💰 **Economic Performance**')
                        .setId('economy_header'),
                    textDisplay => textDisplay
                        .setContent(`**Net Worth:** ${stats.economy.netWorth.toLocaleString()} coins\n**Total Earned:** ${stats.economy.totalEarned.toLocaleString()} coins\n**Total Spent:** ${stats.economy.totalSpent.toLocaleString()} coins`)
                        .setId('economy_main'),
                    textDisplay => textDisplay
                        .setContent(`**Work Sessions:** ${stats.economy.workSessions}\n**Trade Value:** ${stats.economy.tradeValue.toLocaleString()} coins\n**Gifts Given:** ${stats.economy.giftsGiven.toLocaleString()} coins`)
                        .setId('economy_activity')
                )
                .setButtonAccessory(
                    button => button
                        .setCustomId(`economy_trends_${targetUser.id}`)
                        .setLabel('📊 Trends')
                        .setStyle(ButtonStyle.Success)
                )
        );
    }

    if (category === 'overview' || category === 'social') {
        // Social Statistics
        statsContainer.addSectionComponents(
            section => section
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('🤝 **Social Activity**')
                        .setId('social_header'),
                    textDisplay => textDisplay
                        .setContent(`**Trades Completed:** ${stats.social.tradesCompleted}\n**Gifts Sent:** ${stats.social.giftsSent}\n**Duels Won:** ${stats.social.duelsWon}/${stats.social.totalDuels}`)
                        .setId('social_main'),
                    textDisplay => textDisplay
                        .setContent(`**Guild Role:** ${stats.social.guildRole}\n**Guild Contributions:** ${stats.social.guildContributions}\n**Reputation Score:** ${stats.social.reputationScore}/100`)
                        .setId('social_reputation')
                )
                .setButtonAccessory(
                    button => button
                        .setCustomId(`social_network_${targetUser.id}`)
                        .setLabel('🌐 Network')
                        .setStyle(ButtonStyle.Primary)
                )
        );
    }

    if (category === 'overview' || category === 'gaming') {
        // Gaming Statistics
        statsContainer.addSectionComponents(
            section => section
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('🎮 **Gaming Performance**')
                        .setId('gaming_header'),
                    textDisplay => textDisplay
                        .setContent(`**Minigames Played:** ${stats.gaming.totalGames}\n**Average Score:** ${stats.gaming.averageScore}\n**High Score:** ${stats.gaming.highScore}`)
                        .setId('gaming_main'),
                    textDisplay => textDisplay
                        .setContent(`**Favorite Game:** ${stats.gaming.favoriteGame}\n**Win Rate:** ${stats.gaming.winRate}%\n**Gaming Earnings:** ${stats.gaming.totalEarnings.toLocaleString()} coins`)
                        .setId('gaming_details')
                )
                .setButtonAccessory(
                    button => button
                        .setCustomId(`gaming_history_${targetUser.id}`)
                        .setLabel('🎯 History')
                        .setStyle(ButtonStyle.Secondary)
                )
        );
    }

    // Achievements Progress
    const recentAchievements = await getRecentAchievements(targetUser.id);
    if (recentAchievements.length > 0) {
        statsContainer.addSectionComponents(
            section => section
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('🏆 **Recent Achievements**')
                        .setId('achievements_header'),
                    textDisplay => textDisplay
                        .setContent(recentAchievements.map(ach => `${ach.emoji} **${ach.name}**`).join('\n'))
                        .setId('achievements_list')
                )
                .setButtonAccessory(
                    button => button
                        .setCustomId(`all_achievements_${targetUser.id}`)
                        .setLabel('🏆 View All')
                        .setStyle(ButtonStyle.Success)
                )
        );
    }

    // Performance metrics
    const performanceLevel = calculatePerformanceLevel(stats);
    statsContainer.addSectionComponents(
        section => section
            .addTextDisplayComponents(
                textDisplay => textDisplay
                    .setContent(`⭐ **Performance Level: ${performanceLevel.name}**`)
                    .setId('performance_header'),
                textDisplay => textDisplay
                    .setContent(`**Overall Score:** ${performanceLevel.score}/1000\n**Rank:** ${performanceLevel.rank}\n**Next Level:** ${performanceLevel.nextLevel}`)
                    .setId('performance_details')
            )
            .setButtonAccessory(
                button => button
                    .setCustomId(`performance_tips_${targetUser.id}`)
                    .setLabel('💡 Tips')
                    .setStyle(ButtonStyle.Primary)
            )
    );

    // Category selector and navigation
    const categoryRow = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`stats_category_${targetUser.id}`)
                .setPlaceholder('Choose statistics category')
                .addOptions([
                    { label: '📊 Overview', value: 'overview', description: 'General statistics summary' },
                    { label: '🎯 Hunting', value: 'hunting', description: 'Bird hunting performance' },
                    { label: '🐦 Collection', value: 'collection', description: 'Bird collection analysis' },
                    { label: '💰 Economy', value: 'economy', description: 'Financial statistics' },
                    { label: '🤝 Social', value: 'social', description: 'Social interaction stats' },
                    { label: '🎮 Gaming', value: 'gaming', description: 'Mini-game performance' }
                ])
        );

    const periodRow = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`stats_period_${targetUser.id}`)
                .setPlaceholder('Choose time period')
                .addOptions([
                    { label: '📅 Today', value: 'today', description: 'Statistics for today' },
                    { label: '📆 This Week', value: 'week', description: 'Statistics for this week' },
                    { label: '🗓️ This Month', value: 'month', description: 'Statistics for this month' },
                    { label: '📋 All Time', value: 'all', description: 'All-time statistics' }
                ])
        );

    const actionRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`export_stats_${targetUser.id}`)
                .setLabel('💾 Export')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(!isOwner),
            new ButtonBuilder()
                .setCustomId(`compare_stats_${targetUser.id}`)
                .setLabel('⚖️ Compare')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`stats_refresh_${targetUser.id}`)
                .setLabel('🔄 Refresh')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('leaderboards')
                .setLabel('🏆 Leaderboards')
                .setStyle(ButtonStyle.Success)
        );

    await interaction.reply({
        components: [statsContainer, categoryRow, periodRow, actionRow],
        flags: MessageFlags.IsComponentsV2,
        ephemeral: isOwner
    });
}

async function calculateStats(userId, userData, userBirds, userItems, period) {
    const stats = {
        hunting: {
            totalHunts: userData.total_hunts || 0,
            successRate: calculateSuccessRate(userData),
            averagePerDay: calculateDailyAverage(userData.total_hunts || 0, userData.created_at),
            favoriteLocation: getMostUsedLocation(userBirds),
            bestEquipment: 'Basic Net',
            longestStreak: 0
        },
        collection: {
            totalBirds: userBirds.length,
            byRarity: calculateRarityDistribution(userBirds),
            totalValue: calculateCollectionValue(userBirds),
            completionRate: calculateCompletionRate(userBirds),
            rarestBird: getRarestBird(userBirds)
        },
        observation: {
            totalObservations: userData.total_observations || 0,
            averagePerBird: userBirds.length > 0 ? Math.round((userData.total_observations || 0) / userBirds.length * 10) / 10 : 0,
            mostObserved: getMostObservedBird(userBirds)
        },
        economy: {
            netWorth: (userData.balance || 0) + (userData.bank_balance || 0),
            totalEarned: calculateTotalEarned(userData),
            totalSpent: calculateTotalSpent(userData),
            workSessions: 0,
            tradeValue: 0,
            giftsGiven: 0
        },
        social: {
            tradesCompleted: 0,
            giftsSent: 0,
            duelsWon: 0,
            totalDuels: 0,
            guildRole: 'None',
            guildContributions: 0,
            reputationScore: calculateReputationScore(userData)
        },
        gaming: {
            totalGames: 0,
            averageScore: 0,
            highScore: 0,
            favoriteGame: 'None',
            winRate: 0,
            totalEarnings: 0
        }
    };

    return stats;
}

function calculateSuccessRate(userData) {
    const totalHunts = userData.total_hunts || 0;
    if (totalHunts === 0) return 0;
    
    // Estimate based on typical success rates
    return Math.round(75 + Math.random() * 20);
}

function calculateDailyAverage(totalHunts, createdAt) {
    const daysSinceCreation = Math.max(1, Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)));
    return Math.round((totalHunts / daysSinceCreation) * 10) / 10;
}

function getMostUsedLocation(userBirds) {
    if (!userBirds.length) return 'None';
    
    const locationCount = {};
    for (const bird of userBirds) {
        locationCount[bird.location] = (locationCount[bird.location] || 0) + 1;
    }
    
    return Object.entries(locationCount)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'Unknown';
}

function calculateRarityDistribution(userBirds) {
    const distribution = {
        common: 0,
        uncommon: 0,
        rare: 0,
        epic: 0,
        legendary: 0
    };

    for (const bird of userBirds) {
        if (distribution.hasOwnProperty(bird.rarity)) {
            distribution[bird.rarity]++;
        }
    }

    return Object.entries(distribution)
        .filter(([rarity, count]) => count > 0)
        .map(([rarity, count]) => `**${rarity.charAt(0).toUpperCase() + rarity.slice(1)}:** ${count}`)
        .join('\n') || 'No birds collected';
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

function calculateCompletionRate(userBirds) {
    // Estimate based on total possible birds (would need to be calculated from birds.json)
    const totalPossibleBirds = 100; // Placeholder
    return Math.round((userBirds.length / totalPossibleBirds) * 100);
}

function getRarestBird(userBirds) {
    const rarityOrder = { legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 };
    
    let rarestBird = null;
    let highestRarity = 0;

    for (const userBird of userBirds) {
        const rarityValue = rarityOrder[userBird.rarity] || 0;
        if (rarityValue > highestRarity) {
            highestRarity = rarityValue;
            const bird = getBirdById(userBird.bird_id);
            rarestBird = bird?.name || 'Unknown';
        }
    }

    return rarestBird || 'None';
}

function getMostObservedBird(userBirds) {
    if (!userBirds.length) return 'None';
    
    const mostObserved = userBirds.reduce((max, bird) => 
        (bird.observations || 0) > (max.observations || 0) ? bird : max
    );
    
    const bird = getBirdById(mostObserved.bird_id);
    return bird?.name || 'Unknown';
}

function calculateTotalEarned(userData) {
    // Estimate based on current balance and activities
    return (userData.balance || 0) + (userData.bank_balance || 0) + ((userData.total_hunts || 0) * 25);
}

function calculateTotalSpent(userData) {
    // Estimate based on hunts and activities
    return (userData.total_hunts || 0) * 25;
}

function calculateReputationScore(userData) {
    // Calculate reputation based on various factors
    let score = 50; // Base score
    
    // Add points for activities
    score += Math.min(25, (userData.total_hunts || 0) * 0.5);
    score += Math.min(25, (userData.total_observations || 0) * 0.2);
    
    return Math.min(100, Math.round(score));
}

async function getRecentAchievements(userId) {
    // Mock recent achievements
    return [
        { name: 'First Hunt', emoji: '🎯' },
        { name: 'Observer', emoji: '👁️' },
        { name: 'Collector', emoji: '📚' }
    ];
}

function calculatePerformanceLevel(stats) {
    let score = 0;
    
    // Calculate performance score based on various metrics
    score += Math.min(200, stats.hunting.totalHunts * 2);
    score += Math.min(200, stats.collection.totalBirds * 5);
    score += Math.min(200, stats.observation.totalObservations);
    score += Math.min(200, stats.economy.netWorth / 100);
    score += Math.min(200, stats.social.reputationScore * 2);

    const levels = [
        { name: 'Novice Watcher', min: 0, max: 199 },
        { name: 'Skilled Observer', min: 200, max: 399 },
        { name: 'Expert Naturalist', min: 400, max: 599 },
        { name: 'Master Birder', min: 600, max: 799 },
        { name: 'Legendary Ornithologist', min: 800, max: 1000 }
    ];

    const currentLevel = levels.find(level => score >= level.min && score <= level.max) || levels[0];
    const nextLevel = levels[levels.indexOf(currentLevel) + 1];

    return {
        name: currentLevel.name,
        score: Math.round(score),
        rank: `#${Math.floor(Math.random() * 1000) + 1}`, // Placeholder
        nextLevel: nextLevel ? nextLevel.name : 'Max Level Reached'
    };
}

function getPeriodName(period) {
    const names = {
        today: 'Today',
        week: 'This Week',
        month: 'This Month',
        all: 'All Time'
    };
    return names[period] || 'All Time';
}

function getCategoryName(category) {
    const names = {
        overview: 'Overview',
        hunting: 'Hunting Performance',
        collection: 'Collection Analysis',
        economy: 'Economic Performance',
        social: 'Social Activity',
        gaming: 'Gaming Performance'
    };
    return names[category] || 'Overview';
}

// Handle stats navigation
module.exports.handleStatsNavigation = async function(interaction, userId, category, period) {
    const targetUser = await interaction.client.users.fetch(userId);
    const userData = utils.getOrCreateUser(userId);
    const userBirds = queries.bird.getUserBirds.all(userId);
    const userItems = queries.item.getUserItems.all(userId);
    const isOwner = userId === interaction.user.id;

    await displayStats(interaction, targetUser, userData, userBirds, userItems, period, category, isOwner);
};
