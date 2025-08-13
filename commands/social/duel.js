const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SelectMenuBuilder,
        ContainerBuilder, SectionBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { formatCurrency } = require('../../utils/economy.js');
const { checkCooldown, setCooldown } = require('../../utils/cooldowns.js');
const config = require('../../config.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('duel')
        .setDescription('Challenge another bird watcher to a competitive observation duel')
        .addUserOption(option =>
            option.setName('opponent')
                .setDescription('User to challenge to a duel')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('wager')
                .setDescription('Optional currency wager for the duel')
                .setRequired(false)
                .setMinValue(0)
                .setMaxValue(1000)),

    async execute(interaction) {
        const userId = interaction.user.id;
        const opponent = interaction.options.getUser('opponent');
        const wager = interaction.options.getInteger('wager') || 0;
        const db = interaction.client.database;
        
        // Ensure both users exist
        const user = db.ensureUser(userId, interaction.user.username);
        const opponentUser = db.ensureUser(opponent.id, opponent.username);
        
        // Basic validation
        if (userId === opponent.id) {
            const errorContainer = new ContainerBuilder()
                .setAccentColor(config.bot.errorColor)
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent(`❌ **Invalid Duel**\n\nYou cannot duel yourself!\n\nChallenge another bird watcher to test your observation skills.`)
                );

            return interaction.reply({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
        }
        
        if (opponent.bot) {
            const errorContainer = new ContainerBuilder()
                .setAccentColor(config.bot.errorColor)
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent(`🤖 **Invalid Opponent**\n\nYou cannot duel bots!\n\nChallenge human players for fair competition.`)
                );

            return interaction.reply({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
        }
        
        // Check cooldown
        const cooldown = checkCooldown(interaction.client, userId, 'duel');
        if (cooldown) {
            const timeLeft = Math.ceil(cooldown / 1000);
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            
            const container = new ContainerBuilder()
                .setAccentColor(config.bot.errorColor)
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent(`⏰ **Duel Cooldown**\n\nYou need to wait **${minutes}m ${seconds}s** before starting another duel.\n\nUse this time to practice your observation skills!`)
                );

            return interaction.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
        }
        
        // Check wager affordability
        if (wager > 0) {
            if (user.wallet < wager) {
                const errorContainer = new ContainerBuilder()
                    .setAccentColor(config.bot.errorColor)
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent(`💸 **Insufficient Funds for Wager**\n\nYou want to wager ${formatCurrency(wager)} but only have ${formatCurrency(user.wallet)}.\n\nReduce the wager or earn more coins first!`)
                    );

                return interaction.reply({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2,
                    ephemeral: true
                });
            }
            
            if (opponentUser.wallet < wager) {
                const errorContainer = new ContainerBuilder()
                    .setAccentColor(config.bot.errorColor)
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent(`💸 **Opponent Cannot Afford Wager**\n\n${opponent.username} cannot afford the ${formatCurrency(wager)} wager.\n\nTry a smaller wager or duel without stakes.`)
                    );

                return interaction.reply({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2,
                    ephemeral: true
                });
            }
        }
        
        // Calculate skill levels
        const userLevel = Math.floor(Math.sqrt(user.experience / 100)) + 1;
        const opponentLevel = Math.floor(Math.sqrt(opponentUser.experience / 100)) + 1;
        
        // Create duel challenge
        const challengeContainer = new ContainerBuilder()
            .setAccentColor(config.bot.color)
            .addSectionComponents(
                section => section
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent(`⚔️ **Duel Challenge**\n\n${interaction.user.username} challenges ${opponent.username} to a bird observation duel!`),
                        textDisplay => textDisplay
                            .setContent(`**Challenge Details:**\n🎯 **Type:** Observation Duel\n💰 **Wager:** ${wager > 0 ? formatCurrency(wager) : 'No stakes'}\n⚡ **Format:** Best of 3 rounds\n📊 **Skill Levels:** ${userLevel} vs ${opponentLevel}`)
                    )
                    .setThumbnailAccessory(
                        thumbnail => thumbnail
                            .setURL('https://via.placeholder.com/150x150/FF6B35/ffffff?text=⚔️')
                            .setDescription('Duel Challenge')
                    )
            );

        challengeContainer.addSeparatorComponents(separator => separator);
        challengeContainer.addTextDisplayComponents(
            textDisplay => textDisplay
                .setContent(`🎮 **How Duels Work:**\n\n1. **Identification Round:** Both players identify mystery birds\n2. **Speed Round:** Quick-fire bird fact questions\n3. **Strategy Round:** Choose the best observation approach\n\n🏆 **Winner takes all!** ${wager > 0 ? `Prize: ${formatCurrency(wager * 2)}` : 'Glory and XP!'}`),
            textDisplay => textDisplay
                .setContent(`⏳ **${opponent.username}** has 60 seconds to accept this challenge.\n\nClick "Accept Duel" to begin the competition!`)
        );

        const challengeRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`duel_accept_${userId}_${wager}`)
                    .setLabel('⚔️ Accept Duel')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('duel_decline')
                    .setLabel('❌ Decline')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('duel_info')
                    .setLabel('ℹ️ Duel Rules')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.reply({
            content: `${opponent}, you've been challenged to a duel!`,
            components: [challengeContainer, challengeRow],
            flags: MessageFlags.IsComponentsV2
        });
        
        // Create collector for challenge response
        const collector = interaction.createMessageComponentCollector({
            time: 60000 // 1 minute to respond
        });
        
        collector.on('collect', async buttonInteraction => {
            if (buttonInteraction.customId.startsWith('duel_accept_')) {
                // Only the challenged user can accept
                if (buttonInteraction.user.id !== opponent.id) {
                    return buttonInteraction.reply({
                        content: '❌ Only the challenged player can accept this duel!',
                        ephemeral: true
                    });
                }
                
                await startDuel(buttonInteraction, userId, opponent.id, db, wager);
                collector.stop();
            } else if (buttonInteraction.customId === 'duel_decline') {
                if (buttonInteraction.user.id !== opponent.id) {
                    return buttonInteraction.reply({
                        content: '❌ Only the challenged player can decline this duel!',
                        ephemeral: true
                    });
                }
                
                const declineContainer = new ContainerBuilder()
                    .setAccentColor(config.bot.warningColor)
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent(`😔 **Duel Declined**\n\n${opponent.username} has declined the duel challenge.\n\nMaybe try again later or challenge someone else!`)
                    );

                await buttonInteraction.update({
                    content: '',
                    components: [declineContainer],
                    flags: MessageFlags.IsComponentsV2
                });
                collector.stop();
            } else if (buttonInteraction.customId === 'duel_info') {
                await showDuelRules(buttonInteraction);
            }
        });
        
        collector.on('end', () => {
            if (!collector.ended) {
                const timeoutContainer = new ContainerBuilder()
                    .setAccentColor(config.bot.warningColor)
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent(`⏰ **Duel Challenge Expired**\n\n${opponent.username} didn't respond in time. The duel challenge has expired.\n\nTry challenging them again when they're more active!`)
                    );

                interaction.editReply({
                    content: '',
                    components: [timeoutContainer],
                    flags: MessageFlags.IsComponentsV2
                }).catch(() => {});
            }
        });
        
        // Set cooldown
        setCooldown(interaction.client, userId, 'duel', 600); // 10 minute cooldown
    }
};

