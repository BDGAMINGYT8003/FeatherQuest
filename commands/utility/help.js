const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ContainerBuilder, SectionBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const config = require('../../config.js');

const helpCategories = {
    core: {
        name: 'Core Gameplay',
        emoji: '🦅',
        description: 'Essential bird hunting and collection commands',
        commands: [
            { name: '/hunt', description: 'Find and capture birds in the wild', usage: '/hunt [equipment]' },
            { name: '/album', description: 'View your bird collection', usage: '/album [@user]' },
            { name: '/observe', description: 'Study your birds to strengthen bonds', usage: '/observe <bird_id>' },
            { name: '/release', description: 'Release a bird back to the wild', usage: '/release <bird_id>' }
        ]
    },
    economy: {
        name: 'Economy & Trading',
        emoji: '💰',
        description: 'Money management and trading systems',
        commands: [
            { name: '/balance', description: 'Check your wallet and bank balance', usage: '/balance [@user]' },
            { name: '/work', description: 'Work bird-related jobs for income', usage: '/work' },
            { name: '/shop', description: 'Browse and buy items', usage: '/shop' },
            { name: '/buy', description: 'Purchase items directly', usage: '/buy <item> [quantity]' },
            { name: '/sell', description: 'Sell birds or items', usage: '/sell <type>' },
            { name: '/deposit', description: 'Put money in the bank for interest', usage: '/deposit [amount]' },
            { name: '/withdraw', description: 'Take money out of the bank', usage: '/withdraw [amount]' }
        ]
    },
    social: {
        name: 'Social Features',
        emoji: '🤝',
        description: 'Interact with other players',
        commands: [
            { name: '/trade', description: 'Trade birds or coins with others', usage: '/trade @user' },
            { name: '/gift', description: 'Send coins as gifts', usage: '/gift @user <amount> [message]' },
            { name: '/guild', description: 'Create or manage guilds', usage: '/guild <subcommand>' },
            { name: '/profile', description: 'View and edit profiles', usage: '/profile [@user]' }
        ]
    },
    games: {
        name: 'Minigames & Fun',
        emoji: '🎮',
        description: 'Interactive games and challenges',
        commands: [
            { name: '/minigame', description: 'Play skill-based bird games', usage: '/minigame [game]' }
        ]
    },
    utility: {
        name: 'Utility & Info',
        emoji: '🔧',
        description: 'Helpful tools and information',
        commands: [
            { name: '/help', description: 'Show this help message', usage: '/help [category]' },
            { name: '/stats', description: 'View detailed statistics', usage: '/stats [@user]' }
        ]
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Get help with bot commands and features')
        .addStringOption(option =>
            option.setName('category')
                .setDescription('Specific help category to view')
                .addChoices(
                    { name: 'Core Gameplay 🦅', value: 'core' },
                    { name: 'Economy & Trading 💰', value: 'economy' },
                    { name: 'Social Features 🤝', value: 'social' },
                    { name: 'Minigames & Fun 🎮', value: 'games' },
                    { name: 'Utility & Info 🔧', value: 'utility' }
                )
                .setRequired(false))
        .addStringOption(option =>
            option.setName('command')
                .setDescription('Get detailed help for a specific command')
                .setRequired(false)),
    
    async execute(interaction) {
        const category = interaction.options.getString('category');
        const command = interaction.options.getString('command');
        
        try {
            if (command) {
                await this.showCommandHelp(interaction, command);
            } else if (category) {
                await this.showCategoryHelp(interaction, category);
            } else {
                await this.showMainHelp(interaction);
            }
        } catch (error) {
            console.error('Error in help command:', error);
            
            const errorContainer = new ContainerBuilder()
                .setAccentColor(config.colors.error)
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('❌ **Error**\n\nCouldn\'t load help information. Please try again.')
                );
            
            await interaction.reply({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
        }
    },
    
    async showMainHelp(interaction) {
        const helpContainer = new ContainerBuilder()
            .setAccentColor(config.colors.primary)
            .addSectionComponents(
                section => section
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent('📚 **Bird Hunter Bot Help**\n\nWelcome to the comprehensive bird hunting experience! This bot offers ethical bird observation, collection, and a rich economy system.'),
                        textDisplay => textDisplay
                            .setContent('**Getting Started:**\n1️⃣ Use `/hunt` to find and capture your first bird\n2️⃣ Check `/balance` to see your starting coins\n3️⃣ Use `/work` to earn more money\n4️⃣ Grow your collection with `/album`\n5️⃣ Build bonds using `/observe`')
                    )
            );
        
        // Add category sections
        Object.entries(helpCategories).forEach(([key, cat]) => {
            helpContainer.addSectionComponents(
                section => section
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent(`${cat.emoji} **${cat.name}**\n${cat.description}\n\n**Commands:** ${cat.commands.length}`)
                    )
                    .setButtonAccessory(
                        button => button
                            .setCustomId(`help_category_${key}`)
                            .setLabel(`View ${cat.name}`)
                            .setStyle(ButtonStyle.Primary)
                    )
            );
        });
        
        // Quick access buttons
        const quickStartButton = new ButtonBuilder()
            .setCustomId('help_quick_start')
            .setLabel('🚀 Quick Start Guide')
            .setStyle(ButtonStyle.Success);
        
        const tipsButton = new ButtonBuilder()
            .setCustomId('help_tips')
            .setLabel('💡 Tips & Tricks')
            .setStyle(ButtonStyle.Secondary);
        
        const actionRow = new ActionRowBuilder().addComponents(quickStartButton, tipsButton);
        
        await interaction.reply({
            components: [helpContainer, actionRow],
            flags: MessageFlags.IsComponentsV2
        });
    },
    
    async showCategoryHelp(interaction, categoryKey) {
        const category = helpCategories[categoryKey];
        if (!category) {
            const errorContainer = new ContainerBuilder()
                .setAccentColor(config.colors.error)
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('❌ **Category Not Found**\n\nThe specified help category doesn\'t exist.')
                );
            
            return await interaction.reply({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
        }
        
        const categoryContainer = new ContainerBuilder()
            .setAccentColor(config.colors.primary)
            .addSectionComponents(
                section => section
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent(`${category.emoji} **${category.name}**\n\n${category.description}`)
                    )
            );
        
        // Add command details
        category.commands.forEach(cmd => {
            categoryContainer.addSectionComponents(
                section => section
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent(`**${cmd.name}**\n${cmd.description}\n\n**Usage:** \`${cmd.usage}\``)
                    )
                    .setButtonAccessory(
                        button => button
                            .setCustomId(`help_command_${cmd.name.replace('/', '')}`)
                            .setLabel('More Info')
                            .setStyle(ButtonStyle.Secondary)
                    )
            );
        });
        
        // Navigation buttons
        const backButton = new ButtonBuilder()
            .setCustomId('help_back_main')
            .setLabel('⬅️ Back to Main Help')
            .setStyle(ButtonStyle.Secondary);
        
        const actionRow = new ActionRowBuilder().addComponents(backButton);
        
        await interaction.reply({
            components: [categoryContainer, actionRow],
            flags: MessageFlags.IsComponentsV2
        });
    },
    
    async showCommandHelp(interaction, commandName) {
        // Detailed command help would be implemented here
        // For now, show a basic implementation
        
        const commandContainer = new ContainerBuilder()
            .setAccentColor(config.colors.info)
            .addSectionComponents(
                section => section
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent(`🔍 **Command Help: ${commandName}**\n\nDetailed command help is being implemented.\n\nFor now, please refer to the category help for basic usage information.`)
                    )
            );
        
        await interaction.reply({
            components: [commandContainer],
            flags: MessageFlags.IsComponentsV2,
            ephemeral: true
        });
    },
    
    async handleQuickStart(interaction) {
        const quickStartContainer = new ContainerBuilder()
            .setAccentColor(config.colors.success)
            .addSectionComponents(
                section => section
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent('🚀 **Quick Start Guide**\n\nNew to bird hunting? Follow these steps to get started!'),
                        textDisplay => textDisplay
                            .setContent('**Step 1: Your First Hunt**\nUse `/hunt` to find your first bird. You start with 100 coins, and hunting costs 10 coins but can reward much more!\n\n**Step 2: Build Your Collection**\nCheck `/album` to see your captured birds. Each bird has different rarity and value.\n\n**Step 3: Earn Money**\nUse `/work` daily to earn coins from bird-related jobs. Money helps you buy better equipment!'),
                        textDisplay => textDisplay
                            .setContent('**Step 4: Strengthen Bonds**\nUse `/observe <bird_id>` to study your birds. This increases their bond level and earns you coins!\n\n**Step 5: Banking**\nDeposit coins with `/deposit` to earn 2% daily interest. Your money grows while you\'re away!\n\n**Step 6: Have Fun!**\nTry minigames, trade with others, and join guilds for the full experience!')
                    )
            );
        
        await interaction.update({
            components: [quickStartContainer],
            flags: MessageFlags.IsComponentsV2
        });
    },
    
    async handleTips(interaction) {
        const tipsContainer = new ContainerBuilder()
            .setAccentColor(config.colors.info)
            .addSectionComponents(
                section => section
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent('💡 **Tips & Tricks**\n\nMaximize your bird hunting success with these pro tips!'),
                        textDisplay => textDisplay
                            .setContent('**Economy Tips:**\n• Keep money in the bank to earn daily interest\n• Work daily for steady income\n• Observe birds regularly for passive earnings\n• Don\'t sell rare birds - they appreciate in value!'),
                        textDisplay => textDisplay
                            .setContent('**Hunting Tips:**\n• Use equipment for better success rates\n• Hunt regularly but mind the cooldown\n• Patience often leads to rarer birds\n• Different times may yield different species'),
                        textDisplay => textDisplay
                            .setContent('**Social Tips:**\n• Join or create guilds for community benefits\n• Trade wisely - check bird values first\n• Gift coins to make friends\n• Help newcomers for good karma!')
                    )
            );
        
        await interaction.update({
            components: [tipsContainer],
            flags: MessageFlags.IsComponentsV2
        });
    }
};
