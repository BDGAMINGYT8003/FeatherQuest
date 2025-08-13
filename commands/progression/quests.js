const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ContainerBuilder, SectionBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { queries, utils } = require('../../database/database.js');
const { getBirdById } = require('../../utils/birds.js');
const config = require('../../config.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('quests')
        .setDescription('View and manage your bird watching quests and challenges')
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Quest action to perform')
                .setRequired(false)
                .addChoices(
                    { name: '📋 View Active', value: 'active' },
                    { name: '✅ View Completed', value: 'completed' },
                    { name: '📚 Browse Available', value: 'available' },
                    { name: '🎯 Daily Challenges', value: 'daily' },
                    { name: '⭐ Weekly Challenges', value: 'weekly' }
                ))
        .addIntegerOption(option =>
            option.setName('quest_id')
                .setDescription('Specific quest ID to view or manage')
                .setRequired(false)
        ),

    async execute(interaction) {
        const userId = interaction.user.id;
        const action = interaction.options.getString('action') || 'active';
        const questId = interaction.options.getInteger('quest_id');

        const user = utils.getOrCreateUser(userId, interaction.user.username);

        if (questId) {
            await showQuestDetails(interaction, user, questId);
        } else {
            await showQuestInterface(interaction, user, action);
        }
    }
};

async function showQuestInterface(interaction, user, action) {
    const questContainer = new ContainerBuilder()
        .setAccentColor(config.colors.primary);

    // Header section
    questContainer.addSectionComponents(
        section => section
            .addTextDisplayComponents(
                textDisplay => textDisplay
                    .setContent('📋 **Quest Journal**\n\nTrack your progress on various bird watching challenges and earn rewards!')
                    .setId('quest_header'),
                textDisplay => textDisplay
                    .setContent(`**Active Quests:** ${await getActiveQuestCount(user.user_id)}\n**Completed Today:** ${await getTodayCompletedCount(user.user_id)}\n**Quest Points:** ${await getQuestPoints(user.user_id)}`)
                    .setId('quest_overview')
            )
            .setButtonAccessory(
                button => button
                    .setCustomId('quest_help')
                    .setLabel('ℹ️ Help')
                    .setStyle(ButtonStyle.Secondary)
            )
    );

    if (action === 'active') {
        await showActiveQuests(questContainer, user);
    } else if (action === 'completed') {
        await showCompletedQuests(questContainer, user);
    } else if (action === 'available') {
        await showAvailableQuests(questContainer, user);
    } else if (action === 'daily') {
        await showDailyQuests(questContainer, user);
    } else if (action === 'weekly') {
        await showWeeklyQuests(questContainer, user);
    }

    // Navigation buttons
    const navigationRow = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('quest_category')
                .setPlaceholder('Choose quest category')
                .addOptions([
                    { label: '📋 Active Quests', value: 'active', description: 'Currently in progress' },
                    { label: '✅ Completed Quests', value: 'completed', description: 'Finished quests' },
                    { label: '📚 Available Quests', value: 'available', description: 'New quests to start' },
                    { label: '🎯 Daily Challenges', value: 'daily', description: 'Today\'s special challenges' },
                    { label: '⭐ Weekly Challenges', value: 'weekly', description: 'This week\'s challenges' }
                ])
        );

    const actionRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('refresh_quests')
                .setLabel('🔄 Refresh')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('abandon_quest')
                .setLabel('🗑️ Abandon Quest')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId('quest_rewards')
                .setLabel('🎁 Claim Rewards')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('quest_shop')
                .setLabel('🏪 Quest Shop')
                .setStyle(ButtonStyle.Primary)
        );

    await interaction.reply({
        components: [questContainer, navigationRow, actionRow],
        flags: MessageFlags.IsComponentsV2,
        ephemeral: true
    });
}

