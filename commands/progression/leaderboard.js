const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ContainerBuilder, SectionBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { queries, utils } = require('../../database/database.js');
const { getBirdById } = require('../../utils/birds.js');
const config = require('../../config.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View various leaderboards and rankings')
        .addStringOption(option =>
            option.setName('category')
                .setDescription('Leaderboard category to view')
                .setRequired(false)
                .addChoices(
                    { name: '💰 Wealth Rankings', value: 'wealth' },
                    { name: '🐦 Bird Collection', value: 'birds' },
                    { name: '🎯 Hunt Success', value: 'hunting' },
                    { name: '👁️ Observations', value: 'observations' },
                    { name: '🏆 Achievements', value: 'achievements' },
                    { name: '🤝 Social Score', value: 'social' },
                    { name: '🎮 Gaming Score', value: 'gaming' }
                ))
        .addStringOption(option =>
            option.setName('timeframe')
                .setDescription('Time period for rankings')
                .setRequired(false)
                .addChoices(
                    { name: '📅 Today', value: 'today' },
                    { name: '📆 This Week', value: 'week' },
                    { name: '🗓️ This Month', value: 'month' },
                    { name: '📋 All Time', value: 'all' }
                ))
        .addStringOption(option =>
            option.setName('scope')
                .setDescription('Leaderboard scope')
                .setRequired(false)
                .addChoices(
                    { name: '🌍 Global', value: 'global' },
                    { name: '🏛️ Guild Only', value: 'guild' },
                    { name: '👥 Friends', value: 'friends' }
                )),

    async execute(interaction) {
        const category = interaction.options.getString('category') || 'wealth';
        const timeframe = interaction.options.getString('timeframe') || 'all';
        const scope = interaction.options.getString('scope') || 'global';
        const userId = interaction.user.id;

        await displayLeaderboard(interaction, category, timeframe, scope, userId);
    }
};