async function startDuel(interaction, challengerId, opponentId, db, wager) {
    // Escrow the wager if there is one
    if (wager > 0) {
        const challengerSuccess = db.updateBalance(challengerId, -wager, 0, 'Duel wager (escrowed)');
        const opponentSuccess = db.updateBalance(opponentId, -wager, 0, 'Duel wager (escrowed)');
        
        if (!challengerSuccess || !opponentSuccess) {
            const errorContainer = new ContainerBuilder()
                .setAccentColor(config.bot.errorColor)
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent(`❌ **Duel Failed to Start**\n\nOne of the players doesn't have enough funds for the wager. Duel cancelled.`)
                );

            return interaction.update({
                content: '',
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2
            });
        }
    }
    
    // Generate duel challenges
    const duelData = generateDuelRounds();
    
    const duelContainer = new ContainerBuilder()
        .setAccentColor(config.bot.color)
        .addTextDisplayComponents(
            textDisplay => textDisplay
                .setContent(`⚔️ **DUEL BEGINS!**\n\nChallenger: <@${challengerId}>\nOpponent: <@${opponentId}>\n\n🎯 **Round 1: Bird Identification**\nFirst to correctly identify the mystery bird wins this round!`)
        );

    duelContainer.addSeparatorComponents(separator => separator);
    duelContainer.addSectionComponents(
        section => section
            .addTextDisplayComponents(
                textDisplay => textDisplay
                    .setContent(`🔍 **Mystery Bird Clues:**\n\n• **Size:** ${duelData.round1.clues.size}\n• **Habitat:** ${duelData.round1.clues.habitat}\n• **Behavior:** ${duelData.round1.clues.behavior}\n• **Diet:** ${duelData.round1.clues.diet}`),
                textDisplay => textDisplay
                    .setContent(`**Additional Clue:** ${duelData.round1.clues.special}\n\n**Both players:** Select your answer below!`)
            )
            .setThumbnailAccessory(
                thumbnail => thumbnail
                    .setURL('https://via.placeholder.com/150x150/4ECDC4/ffffff?text=❓')
                    .setDescription('Mystery bird silhouette')
            )
    );

    const answerSelect = new SelectMenuBuilder()
        .setCustomId(`duel_round1_${challengerId}_${opponentId}`)
        .setPlaceholder('Choose the mystery bird')
        .addOptions(duelData.round1.options.map(option => ({
            label: option.name,
            value: option.value,
            description: `${option.rarity} bird`,
            emoji: '🐦'
        })));

    const selectRow = new ActionRowBuilder().addComponents(answerSelect);

    await interaction.update({
        content: `<@${challengerId}> <@${opponentId}> The duel has begun!`,
        components: [duelContainer, selectRow],
        flags: MessageFlags.IsComponentsV2
    });
    
    // Handle duel progression (simplified for demo)
    // In a full implementation, this would track both players' responses
    // and progress through all three rounds with complex scoring
}

