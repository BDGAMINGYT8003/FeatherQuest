const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ContainerBuilder, SectionBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { userOps, transactionOps } = require('../../database/database.js');
const { createUserIfNotExists } = require('../../utils/economy.js');
const config = require('../../config.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gift')
        .setDescription('Send coins to another user as a gift')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to send coins to')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Amount of coins to gift')
                .setMinValue(1)
                .setMaxValue(100000)
                .setRequired(true))
        .addStringOption(option =>
            option.setName('message')
                .setDescription('Optional message to include with the gift')
                .setMaxLength(200)
                .setRequired(false)),
    
    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('user');
            const amount = interaction.options.getInteger('amount');
            const message = interaction.options.getString('message') || '';
            
            // Validate target user
            if (targetUser.id === interaction.user.id) {
                const errorContainer = new ContainerBuilder()
                    .setAccentColor(config.colors.error)
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent('❌ **Invalid Gift**\n\nYou cannot gift coins to yourself!\n\nGifts are meant to be shared with others.')
                    );
                
                return await interaction.reply({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2,
                    ephemeral: true
                });
            }
            
            if (targetUser.bot) {
                const errorContainer = new ContainerBuilder()
                    .setAccentColor(config.colors.error)
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent('❌ **Invalid Gift**\n\nYou cannot gift coins to bots!\n\nBots don\'t need money - they\'re already rich in code!')
                    );
                
                return await interaction.reply({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2,
                    ephemeral: true
                });
            }
            
            // Create users if they don't exist
            await createUserIfNotExists(interaction.user.id, interaction.user.username);
            await createUserIfNotExists(targetUser.id, targetUser.username);
            
            const sender = userOps.get.get(interaction.user.id);
            const recipient = userOps.get.get(targetUser.id);
            
            // Check if sender has enough coins
            if (sender.balance < amount) {
                const shortfall = amount - sender.balance;
                
                const errorContainer = new ContainerBuilder()
                    .setAccentColor(config.colors.error)
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent(`💰 **Insufficient Funds**\n\nYou want to gift **${amount.toLocaleString()}** coins, but you only have **${sender.balance.toLocaleString()}** coins.\n\nYou need **${shortfall.toLocaleString()}** more coins to make this gift.\n\nTry using \`/work\` or \`/hunt\` to earn more!`)
                    );
                
                return await interaction.reply({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2,
                    ephemeral: true
                });
            }
            
            // Daily gift limit check (prevent abuse)
            const today = new Date().toDateString();
            const dailyGiftLimit = 10000; // 10k coins per day
            const userTransactions = transactionOps.getUserTransactions.all(interaction.user.id, 50);
            
            const todayGifts = userTransactions.filter(t => 
                new Date(t.created_at).toDateString() === today && 
                t.description.startsWith('Gift to')
            );
            
            const todayGiftTotal = todayGifts.reduce((sum, t) => sum + Math.abs(t.amount), 0);
            
            if (todayGiftTotal + amount > dailyGiftLimit) {
                const remaining = dailyGiftLimit - todayGiftTotal;
                
                const errorContainer = new ContainerBuilder()
                    .setAccentColor(config.colors.warning)
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent(`🎁 **Daily Gift Limit**\n\nYou've reached your daily gifting limit!\n\n**Today's Gifts:** ${todayGiftTotal.toLocaleString()}/10,000 coins\n**Remaining:** ${remaining.toLocaleString()} coins\n\nThis limit resets daily to prevent abuse.`)
                    );
                
                return await interaction.reply({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2,
                    ephemeral: true
                });
            }
            
            // Create gift confirmation
            const confirmContainer = new ContainerBuilder()
                .setAccentColor(config.colors.warning)
                .addSectionComponents(
                    section => section
                        .addTextDisplayComponents(
                            textDisplay => textDisplay
                                .setContent(`🎁 **Gift Confirmation**\n\nYou're about to send a gift to **${targetUser.username}**`),
                            textDisplay => textDisplay
                                .setContent(`**Gift Details:**\n💰 Amount: **${amount.toLocaleString()}** coins\n📝 Message: ${message ? `"${message}"` : '*No message*'}\n\n**Your Balance After Gift:**\n💰 Remaining: **${(sender.balance - amount).toLocaleString()}** coins`),
                            textDisplay => textDisplay
                                .setContent(`⚠️ **This action cannot be undone!**\n\nThe recipient will be notified of your generous gift.`)
                        )
                );
            
            // Create confirmation modal
            const modal = new ModalBuilder()
                .setCustomId(`confirm_gift_${targetUser.id}_${amount}`)
                .setTitle(`Gift ${amount} coins to ${targetUser.username}`);
            
            const confirmInput = new TextInputBuilder()
                .setCustomId('confirm_text')
                .setLabel('Type "CONFIRM" to send this gift')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('CONFIRM')
                .setRequired(true)
                .setMinLength(7)
                .setMaxLength(7);
            
            const messageInput = new TextInputBuilder()
                .setCustomId('gift_message')
                .setLabel('Gift message (optional)')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Include a personal message with your gift...')
                .setRequired(false)
                .setMaxLength(200)
                .setValue(message);
            
            const firstRow = new ActionRowBuilder().addComponents(confirmInput);
            const secondRow = new ActionRowBuilder().addComponents(messageInput);
            
            modal.addComponents(firstRow, secondRow);
            
            await interaction.showModal(modal);
            
        } catch (error) {
            console.error('Error in gift command:', error);
            
            const errorContainer = new ContainerBuilder()
                .setAccentColor(config.colors.error)
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('❌ **Error**\n\nSomething went wrong while preparing your gift. Please try again.')
                );
            
            await interaction.reply({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
        }
    },
    
    async handleGiftModal(interaction) {
        try {
            const [, , targetUserId, amount] = interaction.customId.split('_');
            const confirmText = interaction.fields.getTextInputValue('confirm_text');
            const giftMessage = interaction.fields.getTextInputValue('gift_message') || '';
            
            if (confirmText !== 'CONFIRM') {
                const errorContainer = new ContainerBuilder()
                    .setAccentColor(config.colors.error)
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent('❌ **Gift Cancelled**\n\nYou must type "CONFIRM" exactly to send the gift.')
                    );
                
                return await interaction.reply({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2,
                    ephemeral: true
                });
            }
            
            const targetUser = await interaction.client.users.fetch(targetUserId);
            const amountNum = parseInt(amount);
            
            // Get current user data
            const sender = userOps.get.get(interaction.user.id);
            const recipient = userOps.get.get(targetUserId);
            
            // Double-check balance
            if (sender.balance < amountNum) {
                const errorContainer = new ContainerBuilder()
                    .setAccentColor(config.colors.error)
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent('❌ **Gift Failed**\n\nInsufficient funds. Your balance may have changed since you started this gift.')
                    );
                
                return await interaction.reply({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2,
                    ephemeral: true
                });
            }
            
            // Process the gift
            const newSenderBalance = sender.balance - amountNum;
            const newRecipientBalance = recipient.balance + amountNum;
            
            // Update balances
            userOps.updateBalance.run(newSenderBalance, sender.bank_balance, sender.last_work, interaction.user.id);
            userOps.updateBalance.run(newRecipientBalance, recipient.bank_balance, recipient.last_work, targetUserId);
            
            // Record transactions
            transactionOps.create.run(
                interaction.user.id, 
                'spend', 
                -amountNum, 
                `Gift to ${targetUser.username}: ${giftMessage || 'No message'}`
            );
            
            transactionOps.create.run(
                targetUserId, 
                'earn', 
                amountNum, 
                `Gift from ${interaction.user.username}: ${giftMessage || 'No message'}`
            );
            
            // Success response
            const successContainer = new ContainerBuilder()
                .setAccentColor(config.colors.success)
                .addSectionComponents(
                    section => section
                        .addTextDisplayComponents(
                            textDisplay => textDisplay
                                .setContent(`🎁 **Gift Sent Successfully!**\n\nYou've sent **${amountNum.toLocaleString()}** coins to **${targetUser.username}**!`),
                            textDisplay => textDisplay
                                .setContent(`**Transaction Summary:**\n• Amount Gifted: ${amountNum.toLocaleString()} coins\n• Your New Balance: **${newSenderBalance.toLocaleString()}** coins\n• Message: ${giftMessage ? `"${giftMessage}"` : '*No message included*'}`),
                            textDisplay => textDisplay
                                .setContent(`✨ **Your kindness spreads joy!**\n\n${targetUser.username} has been notified of your generous gift and will surely appreciate your thoughtfulness.`)
                        )
                );
            
            await interaction.reply({
                components: [successContainer],
                flags: MessageFlags.IsComponentsV2
            });
            
            // Try to notify the recipient (if they're in a mutual server)
            try {
                const recipientNotification = new ContainerBuilder()
                    .setAccentColor(config.colors.success)
                    .addSectionComponents(
                        section => section
                            .addTextDisplayComponents(
                                textDisplay => textDisplay
                                    .setContent(`🎁 **You Received a Gift!**\n\n**${interaction.user.username}** has sent you **${amountNum.toLocaleString()}** coins!`),
                                textDisplay => textDisplay
                                    .setContent(`${giftMessage ? `**Message:** "${giftMessage}"\n\n` : ''}**Your New Balance:** ${newRecipientBalance.toLocaleString()} coins\n\nWhat a wonderful surprise! 🎉`)
                            )
                    );
                
                await targetUser.send({
                    components: [recipientNotification],
                    flags: MessageFlags.IsComponentsV2
                }).catch(() => {
                    // Silently fail if we can't DM the user
                });
            } catch (error) {
                // Ignore notification errors
            }
            
        } catch (error) {
            console.error('Error in gift modal handler:', error);
            
            const errorContainer = new ContainerBuilder()
                .setAccentColor(config.colors.error)
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('❌ **Error**\n\nSomething went wrong while processing your gift. Please contact support if you were charged.')
                );
            
            await interaction.reply({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
        }
    }
};