async function showActiveQuests(questContainer, user) {
    const activeQuests = await getActiveQuests(user.user_id);

    if (activeQuests.length === 0) {
        questContainer.addTextDisplayComponents(
            textDisplay => textDisplay
                .setContent('📝 **No Active Quests**\n\nYou don\'t have any active quests. Browse available quests to start your adventure!')
                .setId('no_active_quests')
        );
        return;
    }

    for (const quest of activeQuests.slice(0, 5)) {
        const progressPercentage = Math.round((quest.progress / quest.target) * 100);
        const progressBar = createProgressBar(quest.progress, quest.target);

        questContainer.addSectionComponents(
            section => section
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent(`${quest.emoji} **${quest.name}**\n*${quest.difficulty} Difficulty*`)
                        .setId(`quest_${quest.id}_name`),
                    textDisplay => textDisplay
                        .setContent(`${quest.description}\n\n**Progress:** ${quest.progress}/${quest.target} (${progressPercentage}%)\n${progressBar}`)
                        .setId(`quest_${quest.id}_progress`),
                    textDisplay => textDisplay
                        .setContent(`**Reward:** ${quest.reward}\n**Time Left:** ${quest.timeLeft || 'No limit'}`)
                        .setId(`quest_${quest.id}_reward`)
                )
                .setButtonAccessory(
                    button => button
                        .setCustomId(`quest_details_${quest.id}`)
                        .setLabel('📖 Details')
                        .setStyle(ButtonStyle.Secondary)
                )
        );
    }

    if (activeQuests.length > 5) {
        questContainer.addTextDisplayComponents(
            textDisplay => textDisplay
                .setContent(`📋 **${activeQuests.length - 5} More Active Quests**\n\nUse quest navigation to view all your active quests.`)
                .setId('more_active_quests')
        );
    }
}

async function showDailyQuests(questContainer, user) {
    const dailyQuests = await getDailyQuests(user.user_id);

    questContainer.addSectionComponents(
        section => section
            .addTextDisplayComponents(
                textDisplay => textDisplay
                    .setContent('🎯 **Daily Challenges**\n\nFresh challenges that reset every day!')
                    .setId('daily_header'),
                textDisplay => textDisplay
                    .setContent(`**Reset Time:** <t:${getNextDailyReset()}:R>\n**Completion Bonus:** 2x XP + Bonus Coins`)
                    .setId('daily_info')
            )
            .setButtonAccessory(
                button => button
                    .setCustomId('daily_quest_calendar')
                    .setLabel('📅 Calendar')
                    .setStyle(ButtonStyle.Primary)
            )
    );

    for (const quest of dailyQuests) {
        const isCompleted = quest.status === 'completed';
        const progressPercentage = Math.round((quest.progress / quest.target) * 100);

        questContainer.addSectionComponents(
            section => section
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent(`${quest.emoji} **${quest.name}**\n*Daily Challenge*`)
                        .setId(`daily_${quest.id}_name`),
                    textDisplay => textDisplay
                        .setContent(`${quest.description}\n\n**Progress:** ${quest.progress}/${quest.target} (${progressPercentage}%)`)
                        .setId(`daily_${quest.id}_progress`)
                )
                .setButtonAccessory(
                    button => button
                        .setCustomId(`${isCompleted ? 'claim' : 'track'}_daily_${quest.id}`)
                        .setLabel(isCompleted ? '🎁 Claim' : '🎯 Track')
                        .setStyle(isCompleted ? ButtonStyle.Success : ButtonStyle.Primary)
                        .setDisabled(isCompleted && quest.claimed)
                )
        );
    }
}