async function displayLeaderboard(interaction, category, timeframe, scope, userId) {
    const leaderboardData = await getLeaderboardData(category, timeframe, scope, userId);
    const userRank = await getUserRank(userId, category, timeframe, scope);

    const leaderboardContainer = new ContainerBuilder()
        .setAccentColor(getCategoryColor(category));

    // Header section
    leaderboardContainer.addSectionComponents(
        section => section
            .addTextDisplayComponents(
                textDisplay => textDisplay
                    .setContent(`🏆 **${getCategoryName(category)} Leaderboard**\n\n**${getTimeframeName(timeframe)} • ${getScopeName(scope)}**`)
                    .setId('leaderboard_header'),
                textDisplay => textDisplay
                    .setContent(`**Total Participants:** ${leaderboardData.totalParticipants}\n**Last Updated:** <t:${Math.floor(Date.now() / 1000)}:R>\n**Your Rank:** ${userRank.position || 'Unranked'}`)
                    .setId('leaderboard_meta')
            )
            .setThumbnailAccessory(
                thumbnail => thumbnail
                    .setURL('https://cdn.discordapp.com/attachments/placeholder/leaderboard_trophy.png')
                    .setDescription('Leaderboard trophy')
            )
    );

    // Top 10 rankings
    if (leaderboardData.rankings.length > 0) {
        leaderboardContainer.addSectionComponents(
            section => section
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('🥇 **Top Performers**')
                        .setId('top_performers_header'),
                    textDisplay => textDisplay
                        .setContent(formatTopRankings(leaderboardData.rankings.slice(0, 10), category))
                        .setId('top_performers_list')
                )
                .setButtonAccessory(
                    button => button
                        .setCustomId(`view_full_rankings_${category}`)
                        .setLabel('📋 View All')
                        .setStyle(ButtonStyle.Secondary)
                )
        );
    }

    // User's position and nearby ranks
    if (userRank.position && userRank.position > 10) {
        const nearbyRanks = await getNearbyRanks(userId, category, timeframe, scope);
        
        leaderboardContainer.addSectionComponents(
            section => section
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent(`📍 **Your Position (#${userRank.position})**`)
                        .setId('user_position_header'),
                    textDisplay => textDisplay
                        .setContent(formatNearbyRankings(nearbyRanks, userId))
                        .setId('user_position_nearby')
                )
                .setButtonAccessory(
                    button => button
                        .setCustomId(`jump_to_rank_${userRank.position}`)
                        .setLabel('🎯 Jump to Me')
                        .setStyle(ButtonStyle.Primary)
                )
        );
    }

    // Category-specific insights
    await addCategoryInsights(leaderboardContainer, category, leaderboardData);

    // Achievements and milestones
    const milestones = await getCategoryMilestones(category);
    if (milestones.length > 0) {
        leaderboardContainer.addSectionComponents(
            section => section
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('🎯 **Ranking Milestones**')
                        .setId('milestones_header'),
                    textDisplay => textDisplay
                        .setContent(milestones.map(m => `**${m.rank}:** ${m.reward}`).join('\n'))
                        .setId('milestones_list')
                )
                .setButtonAccessory(
                    button => button
                        .setCustomId(`milestone_rewards_${category}`)
                        .setLabel('🎁 Rewards')
                        .setStyle(ButtonStyle.Success)
                )
        );
    }

    // Competition info
    const currentCompetition = await getCurrentCompetition(category);
    if (currentCompetition) {
        leaderboardContainer.addSectionComponents(
            section => section
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent(`⚔️ **${currentCompetition.name}**\n*Active Competition*`)
                        .setId('competition_header'),
                    textDisplay => textDisplay
                        .setContent(`${currentCompetition.description}\n\n**Ends:** <t:${currentCompetition.endTime}:R>\n**Prize Pool:** ${currentCompetition.prizePool}`)
                        .setId('competition_details')
                )
                .setButtonAccessory(
                    button => button
                        .setCustomId(`join_competition_${currentCompetition.id}`)
                        .setLabel('⚔️ Join')
                        .setStyle(ButtonStyle.Danger)
                )
        );
    }

    // Navigation and filters
    const categoryRow = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('leaderboard_category')
                .setPlaceholder('Choose leaderboard category')
                .addOptions([
                    { label: '💰 Wealth Rankings', value: 'wealth', description: 'Total coins and net worth' },
                    { label: '🐦 Bird Collection', value: 'birds', description: 'Number of birds collected' },
                    { label: '🎯 Hunt Success', value: 'hunting', description: 'Hunting achievements and success rate' },
                    { label: '👁️ Observations', value: 'observations', description: 'Total bird observations made' },
                    { label: '🏆 Achievements', value: 'achievements', description: 'Achievement points earned' },
                    { label: '🤝 Social Score', value: 'social', description: 'Trading and social activity' },
                    { label: '🎮 Gaming Score', value: 'gaming', description: 'Mini-game performance' }
                ])
        );

    const filterRow = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('leaderboard_timeframe')
                .setPlaceholder('Choose time period')
                .addOptions([
                    { label: '📅 Today', value: 'today', description: 'Rankings for today only' },
                    { label: '📆 This Week', value: 'week', description: 'This week\'s performance' },
                    { label: '🗓️ This Month', value: 'month', description: 'Monthly rankings' },
                    { label: '📋 All Time', value: 'all', description: 'All-time leaderboards' }
                ]),
            new StringSelectMenuBuilder()
                .setCustomId('leaderboard_scope')
                .setPlaceholder('Choose scope')
                .addOptions([
                    { label: '🌍 Global', value: 'global', description: 'All players worldwide' },
                    { label: '🏛️ Guild Only', value: 'guild', description: 'Only your guild members' },
                    { label: '👥 Friends', value: 'friends', description: 'Your friends only' }
                ])
        );

    const actionRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`refresh_leaderboard_${category}`)
                .setLabel('🔄 Refresh')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`export_leaderboard_${category}`)
                .setLabel('💾 Export')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`share_ranking_${category}`)
                .setLabel('📤 Share Rank')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('leaderboard_help')
                .setLabel('ℹ️ Help')
                .setStyle(ButtonStyle.Secondary)
        );

    await interaction.reply({
        components: [leaderboardContainer, categoryRow, filterRow, actionRow],
        flags: MessageFlags.IsComponentsV2,
        ephemeral: false
    });
}

