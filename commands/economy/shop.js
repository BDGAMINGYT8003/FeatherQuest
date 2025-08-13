const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ContainerBuilder, SectionBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { userOps } = require('../../database/database.js');
const { createUserIfNotExists } = require('../../utils/economy.js');
const config = require('../../config.js');

const shopItems = {
    traps: [
        { id: 'basic_trap', name: 'Basic Trap', price: 50, description: 'Increases common bird catch rate by 10%', emoji: '🪤' },
        { id: 'advanced_trap', name: 'Advanced Trap', price: 200, description: 'Increases rare bird catch rate by 15%', emoji: '⚙️' },
        { id: 'master_trap', name: 'Master Trap', price: 500, description: 'Increases all bird catch rates by 20%', emoji: '🔧' }
    ],
    lures: [
        { id: 'bird_call', name: 'Bird Call Lure', price: 75, description: 'Reduces hunt cooldown by 5 minutes', emoji: '📢' },
        { id: 'seed_mix', name: 'Premium Seed Mix', price: 100, description: 'Attracts rarer birds for 3 hunts', emoji: '🌾' },
        { id: 'artificial_nest', name: 'Artificial Nest', price: 150, description: 'Doubles bond gain for 24 hours', emoji: '🥚' }
    ],
    cameras: [
        { id: 'basic_camera', name: 'Basic Camera', price: 120, description: 'Allows bird photography (aesthetic)', emoji: '📷' },
        { id: 'premium_camera', name: 'Premium Camera', price: 300, description: 'Increases bond gain from observations by 25%', emoji: '📸' },
        { id: 'professional_camera', name: 'Professional Camera', price: 800, description: 'Unlocks rare photo variants and 50% bond bonus', emoji: '🎥' }
    ],
    consumables: [
        { id: 'energy_drink', name: 'Energy Drink', price: 25, description: 'Resets one random cooldown', emoji: '⚡' },
        { id: 'lucky_charm', name: 'Lucky Charm', price: 100, description: 'Increases rare bird chance for next hunt', emoji: '🍀' },
        { id: 'time_skip', name: 'Time Skip Token', price: 200, description: 'Skips all current cooldowns', emoji: '⏰' }
    ],
    cosmetics: [
        { id: 'golden_badge', name: 'Golden Observer Badge', price: 500, description: 'Shows prestige in your profile', emoji: '🏅' },
        { id: 'custom_title', name: 'Custom Title Permit', price: 1000, description: 'Allows setting a custom profile title', emoji: '👑' },
        { id: 'album_theme', name: 'Premium Album Theme', price: 750, description: 'Unlocks special album backgrounds', emoji: '🎨' }
    ]
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('Browse and purchase items to enhance your bird hunting experience'),
    
    async execute(interaction) {
        try {
            await createUserIfNotExists(interaction.user.id, interaction.user.username);
            
            const user = userOps.get.get(interaction.user.id);
            
            // Create shop interface
            const shopContainer = new ContainerBuilder()
                .setAccentColor(config.colors.primary)
                .addSectionComponents(
                    section => section
                        .addTextDisplayComponents(
                            textDisplay => textDisplay
                                .setContent(`🛒 **Bird Hunter's Shop**\n\nWelcome to the shop! Here you can purchase equipment, consumables, and cosmetic items to enhance your bird hunting experience.\n\n💰 **Your Balance:** ${user.balance.toLocaleString()} coins`),
                            textDisplay => textDisplay
                                .setContent(`**Shop Categories:**\n🪤 **Traps** - Improve your hunting success rates\n📢 **Lures** - Attract specific types of birds\n📷 **Cameras** - Document your discoveries\n⚡ **Consumables** - Temporary boosts and effects\n🎨 **Cosmetics** - Customize your profile and album`)
                        )
                );
            
            // Category selection menu
            const categorySelect = new StringSelectMenuBuilder()
                .setCustomId('shop_category')
                .setPlaceholder('Select a category to browse')
                .addOptions([
                    {
                        label: 'Traps',
                        description: 'Equipment to improve hunting success',
                        value: 'traps',
                        emoji: '🪤'
                    },
                    {
                        label: 'Lures',
                        description: 'Items to attract specific birds',
                        value: 'lures',
                        emoji: '📢'
                    },
                    {
                        label: 'Cameras',
                        description: 'Photography equipment',
                        value: 'cameras',
                        emoji: '📷'
                    },
                    {
                        label: 'Consumables',
                        description: 'Temporary boosts and effects',
                        value: 'consumables',
                        emoji: '⚡'
                    },
                    {
                        label: 'Cosmetics',
                        description: 'Profile and album customization',
                        value: 'cosmetics',
                        emoji: '🎨'
                    }
                ]);
            
            const selectRow = new ActionRowBuilder().addComponents(categorySelect);
            
            // Quick access buttons
            const dailyDealsButton = new ButtonBuilder()
                .setCustomId('shop_daily_deals')
                .setLabel('⭐ Daily Deals')
                .setStyle(ButtonStyle.Success);
            
            const inventoryButton = new ButtonBuilder()
                .setCustomId('view_inventory')
                .setLabel('📦 My Inventory')
                .setStyle(ButtonStyle.Secondary);
            
            const buttonRow = new ActionRowBuilder().addComponents(dailyDealsButton, inventoryButton);
            
            await interaction.reply({
                components: [shopContainer, selectRow, buttonRow],
                flags: MessageFlags.IsComponentsV2
            });
            
        } catch (error) {
            console.error('Error in shop command:', error);
            
            const errorContainer = new ContainerBuilder()
                .setAccentColor(config.colors.error)
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('❌ **Error**\n\nCouldn\'t load the shop. Please try again later.')
                );
            
            await interaction.reply({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
        }
    },
    
    async handleCategorySelect(interaction, category) {
        try {
            const user = userOps.get.get(interaction.user.id);
            const items = shopItems[category] || [];
            
            if (items.length === 0) {
                const errorContainer = new ContainerBuilder()
                    .setAccentColor(config.colors.warning)
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent('📦 **Category Empty**\n\nThis category doesn\'t have any items available right now. Check back later!')
                    );
                
                return await interaction.update({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2
                });
            }
            
            // Create category display
            const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
            const categoryContainer = new ContainerBuilder()
                .setAccentColor(config.colors.primary)
                .addSectionComponents(
                    section => section
                        .addTextDisplayComponents(
                            textDisplay => textDisplay
                                .setContent(`🛒 **${categoryName} Shop**\n\n💰 **Your Balance:** ${user.balance.toLocaleString()} coins\n\nSelect an item below to view details and purchase options.`)
                        )
                );
            
            // Add items to display
            items.forEach((item, index) => {
                const canAfford = user.balance >= item.price;
                const affordText = canAfford ? '✅ Affordable' : '❌ Too Expensive';
                
                categoryContainer.addSectionComponents(
                    section => section
                        .addTextDisplayComponents(
                            textDisplay => textDisplay
                                .setContent(`${item.emoji} **${item.name}**\n💰 Price: **${item.price.toLocaleString()}** coins ${affordText}\n\n${item.description}`)
                        )
                        .setButtonAccessory(
                            button => button
                                .setCustomId(`buy_item_${item.id}`)
                                .setLabel(`Buy ${item.name}`)
                                .setStyle(canAfford ? ButtonStyle.Success : ButtonStyle.Secondary)
                                .setDisabled(!canAfford)
                        )
                );
            });
            
            // Navigation buttons
            const backButton = new ButtonBuilder()
                .setCustomId('shop_back')
                .setLabel('⬅️ Back to Shop')
                .setStyle(ButtonStyle.Secondary);
            
            const refreshButton = new ButtonBuilder()
                .setCustomId('shop_refresh')
                .setLabel('🔄 Refresh')
                .setStyle(ButtonStyle.Primary);
            
            const navRow = new ActionRowBuilder().addComponents(backButton, refreshButton);
            
            await interaction.update({
                components: [categoryContainer, navRow],
                flags: MessageFlags.IsComponentsV2
            });
            
        } catch (error) {
            console.error('Error in shop category handler:', error);
            
            const errorContainer = new ContainerBuilder()
                .setAccentColor(config.colors.error)
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('❌ **Error**\n\nCouldn\'t load the category. Please try again.')
                );
            
            await interaction.update({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2
            });
        }
    }
};