async function showAvailableQuests(questContainer, user) {
    const availableQuests = await getAvailableQuests(user.user_id);

    questContainer.addSectionComponents(
        section => section
            .addTextDisplayComponents(
                textDisplay => textDisplay
                    .setContent('📚 **Available Quests**\n\nNew adventures await!')
                    .setId('available_header'),
                textDisplay => textDisplay
                    .setContent(`**Quest Slots:** ${await getActiveQuestCount(user.user_id)}/5\n**Recommended Level:** All levels welcome`)
                    .setId('available_info')
            )
    );

    // Group quests by category
    const questCategories = {
        beginner: [],
        hunting: [],
        collection: [],
        social: [],
        challenge: []
    };

    availableQuests.forEach(quest => {
        if (questCategories[quest.category]) {
            questCategories[quest.category].push(quest);
        }
    });

    for (const [category, quests] of Object.entries(questCategories)) {
        if (quests.length === 0) continue;

        const categoryName = getCategoryName(category);
        const categoryEmoji = getCategoryEmoji(category);

        questContainer.addSectionComponents(
            section => section
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent(`${categoryEmoji} **${categoryName} Quests**\n\nAvailable: ${quests.length}`)
                        .setId(`category_${category}_header`),
                    textDisplay => textDisplay
                        .setContent(quests.slice(0, 3).map(q => `• ${q.name} (${q.reward})`).join('\n'))
                        .setId(`category_${category}_list`)
                )
                .setButtonAccessory(
                    button => button
                        .setCustomId(`browse_${category}_quests`)
                        .setLabel('📋 Browse')
                        .setStyle(ButtonStyle.Secondary)
                )
        );
    }
}

async function showQuestDetails(interaction, user, questId) {
    const quest = await getQuestById(questId);
    
    if (!quest) {
        const errorContainer = new ContainerBuilder()
            .setAccentColor(config.colors.error)
            .addTextDisplayComponents(
                textDisplay => textDisplay
                    .setContent('❌ **Quest Not Found**\n\nThe specified quest doesn\'t exist or is no longer available.')
            );

        return interaction.reply({
            components: [errorContainer],
            flags: MessageFlags.IsComponentsV2,
            ephemeral: true
        });
    }

    const detailContainer = new ContainerBuilder()
        .setAccentColor(getQuestRarityColor(quest.difficulty));

    detailContainer.addSectionComponents(
        section => section
            .addTextDisplayComponents(
                textDisplay => textDisplay
                    .setContent(`${quest.emoji} **${quest.name}**\n*${quest.difficulty} Difficulty Quest*`)
                    .setId('quest_detail_header'),
                textDisplay => textDisplay
                    .setContent(`**Category:** ${getCategoryName(quest.category)}\n**Estimated Time:** ${quest.estimatedTime}\n**Prerequisites:** ${quest.prerequisites || 'None'}`)
                    .setId('quest_detail_meta'),
                textDisplay => textDisplay
                    .setContent(`**Description:**\n${quest.description}`)
                    .setId('quest_detail_description')
            )
            .setThumbnailAccessory(
                thumbnail => thumbnail
                    .setURL(quest.imageUrl || 'https://cdn.discordapp.com/attachments/placeholder/quest.png')
                    .setDescription(`${quest.name} quest`)
            )
    );

    // Quest objectives
    if (quest.objectives && quest.objectives.length > 0) {
        detailContainer.addSectionComponents(
            section => section
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('🎯 **Quest Objectives**')
                        .setId('objectives_header'),
                    textDisplay => textDisplay
                        .setContent(quest.objectives.map((obj, i) => `${i + 1}. ${obj}`).join('\n'))
                        .setId('objectives_list')
                )
        );
    }

    // Rewards breakdown
    detailContainer.addSectionComponents(
        section => section
            .addTextDisplayComponents(
                textDisplay => textDisplay
                    .setContent('🎁 **Quest Rewards**')
                    .setId('rewards_header'),
                textDisplay => textDisplay
                    .setContent(`**Primary:** ${quest.reward}\n**XP:** ${quest.xpReward || 100} points\n**Bonus:** ${quest.bonusReward || 'None'}`)
                    .setId('rewards_breakdown')
            )
            .setButtonAccessory(
                button => button
                    .setCustomId(`preview_rewards_${questId}`)
                    .setLabel('👁️ Preview')
                    .setStyle(ButtonStyle.Secondary)
            )
    );

    // Quest progress (if active)
    const userQuest = await getUserQuest(user.user_id, questId);
    if (userQuest) {
        const progressPercentage = Math.round((userQuest.progress / userQuest.target) * 100);
        const progressBar = createProgressBar(userQuest.progress, userQuest.target);

        detailContainer.addSectionComponents(
            section => section
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('📈 **Your Progress**')
                        .setId('progress_header'),
                    textDisplay => textDisplay
                        .setContent(`**Current:** ${userQuest.progress}/${userQuest.target} (${progressPercentage}%)\n${progressBar}\n**Started:** <t:${Math.floor(new Date(userQuest.created_at).getTime() / 1000)}:R>`)
                        .setId('progress_details')
                )
                .setButtonAccessory(
                    button => button
                        .setCustomId(`track_progress_${questId}`)
                        .setLabel('📊 Track')
                        .setStyle(ButtonStyle.Primary)
                )
        );
    }

    // Action buttons
    const actionRow = new ActionRowBuilder();
    
    if (userQuest) {
        if (userQuest.status === 'completed') {
            actionRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`claim_quest_${questId}`)
                    .setLabel('🎁 Claim Rewards')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(userQuest.claimed)
            );
        } else {
            actionRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`abandon_quest_${questId}`)
                    .setLabel('🗑️ Abandon Quest')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`quest_hint_${questId}`)
                    .setLabel('💡 Hint')
                    .setStyle(ButtonStyle.Secondary)
            );
        }
    } else {
        actionRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`accept_quest_${questId}`)
                .setLabel('✅ Accept Quest')
                .setStyle(ButtonStyle.Success)
                .setDisabled(await getActiveQuestCount(user.user_id) >= 5)
        );
    }

    actionRow.addComponents(
        new ButtonBuilder()
            .setCustomId('back_to_quests')
            .setLabel('⬅️ Back')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`share_quest_${questId}`)
            .setLabel('📤 Share')
            .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
        components: [detailContainer, actionRow],
        flags: MessageFlags.IsComponentsV2,
        ephemeral: true
    });
}