async function getLeaderboardData(category, timeframe, scope, userId) {
    // Get all users and sort by the specified category
    const allUsers = queries.user.getAllUsers.all(100);
    
    let rankings = [];

    switch (category) {
        case 'wealth':
            rankings = allUsers.map(user => {
                const netWorth = (user.balance || 0) + (user.bank_balance || 0);
                return {
                    userId: user.user_id,
                    username: user.username,
                    value: netWorth,
                    displayValue: `${netWorth.toLocaleString()} coins`,
                    extraInfo: `Bank: ${(user.bank_balance || 0).toLocaleString()}`
                };
            }).sort((a, b) => b.value - a.value);
            break;

        case 'birds':
            rankings = allUsers.map(user => {
                const userBirds = queries.bird.getUserBirds.all(user.user_id);
                return {
                    userId: user.user_id,
                    username: user.username,
                    value: userBirds.length,
                    displayValue: `${userBirds.length} birds`,
                    extraInfo: getRarityBreakdown(userBirds)
                };
            }).sort((a, b) => b.value - a.value);
            break;

        case 'hunting':
            rankings = allUsers.map(user => {
                const hunts = user.total_hunts || 0;
                return {
                    userId: user.user_id,
                    username: user.username,
                    value: hunts,
                    displayValue: `${hunts} hunts`,
                    extraInfo: `Success rate: ${calculateSuccessRate(user)}%`
                };
            }).sort((a, b) => b.value - a.value);
            break;

        case 'observations':
            rankings = allUsers.map(user => {
                const observations = user.total_observations || 0;
                return {
                    userId: user.user_id,
                    username: user.username,
                    value: observations,
                    displayValue: `${observations} observations`,
                    extraInfo: `Avg per bird: ${calculateAvgObservations(user)}`
                };
            }).sort((a, b) => b.value - a.value);
            break;

        default:
            // Mock data for other categories
            rankings = allUsers.map((user, index) => ({
                userId: user.user_id,
                username: user.username,
                value: Math.floor(Math.random() * 1000) + index,
                displayValue: `${Math.floor(Math.random() * 1000) + index} points`,
                extraInfo: 'Various achievements'
            })).sort((a, b) => b.value - a.value);
    }

    return {
        rankings: rankings.slice(0, 50), // Top 50
        totalParticipants: allUsers.length
    };
}

async function getUserRank(userId, category, timeframe, scope) {
    const leaderboardData = await getLeaderboardData(category, timeframe, scope, userId);
    const userIndex = leaderboardData.rankings.findIndex(rank => rank.userId === userId);
    
    return {
        position: userIndex >= 0 ? userIndex + 1 : null,
        value: userIndex >= 0 ? leaderboardData.rankings[userIndex].value : 0
    };
}

async function getNearbyRanks(userId, category, timeframe, scope) {
    const leaderboardData = await getLeaderboardData(category, timeframe, scope, userId);
    const userIndex = leaderboardData.rankings.findIndex(rank => rank.userId === userId);
    
    if (userIndex === -1) return [];

    const start = Math.max(0, userIndex - 2);
    const end = Math.min(leaderboardData.rankings.length, userIndex + 3);
    
    return leaderboardData.rankings.slice(start, end).map((rank, index) => ({
        ...rank,
        position: start + index + 1
    }));
}

function formatTopRankings(rankings, category) {
    const emojis = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    
    return rankings.map((rank, index) => {
        const emoji = emojis[index] || `${index + 1}️⃣`;
        return `${emoji} **${rank.username}** - ${rank.displayValue}`;
    }).join('\n');
}

function formatNearbyRankings(rankings, userId) {
    return rankings.map(rank => {
        const isUser = rank.userId === userId;
        const indicator = isUser ? '➤' : '  ';
        const formatting = isUser ? '**' : '';
        return `${indicator} ${formatting}#${rank.position} ${rank.username} - ${rank.displayValue}${formatting}`;
    }).join('\n');
}

async function addCategoryInsights(container, category, data) {
    let insights = '';
    
    switch (category) {
        case 'wealth':
            const totalWealth = data.rankings.reduce((sum, rank) => sum + rank.value, 0);
            const averageWealth = Math.round(totalWealth / data.rankings.length);
            insights = `**Total Economy:** ${totalWealth.toLocaleString()} coins\n**Average Wealth:** ${averageWealth.toLocaleString()} coins\n**Wealth Gap:** ${data.rankings[0]?.value || 0 - data.rankings[data.rankings.length - 1]?.value || 0} coins`;
            break;
            
        case 'birds':
            const totalBirds = data.rankings.reduce((sum, rank) => sum + rank.value, 0);
            const averageBirds = Math.round(totalBirds / data.rankings.length);
            insights = `**Total Birds Captured:** ${totalBirds.toLocaleString()}\n**Average Collection:** ${averageBirds} birds\n**Largest Collection:** ${data.rankings[0]?.value || 0} birds`;
            break;
            
        default:
            insights = `**Active Participants:** ${data.totalParticipants}\n**Competition Level:** High\n**Recent Activity:** Very Active`;
    }

    if (insights) {
        container.addSectionComponents(
            section => section
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent(`📊 **Category Insights**`)
                        .setId('insights_header'),
                    textDisplay => textDisplay
                        .setContent(insights)
                        .setId('insights_data')
                )
                .setButtonAccessory(
                    button => button
                        .setCustomId(`detailed_insights_${category}`)
                        .setLabel('📈 Details')
                        .setStyle(ButtonStyle.Secondary)
                )
        );
    }
}

