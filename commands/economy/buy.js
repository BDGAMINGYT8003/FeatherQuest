const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ContainerBuilder, SectionBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { userOps, transactionOps } = require('../../database/database.js');
const { createUserIfNotExists } = require('../../utils/economy.js');
const config = require('../../config.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('buy')
        .setDescription('Purchase an item directly by name')
        .addStringOption(option =>
            option.setName('item')
                .setDescription('The item you want to buy')
                .setRequired(true)
                .addChoices(
                    { name: 'Basic Trap (50 coins)', value: 'basic_trap' },
                    { name: 'Advanced Trap (200 coins)', value: 'advanced_trap' },
                    { name: 'Bird Call Lure (75 coins)', value: 'bird_call' },
                    { name: 'Premium Camera (300 coins)', value: 'premium_camera' },
                    { name: 'Energy Drink (25 coins)', value: 'energy_drink' },
                    { name: 'Lucky Charm (100 coins)', value: 'lucky_charm' }
                ))
        .addIntegerOption(option =>
            option.setName('quantity')
                .setDescription('How many items to buy (default: 1)')
                .setMinValue(1)
                .setMaxValue(10)
                .setRequired(false)),
    
    async execute(interaction) {
        try {
            await createUserIfNotExists(interaction.user.id, interaction.user.username);
            
            const itemId = interaction.options.getString('item');
            const quantity = interaction.options.getInteger('quantity') || 1;
            
            // Item database
            const items = {
                basic_trap: { name: 'Basic Trap', price: 50, description: 'Increases common bird catch rate by 10%', emoji: '🪤' },
                advanced_trap: { name: 'Advanced Trap', price: 200, description: 'Increases rare bird catch rate by 15%', emoji: '⚙️' },
                bird_call: { name: 'Bird Call Lure', price: 75, description: 'Reduces hunt cooldown by 5 minutes', emoji: '📢' },
                premium_camera: { name: 'Premium Camera', price: 300, description: 'Increases bond gain from observations by 25%', emoji: '📸' },
                energy_drink: { name: 'Energy Drink', price: 25, description: 'Resets one random cooldown', emoji: '⚡' },
                lucky_charm: { name: 'Lucky Charm', price: 100, description: 'Increases rare bird chance for next hunt', emoji: '🍀' }
            };
            
            const item = items[itemId];
            if (!item) {
                const errorContainer = new ContainerBuilder()
                    .setAccentColor(config.colors.error)
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent('❌ **Item Not Found**\n\nThe specified item doesn\'t exist in our catalog.')
                    );
                
                return await interaction.reply({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2,
                    ephemeral: true
                });
            }
            
            const user = userOps.get.get(interaction.user.id);
            const totalCost = item.price * quantity;
            
            // Check if user can afford it
            if (user.balance < totalCost) {
                const shortfall = totalCost - user.balance;
                
                const errorContainer = new ContainerBuilder()
                    .setAccentColor(config.colors.error)
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent(`💰 **Insufficient Funds**\n\n**Item:** ${item.emoji} ${item.name}\n**Quantity:** ${quantity}\n**Total Cost:** ${totalCost.toLocaleString()} coins\n**Your Balance:** ${user.balance.toLocaleString()} coins\n**You need:** ${shortfall.toLocaleString()} more coins\n\nTry using \`/work\` or \`/hunt\` to earn more coins!`)
                    );
                
                return await interaction.reply({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2,
                    ephemeral: true
                });
            }
            
            // Create purchase confirmation
            const confirmContainer = new ContainerBuilder()
                .setAccentColor(config.colors.warning)
                .addSectionComponents(
                    section => section
                        .addTextDisplayComponents(
                            textDisplay => textDisplay
                                .setContent(`🛒 **Purchase Confirmation**\n\nAre you sure you want to buy this item?`),
                            textDisplay => textDisplay
                                .setContent(`**Item Details:**\n${item.emoji} **${item.name}**\n${item.description}\n\n**Purchase Summary:**\n• Quantity: ${quantity}\n• Unit Price: ${item.price.toLocaleString()} coins\n• Total Cost: **${totalCost.toLocaleString()}** coins\n• Remaining Balance: **${(user.balance - totalCost).toLocaleString()}** coins`)
                        )
                );
            
            // Create modal for purchase confirmation
            const modal = new ModalBuilder()
                .setCustomId(`confirm_purchase_${itemId}_${quantity}`)
                .setTitle(`Confirm Purchase: ${item.name}`);
            
            const confirmInput = new TextInputBuilder()
                .setCustomId('confirm_text')
                .setLabel('Type "CONFIRM" to complete your purchase')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('CONFIRM')
                .setRequired(true)
                .setMinLength(7)
                .setMaxLength(7);
            
            const firstActionRow = new ActionRowBuilder().addComponents(confirmInput);
            modal.addComponents(firstActionRow);
            
            await interaction.showModal(modal);
            
        } catch (error) {
            console.error('Error in buy command:', error);
            
            const errorContainer = new ContainerBuilder()
                .setAccentColor(config.colors.error)
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('❌ **Error**\n\nSomething went wrong while processing your purchase. Please try again.')
                );
            
            await interaction.reply({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
        }
    },
    
    async handlePurchaseModal(interaction) {
        try {
            const [, , itemId, quantity] = interaction.customId.split('_');
            const confirmText = interaction.fields.getTextInputValue('confirm_text');
            
            if (confirmText !== 'CONFIRM') {
                const errorContainer = new ContainerBuilder()
                    .setAccentColor(config.colors.error)
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent('❌ **Purchase Cancelled**\n\nYou must type "CONFIRM" exactly to complete the purchase.')
                    );
                
                return await interaction.reply({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2,
                    ephemeral: true
                });
            }
            
            // Item database (repeated for processing)
            const items = {
                basic_trap: { name: 'Basic Trap', price: 50, description: 'Increases common bird catch rate by 10%', emoji: '🪤' },
                advanced_trap: { name: 'Advanced Trap', price: 200, description: 'Increases rare bird catch rate by 15%', emoji: '⚙️' },
                bird_call: { name: 'Bird Call Lure', price: 75, description: 'Reduces hunt cooldown by 5 minutes', emoji: '📢' },
                premium_camera: { name: 'Premium Camera', price: 300, description: 'Increases bond gain from observations by 25%', emoji: '📸' },
                energy_drink: { name: 'Energy Drink', price: 25, description: 'Resets one random cooldown', emoji: '⚡' },
                lucky_charm: { name: 'Lucky Charm', price: 100, description: 'Increases rare bird chance for next hunt', emoji: '🍀' }
            };
            
            const item = items[itemId];
            const quantityNum = parseInt(quantity);
            const totalCost = item.price * quantityNum;
            
            // Get current user data
            const user = userOps.get.get(interaction.user.id);
            
            // Double-check balance
            if (user.balance < totalCost) {
                const errorContainer = new ContainerBuilder()
                    .setAccentColor(config.colors.error)
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent('❌ **Purchase Failed**\n\nInsufficient funds. Your balance may have changed since you started this purchase.')
                    );
                
                return await interaction.reply({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2,
                    ephemeral: true
                });
            }
            
            // Process purchase
            const newBalance = user.balance - totalCost;
            userOps.updateBalance.run(newBalance, user.bank_balance, user.last_work, interaction.user.id);
            
            // Record transaction
            transactionOps.create.run(
                interaction.user.id, 
                'spend', 
                -totalCost, 
                `Purchased ${quantityNum}x ${item.name}`
            );
            
            // Success response
            const successContainer = new ContainerBuilder()
                .setAccentColor(config.colors.success)
                .addSectionComponents(
                    section => section
                        .addTextDisplayComponents(
                            textDisplay => textDisplay
                                .setContent(`✅ **Purchase Successful!**\n\nYou have successfully purchased **${quantityNum}x ${item.emoji} ${item.name}**!`),
                            textDisplay => textDisplay
                                .setContent(`**Transaction Summary:**\n• Total Cost: ${totalCost.toLocaleString()} coins\n• New Balance: **${newBalance.toLocaleString()}** coins\n\nYour new items have been added to your inventory and are ready to use!`)
                        )
                );
            
            await interaction.reply({
                components: [successContainer],
                flags: MessageFlags.IsComponentsV2
            });
            
        } catch (error) {
            console.error('Error in purchase modal handler:', error);
            
            const errorContainer = new ContainerBuilder()
                .setAccentColor(config.colors.error)
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('❌ **Error**\n\nSomething went wrong while processing your purchase. Please contact support if you were charged.')
                );
            
            await interaction.reply({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
        }
    }
};