function createProgressBar(current, target) {
    const percentage = Math.min(100, Math.round((current / target) * 100));
    const filledBars = Math.round(percentage / 10);
    const emptyBars = 10 - filledBars;
    
    return '▓'.repeat(filledBars) + '░'.repeat(emptyBars) + ` ${percentage}%`;
}

function getQuestRarityColor(difficulty) {
    const colors = {
        easy: config.colors.success,
        medium: config.colors.primary,
        hard: config.colors.warning,
        expert: config.colors.rare,
        legendary: config.colors.legendary
    };
    return colors[difficulty] || config.colors.primary;
}

function getCategoryName(category) {
    const names = {
        beginner: 'Beginner',
        hunting: 'Hunting & Exploration',
        collection: 'Collection Building',
        social: 'Social & Community',
        challenge: 'Special Challenges'
    };
    return names[category] || category;
}

function getCategoryEmoji(category) {
    const emojis = {
        beginner: '🌱',
        hunting: '🎯',
        collection: '📚',
        social: '🤝',
        challenge: '⚡'
    };
    return emojis[category] || '📋';
}

function getNextDailyReset() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return Math.floor(tomorrow.getTime() / 1000);
}

// Mock data functions (would be replaced with actual database queries)
async function getActiveQuestCount(userId) {
    const userQuests = queries.quest.getUserQuests.all(userId);
    return userQuests.length;
}

async function getTodayCompletedCount(userId) {
    // Mock implementation
    return Math.floor(Math.random() * 3);
}

async function getQuestPoints(userId) {
    // Mock implementation
    return Math.floor(Math.random() * 1000) + 100;
}

async function getActiveQuests(userId) {
    // Mock active quests
    return [
        {
            id: 1,
            name: 'First Steps',
            emoji: '🥾',
            difficulty: 'Easy',
            description: 'Capture your first 5 birds to begin your journey',
            progress: 3,
            target: 5,
            reward: '100 coins + Basic Net',
            timeLeft: 'No limit'
        },
        {
            id: 2,
            name: 'Observer\'s Eye',
            emoji: '👁️',
            difficulty: 'Medium',
            description: 'Make 10 bird observations to deepen your knowledge',
            progress: 7,
            target: 10,
            reward: '250 coins + Observation Journal',
            timeLeft: '2 days'
        }
    ];
}