async function getCategoryMilestones(category) {
    const milestones = {
        wealth: [
            { rank: 'Top 10', reward: 'Golden Crown Badge + 1000 coins' },
            { rank: 'Top 50', reward: 'Silver Crown Badge + 500 coins' },
            { rank: 'Top 100', reward: 'Bronze Crown Badge + 250 coins' }
        ],
        birds: [
            { rank: 'Top 10', reward: 'Master Collector Title + Rare Bird' },
            { rank: 'Top 50', reward: 'Dedicated Collector Badge' },
            { rank: 'Top 100', reward: 'Bird Enthusiast Badge' }
        ],
        hunting: [
            { rank: 'Top 10', reward: 'Legendary Hunter Title + Premium Equipment' },
            { rank: 'Top 50', reward: 'Expert Hunter Badge' },
            { rank: 'Top 100', reward: 'Skilled Hunter Badge' }
        ]
    };

    return milestones[category] || [];
}

async function getCurrentCompetition(category) {
    // Mock competition data
    const competitions = {
        wealth: {
            id: 'wealth_comp_1',
            name: 'Wealth Rush Championship',
            description: 'Compete to accumulate the most wealth this week!',
            endTime: Math.floor((Date.now() + 7 * 24 * 60 * 60 * 1000) / 1000),
            prizePool: '10,000 coins + Exclusive Titles'
        },
        birds: {
            id: 'birds_comp_1',
            name: 'Collection Sprint',
            description: 'See who can collect the most unique birds!',
            endTime: Math.floor((Date.now() + 3 * 24 * 60 * 60 * 1000) / 1000),
            prizePool: 'Legendary Bird + 5,000 coins'
        }
    };

    return competitions[category] || null;
}

function getCategoryColor(category) {
    const colors = {
        wealth: config.colors.success,
        birds: config.colors.primary,
        hunting: config.colors.warning,
        observations: config.colors.rare,
        achievements: config.colors.legendary,
        social: config.colors.epic,
        gaming: config.colors.error
    };
    return colors[category] || config.colors.primary;
}

function getCategoryName(category) {
    const names = {
        wealth: 'Wealth Rankings',
        birds: 'Bird Collection',
        hunting: 'Hunt Success',
        observations: 'Observations',
        achievements: 'Achievement Points',
        social: 'Social Score',
        gaming: 'Gaming Score'
    };
    return names[category] || category;
}

function getTimeframeName(timeframe) {
    const names = {
        today: 'Today',
        week: 'This Week',
        month: 'This Month',
        all: 'All Time'
    };
    return names[timeframe] || timeframe;
}

function getScopeName(scope) {
    const names = {
        global: 'Global',
        guild: 'Guild Only',
        friends: 'Friends'
    };
    return names[scope] || scope;
}

function getRarityBreakdown(userBirds) {
    const counts = { legendary: 0, epic: 0, rare: 0, uncommon: 0, common: 0 };
    userBirds.forEach(bird => {
        if (counts.hasOwnProperty(bird.rarity)) counts[bird.rarity]++;
    });
    
    const breakdown = Object.entries(counts)
        .filter(([rarity, count]) => count > 0)
        .map(([rarity, count]) => `${count} ${rarity}`)
        .join(', ');
    
    return breakdown || 'None';
}

function calculateSuccessRate(user) {
    const hunts = user.total_hunts || 0;
    if (hunts === 0) return 0;
    return Math.round(75 + Math.random() * 20); // Mock calculation
}

function calculateAvgObservations(user) {
    const observations = user.total_observations || 0;
    const userBirds = queries.bird.getUserBirds.all(user.user_id);
    if (userBirds.length === 0) return 0;
    return Math.round((observations / userBirds.length) * 10) / 10;
}

// Handle leaderboard interactions
module.exports.handleLeaderboardNavigation = async function(interaction, category, timeframe, scope) {
    await displayLeaderboard(interaction, category, timeframe, scope, interaction.user.id);
};

module.exports.shareRanking = async function(interaction, category) {
    const userRank = await getUserRank(interaction.user.id, category, 'all', 'global');
    
    const shareContainer = new ContainerBuilder()
        .setAccentColor(getCategoryColor(category))
        .addTextDisplayComponents(
            textDisplay => textDisplay
                .setContent(`🏆 **${interaction.user.username}'s Ranking**\n\n**Category:** ${getCategoryName(category)}\n**Rank:** #${userRank.position || 'Unranked'}\n**Score:** ${userRank.value}\n\nJoin the competition and climb the leaderboard!`)
        );

    await interaction.reply({
        components: [shareContainer],
        flags: MessageFlags.IsComponentsV2,
        ephemeral: false
    });
};
