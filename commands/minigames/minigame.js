const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ContainerBuilder, SectionBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { userOps, transactionOps } = require('../../database/database.js');
const { createUserIfNotExists } = require('../../utils/economy.js');
const { setCooldown, getCooldown } = require('../../utils/cooldowns.js');
const config = require('../../config.js');

const minigames = {
    stealth_capture: {
        name: 'Stealth Capture',
        description: 'Sneak up on a bird without scaring it away',
        emoji: '🤫',
        difficulty: 'Medium',
        reward: { min: 50, max: 150 },
        duration: 15000 // 15 seconds
    },
    rhythm_call: {
        name: 'Rhythm Call',
        description: 'Match the bird\'s call pattern perfectly',
        emoji: '🎵',
        difficulty: 'Hard',
        reward: { min: 80, max: 200 },
        duration: 20000 // 20 seconds
    },
    quick_identify: {
        name: 'Quick Identify',
        description: 'Identify bird species from silhouettes',
        emoji: '🔍',
        difficulty: 'Easy',
        reward: { min: 30, max: 100 },
        duration: 10000 // 10 seconds
    },
    patience_test: {
        name: 'Patience Test',
        description: 'Wait for the perfect moment to observe',
        emoji: '⏳',
        difficulty: 'Medium',
        reward: { min: 60, max: 180 },
        duration: 25000 // 25 seconds
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('minigame')
        .setDescription('Play bird hunting minigames to earn rewards')
        .addStringOption(option =>
            option.setName('game')
                .setDescription('Choose a specific minigame to play')
                .addChoices(
                    { name: 'Stealth Capture 🤫', value: 'stealth_capture' },
                    { name: 'Rhythm Call 🎵', value: 'rhythm_call' },
                    { name: 'Quick Identify 🔍', value: 'quick_identify' },
                    { name: 'Patience Test ⏳', value: 'patience_test' }
                )
                .setRequired(false)),
    
    async execute(interaction) {
        await interaction.deferReply();
        
        try {
            await createUserIfNotExists(interaction.user.id, interaction.user.username);
            
            // Check cooldown
            const cooldownTime = getCooldown(interaction.user.id, 'minigame');
            if (cooldownTime > 0) {
                const minutes = Math.ceil(cooldownTime / (1000 * 60));
                
                const errorContainer = new ContainerBuilder()
                    .setAccentColor(config.colors.warning)
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent(`⏰ **Minigame Cooldown**\n\nYou need to wait **${minutes} minutes** before playing another minigame.\n\nUse this time to hunt birds or work for coins!`)
                    );
                
                return await interaction.editReply({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2
                });
            }
            
            const selectedGame = interaction.options.getString('game');
            
            if (selectedGame) {
                await this.startMinigame(interaction, selectedGame);
            } else {
                await this.showMinigameMenu(interaction);
            }
            
        } catch (error) {
            console.error('Error in minigame command:', error);
            
            const errorContainer = new ContainerBuilder()
                .setAccentColor(config.colors.error)
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('❌ **Error**\n\nSomething went wrong while loading minigames. Please try again.')
                );
            
            await interaction.editReply({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2
            });
        }
    },
    
    async showMinigameMenu(interaction) {
        const menuContainer = new ContainerBuilder()
            .setAccentColor(config.colors.primary)
            .addSectionComponents(
                section => section
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent('🎮 **Bird Hunter Minigames**\n\nTest your skills with these interactive challenges! Each minigame offers different rewards based on your performance.\n\n⏰ **Cooldown:** 10 minutes between games\n🏆 **Rewards:** Coins and experience')
                    )
            );
        
        // Add minigame options
        Object.entries(minigames).forEach(([key, game]) => {
            menuContainer.addSectionComponents(
                section => section
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent(`${game.emoji} **${game.name}**\n${game.description}\n\n**Difficulty:** ${game.difficulty}\n**Rewards:** ${game.reward.min}-${game.reward.max} coins\n**Duration:** ${game.duration / 1000} seconds`)
                    )
                    .setButtonAccessory(
                        button => button
                            .setCustomId(`play_minigame_${key}`)
                            .setLabel(`Play ${game.name}`)
                            .setStyle(ButtonStyle.Success)
                    )
            );
        });
        
        const randomGameButton = new ButtonBuilder()
            .setCustomId('play_random_minigame')
            .setLabel('🎲 Random Game')
            .setStyle(ButtonStyle.Primary);
        
        const leaderboardButton = new ButtonBuilder()
            .setCustomId('minigame_leaderboard')
            .setLabel('🏆 Leaderboard')
            .setStyle(ButtonStyle.Secondary);
        
        const actionRow = new ActionRowBuilder().addComponents(randomGameButton, leaderboardButton);
        
        await interaction.editReply({
            components: [menuContainer, actionRow],
            flags: MessageFlags.IsComponentsV2
        });
    },
    
    async startMinigame(interaction, gameKey) {
        const game = minigames[gameKey];
        if (!game) {
            const errorContainer = new ContainerBuilder()
                .setAccentColor(config.colors.error)
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('❌ **Invalid Game**\n\nThe selected minigame doesn\'t exist.')
                );
            
            return await interaction.editReply({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2
            });
        }
        
        // Set cooldown
        setCooldown(interaction.user.id, 'minigame', config.cooldowns.minigame);
        
        switch (gameKey) {
            case 'stealth_capture':
                await this.playStealthCapture(interaction, game);
                break;
            case 'rhythm_call':
                await this.playRhythmCall(interaction, game);
                break;
            case 'quick_identify':
                await this.playQuickIdentify(interaction, game);
                break;
            case 'patience_test':
                await this.playPatienceTest(interaction, game);
                break;
        }
    },
    
    async playStealthCapture(interaction, game) {
        const gameContainer = new ContainerBuilder()
            .setAccentColor(config.colors.primary)
            .addSectionComponents(
                section => section
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent(`${game.emoji} **${game.name}**\n\nA rare bird has landed nearby! You need to approach it carefully without making any sudden movements.`),
                        textDisplay => textDisplay
                            .setContent(`**Instructions:**\n• Choose your approach carefully\n• Each choice affects your stealth level\n• Make too much noise and the bird flies away!\n• Perfect stealth = maximum reward\n\n**Time Limit:** ${game.duration / 1000} seconds`)
                    )
            );
        
        const approaches = [
            { label: 'Crouch and Move Slowly', value: 'slow', risk: 'low' },
            { label: 'Use Natural Cover', value: 'cover', risk: 'medium' },
            { label: 'Freeze and Wait', value: 'wait', risk: 'very_low' },
            { label: 'Quick Dash', value: 'dash', risk: 'high' }
        ];
        
        const approachSelect = new StringSelectMenuBuilder()
            .setCustomId(`stealth_approach_${Date.now()}`)
            .setPlaceholder('Choose your approach...')
            .addOptions(approaches.map(approach => ({
                label: approach.label,
                description: `Risk: ${approach.risk}`,
                value: approach.value,
                emoji: approach.value === 'slow' ? '🐌' : 
                      approach.value === 'cover' ? '🌿' : 
                      approach.value === 'wait' ? '⏸️' : '⚡'
            })));
        
        const selectRow = new ActionRowBuilder().addComponents(approachSelect);
        
        await interaction.editReply({
            components: [gameContainer, selectRow],
            flags: MessageFlags.IsComponentsV2
        });
        
        // Store game data for later processing
        interaction.minigameData = { game, startTime: Date.now(), gameType: 'stealth_capture' };
    },
    
    async playRhythmCall(interaction, game) {
        const gameContainer = new ContainerBuilder()
            .setAccentColor(config.colors.rare)
            .addSectionComponents(
                section => section
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent(`${game.emoji} **${game.name}**\n\nA songbird is calling in the distance. Listen carefully and repeat its pattern to earn its trust!`),
                        textDisplay => textDisplay
                            .setContent(`**Pattern:** 🎵-🎶-🎵-🎶-🎵\n\n**Instructions:**\n• Click the buttons in the correct sequence\n• Match the rhythm as closely as possible\n• Perfect timing = bonus rewards!\n\n**Time Limit:** ${game.duration / 1000} seconds`)
                    )
            );
        
        const note1Button = new ButtonBuilder()
            .setCustomId('rhythm_note_1')
            .setLabel('🎵')
            .setStyle(ButtonStyle.Primary);
        
        const note2Button = new ButtonBuilder()
            .setCustomId('rhythm_note_2')
            .setLabel('🎶')
            .setStyle(ButtonStyle.Secondary);
        
        const submitButton = new ButtonBuilder()
            .setCustomId('rhythm_submit')
            .setLabel('✅ Submit Pattern')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true);
        
        const actionRow = new ActionRowBuilder().addComponents(note1Button, note2Button, submitButton);
        
        await interaction.editReply({
            components: [gameContainer, actionRow],
            flags: MessageFlags.IsComponentsV2
        });
        
        interaction.minigameData = { 
            game, 
            startTime: Date.now(), 
            gameType: 'rhythm_call',
            targetPattern: ['1', '2', '1', '2', '1'],
            playerPattern: []
        };
    },
    
    async playQuickIdentify(interaction, game) {
        const birds = ['robin', 'sparrow', 'cardinal', 'bluejay', 'owl'];
        const correctBird = birds[Math.floor(Math.random() * birds.length)];
        
        const gameContainer = new ContainerBuilder()
            .setAccentColor(config.colors.success)
            .addSectionComponents(
                section => section
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent(`${game.emoji} **${game.name}**\n\nQuick! Identify this bird from its silhouette!`),
                        textDisplay => textDisplay
                            .setContent(`**Bird Silhouette:** 🐦‍⬛\n\n**Hint:** This bird is known for its ${this.getBirdHint(correctBird)}\n\n**Time Limit:** ${game.duration / 1000} seconds\n\nChoose quickly for bonus points!`)
                    )
            );
        
        const birdSelect = new StringSelectMenuBuilder()
            .setCustomId(`identify_bird_${correctBird}_${Date.now()}`)
            .setPlaceholder('Select the bird species...')
            .addOptions(birds.map(bird => ({
                label: bird.charAt(0).toUpperCase() + bird.slice(1),
                description: `Is it a ${bird}?`,
                value: bird,
                emoji: '🦅'
            })));
        
        const selectRow = new ActionRowBuilder().addComponents(birdSelect);
        
        await interaction.editReply({
            components: [gameContainer, selectRow],
            flags: MessageFlags.IsComponentsV2
        });
        
        interaction.minigameData = { 
            game, 
            startTime: Date.now(), 
            gameType: 'quick_identify',
            correctAnswer: correctBird
        };
    },
    
    async playPatienceTest(interaction, game) {
        const waitTime = Math.random() * 15000 + 5000; // 5-20 seconds
        
        const gameContainer = new ContainerBuilder()
            .setAccentColor(config.colors.warning)
            .addSectionComponents(
                section => section
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent(`${game.emoji} **${game.name}**\n\nA skittish bird is nearby, but it's not ready to be observed yet. Wait for the perfect moment when it's relaxed...`),
                        textDisplay => textDisplay
                            .setContent(`**Instructions:**\n• Wait patiently for the bird to settle\n• Watch for the "Observe Now!" button\n• Click too early and you'll scare it away\n• Perfect timing = maximum reward\n\n**Maximum Wait:** ${game.duration / 1000} seconds`)
                    )
            );
        
        const waitButton = new ButtonBuilder()
            .setCustomId('patience_wait')
            .setLabel('⏳ Waiting...')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true);
        
        const actionRow = new ActionRowBuilder().addComponents(waitButton);
        
        await interaction.editReply({
            components: [gameContainer, actionRow],
            flags: MessageFlags.IsComponentsV2
        });
        
        // Set up the observe button to appear after wait time
        setTimeout(async () => {
            try {
                const observeButton = new ButtonBuilder()
                    .setCustomId(`patience_observe_${Date.now()}`)
                    .setLabel('👁️ Observe Now!')
                    .setStyle(ButtonStyle.Success);
                
                const newActionRow = new ActionRowBuilder().addComponents(observeButton);
                
                const updatedContainer = new ContainerBuilder()
                    .setAccentColor(config.colors.success)
                    .addSectionComponents(
                        section => section
                            .addTextDisplayComponents(
                                textDisplay => textDisplay
                                    .setContent(`${game.emoji} **Perfect Moment!**\n\nThe bird has settled and is calmly preening its feathers. This is your chance!`),
                                textDisplay => textDisplay
                                    .setContent(`**Quick!** Click "Observe Now!" to make your observation while the bird is relaxed.\n\n⚠️ You have 5 seconds before the bird becomes alert again!`)
                            )
                    );
                
                await interaction.editReply({
                    components: [updatedContainer, newActionRow],
                    flags: MessageFlags.IsComponentsV2
                });
                
                interaction.minigameData = { 
                    game, 
                    startTime: Date.now(), 
                    gameType: 'patience_test',
                    perfectTime: Date.now()
                };
                
            } catch (error) {
                console.error('Error updating patience test:', error);
            }
        }, waitTime);
        
        interaction.minigameData = { 
            game, 
            startTime: Date.now(), 
            gameType: 'patience_test',
            waitTime: waitTime
        };
    },
    
    getBirdHint(bird) {
        const hints = {
            robin: 'distinctive red breast and cheerful song',
            sparrow: 'small size and social flocking behavior',
            cardinal: 'brilliant red plumage and distinctive crest',
            bluejay: 'bright blue coloring and loud calls',
            owl: 'nocturnal habits and silent flight'
        };
        return hints[bird] || 'unique characteristics';
    },
    
    async handleMinigameResult(interaction, result) {
        try {
            const gameData = interaction.minigameData || {};
            const game = gameData.game || minigames.stealth_capture;
            
            let success = false;
            let rewardMultiplier = 0;
            let resultMessage = '';
            
            // Calculate success based on game type
            switch (gameData.gameType) {
                case 'stealth_capture':
                    success = Math.random() < 0.7; // 70% base success rate
                    rewardMultiplier = success ? (Math.random() * 0.5 + 0.5) : 0; // 50-100% of reward
                    resultMessage = success ? 
                        'You successfully approached the bird without disturbing it! 🎉' : 
                        'The bird spotted you and flew away. Better luck next time! 🐦';
                    break;
                    
                case 'quick_identify':
                    success = result === gameData.correctAnswer;
                    const responseTime = Date.now() - gameData.startTime;
                    const timeBonus = Math.max(0, (game.duration - responseTime) / game.duration);
                    rewardMultiplier = success ? (0.7 + timeBonus * 0.3) : 0.1; // Base 70% + time bonus, or 10% consolation
                    resultMessage = success ? 
                        `Correct! You identified the ${result} perfectly! 🎯` : 
                        `Incorrect. It was a ${gameData.correctAnswer}, not a ${result}. 📚`;
                    break;
                    
                default:
                    success = Math.random() < 0.6;
                    rewardMultiplier = success ? 0.8 : 0.2;
                    resultMessage = success ? 'Great job! 🎉' : 'Nice try! 👍';
            }
            
            // Calculate reward
            const baseReward = Math.floor(Math.random() * (game.reward.max - game.reward.min + 1)) + game.reward.min;
            const finalReward = Math.floor(baseReward * rewardMultiplier);
            
            // Update user balance
            const user = userOps.get.get(interaction.user.id);
            const newBalance = user.balance + finalReward;
            userOps.updateBalance.run(newBalance, user.bank_balance, user.last_work, interaction.user.id);
            
            // Record transaction
            transactionOps.create.run(interaction.user.id, 'earn', finalReward, `Minigame: ${game.name}`);
            
            // Create result display
            const resultColor = success ? config.colors.success : config.colors.warning;
            const resultContainer = new ContainerBuilder()
                .setAccentColor(resultColor)
                .addSectionComponents(
                    section => section
                        .addTextDisplayComponents(
                            textDisplay => textDisplay
                                .setContent(`🎮 **Minigame Complete!**\n\n${resultMessage}`),
                            textDisplay => textDisplay
                                .setContent(`**Results:**\n🎯 Performance: ${success ? 'Success!' : 'Good effort!'}\n💰 Coins Earned: **${finalReward}**\n📊 Reward Rate: ${Math.floor(rewardMultiplier * 100)}%\n\n**New Balance:** ${newBalance.toLocaleString()} coins`),
                            textDisplay => textDisplay
                                .setContent(`⏰ **Cooldown:** You can play another minigame in 10 minutes.\n\nTry different games to improve your skills and earn more rewards!`)
                        )
                );
            
            const playAgainButton = new ButtonBuilder()
                .setCustomId('minigame_menu')
                .setLabel('🎮 Play Again Later')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true);
            
            const huntButton = new ButtonBuilder()
                .setCustomId('minigame_go_hunt')
                .setLabel('🦅 Go Hunting')
                .setStyle(ButtonStyle.Success);
            
            const actionRow = new ActionRowBuilder().addComponents(playAgainButton, huntButton);
            
            await interaction.update({
                components: [resultContainer, actionRow],
                flags: MessageFlags.IsComponentsV2
            });
            
        } catch (error) {
            console.error('Error handling minigame result:', error);
            
            const errorContainer = new ContainerBuilder()
                .setAccentColor(config.colors.error)
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('❌ **Error**\n\nSomething went wrong while processing your minigame results.')
                );
            
            await interaction.update({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2
            });
        }
    }
};