async function getDailyQuests(userId) {
    // Mock daily quests
    return [
        {
            id: 101,
            name: 'Daily Hunter',
            emoji: '🎯',
            description: 'Complete 3 successful hunts today',
            progress: 1,
            target: 3,
            status: 'active',
            claimed: false
        },
        {
            id: 102,
            name: 'Social Butterfly',
            emoji: '🦋',
            description: 'Trade with 2 different players',
            progress: 0,
            target: 2,
            status: 'active',
            claimed: false
        }
    ];
}

async function getAvailableQuests(userId) {
    // Mock available quests
    return [
        {
            id: 201,
            name: 'Rare Bird Collector',
            category: 'collection',
            reward: '500 coins',
            difficulty: 'Hard'
        },
        {
            id: 202,
            name: 'Community Helper',
            category: 'social',
            reward: '300 coins',
            difficulty: 'Medium'
        }
    ];
}

async function getQuestById(questId) {
    // Mock quest details
    const quests = {
        1: {
            id: 1,
            name: 'First Steps',
            emoji: '🥾',
            difficulty: 'easy',
            category: 'beginner',
            description: 'Every great bird watcher starts with their first capture. Learn the basics of ethical bird observation by capturing your first 5 birds.',
            estimatedTime: '30-60 minutes',
            prerequisites: 'None',
            objectives: [
                'Complete your first hunt using /hunt',
                'Successfully capture 5 different birds',
                'Use the /album command to view your collection',
                'Make your first observation using /observe'
            ],
            reward: '100 coins + Basic Net',
            xpReward: 150,
            bonusReward: 'Beginner\'s Badge',
            imageUrl: 'https://cdn.discordapp.com/attachments/placeholder/quest_first_steps.png'
        }
    };
    
    return quests[questId] || null;
}

async function getUserQuest(userId, questId) {
    // Mock user quest progress
    return {
        progress: 3,
        target: 5,
        status: 'active',
        created_at: new Date().toISOString(),
        claimed: false
    };
}

// Handle quest actions
module.exports.acceptQuest = async function(interaction, questId) {
    const userId = interaction.user.id;
    const quest = await getQuestById(questId);
    
    if (!quest) {
        return interaction.reply({
            content: '❌ Quest not found.',
            ephemeral: true
        });
    }

    // Add quest to user's active quests
    queries.quest.createQuest.run(userId, questId, quest.target || 1);

    const successContainer = new ContainerBuilder()
        .setAccentColor(config.colors.success)
        .addTextDisplayComponents(
            textDisplay => textDisplay
                .setContent(`✅ **Quest Accepted!**\n\n${quest.emoji} **${quest.name}** has been added to your active quests.\n\nGood luck on your adventure!`)
        );

    await interaction.update({
        components: [successContainer],
        flags: MessageFlags.IsComponentsV2
    });
};

module.exports.claimQuestReward = async function(interaction, questId) {
    const userId = interaction.user.id;
    const quest = await getQuestById(questId);
    
    if (!quest) {
        return interaction.reply({
            content: '❌ Quest not found.',
            ephemeral: true
        });
    }

    // Mark quest as completed and give rewards
    queries.quest.completeQuest.run(userId, questId);
    
    // Give coin reward (simplified)
    const user = utils.getOrCreateUser(userId);
    const coinReward = 100; // Extract from quest.reward
    queries.user.updateBalance.run(user.balance + coinReward, user.bank_balance, userId);

    const rewardContainer = new ContainerBuilder()
        .setAccentColor(config.colors.success)
        .addTextDisplayComponents(
            textDisplay => textDisplay
                .setContent(`🎁 **Quest Completed!**\n\n${quest.emoji} **${quest.name}**\n\n**Rewards Claimed:**\n• ${coinReward} coins\n• ${quest.xpReward || 100} XP\n• ${quest.bonusReward || 'None'}`)
        );

    await interaction.update({
        components: [rewardContainer],
        flags: MessageFlags.IsComponentsV2
    });
};