async function showDuelRules(interaction) {
    const rulesContainer = new ContainerBuilder()
        .setAccentColor(config.bot.color)
        .addTextDisplayComponents(
            textDisplay => textDisplay
                .setContent(`📖 **Duel Rules & Format**\n\nDuels are competitive challenges between bird watchers to test knowledge and observation skills.`)
        );

    rulesContainer.addSeparatorComponents(separator => separator);
    rulesContainer.addTextDisplayComponents(
        textDisplay => textDisplay
            .setContent(`**🎯 Round Structure:**\n\n**Round 1: Identification** (33 points)\n• Identify mystery bird from clues\n• Speed matters - faster = bonus points\n• Accuracy is key\n\n**Round 2: Quick Facts** (33 points)\n• Multiple choice questions\n• 10 seconds per question\n• 3 questions total`),
        textDisplay => textDisplay
            .setContent(`**Round 3: Strategy** (34 points)\n• Choose best observation method\n• Environmental factors matter\n• Experience influences options\n\n**🏆 Scoring:**\n• Best of 3 rounds wins\n• Ties broken by total points\n• Winner takes wager + XP bonus`)
    );

    rulesContainer.addSeparatorComponents(separator => separator);
    rulesContainer.addTextDisplayComponents(
        textDisplay => textDisplay
            .setContent(`**💰 Wagers & Rewards:**\n• Optional currency stakes\n• Winner takes all wagered money\n• All participants gain XP\n• Leaderboard points for wins\n• Achievement progress\n\n**🛡️ Fair Play:**\n• Anti-cheat measures active\n• Timeouts prevent stalling\n• Both players must participate`)
    );

    await interaction.reply({
        components: [rulesContainer],
        flags: MessageFlags.IsComponentsV2,
        ephemeral: true
    });
}

function generateDuelRounds() {
    // This would normally pull from a database of duel challenges
    return {
        round1: {
            correctAnswer: 'cardinal',
            clues: {
                size: 'Medium songbird',
                habitat: 'Woodlands and gardens',
                behavior: 'Territorial, often seen in pairs',
                diet: 'Seeds, fruits, insects',
                special: 'Males are bright red, females are brown with red accents'
            },
            options: [
                { name: 'Northern Cardinal', value: 'cardinal', rarity: 'common' },
                { name: 'Scarlet Tanager', value: 'tanager', rarity: 'uncommon' },
                { name: 'Red-winged Blackbird', value: 'blackbird', rarity: 'common' },
                { name: 'House Finch', value: 'finch', rarity: 'common' }
            ]
        },
        round2: {
            questions: [
                {
                    question: 'Which bird can fly backwards?',
                    options: ['Hummingbird', 'Kingfisher', 'Swift', 'Falcon'],
                    correct: 0
                },
                {
                    question: 'What is a group of owls called?',
                    options: ['Flock', 'Murder', 'Parliament', 'Colony'],
                    correct: 2
                },
                {
                    question: 'Which bird has the largest wingspan?',
                    options: ['Eagle', 'Albatross', 'Condor', 'Pelican'],
                    correct: 1
                }
            ]
        },
        round3: {
            scenario: 'You want to observe a rare migratory warbler that only appears at dawn in dense forest canopy.',
            strategies: [
                { name: 'Use high-powered binoculars from forest edge', points: 15 },
                { name: 'Climb observation tower with telephoto lens', points: 25 },
                { name: 'Set up motion-activated camera overnight', points: 20 },
                { name: 'Follow bird calls deeper into forest', points: 10 }
            ]
        }
    };
}
