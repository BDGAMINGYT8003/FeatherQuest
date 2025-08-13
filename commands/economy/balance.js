const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, SectionBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { userOps, transactionOps } = require('../../database/database.js');
const { createUserIfNotExists } = require('../../utils/economy.js');
const config = require('../../config.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Check your current balance and banking information')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Check another user\'s balance')
                .setRequired(false)),
    
    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('user') || interaction.user;
            await createUserIfNotExists(targetUser.id, targetUser.username);
            
            const user = userOps.get.get(targetUser.id);
            
            if (!user) {
                const errorContainer = new ContainerBuilder()
                    .setAccentColor(config.colors.error)
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent('❌ **User Not Found**\n\nCouldn\'t find user data. Please try again.')
                    );
                
                return await interaction.reply({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2,
                    ephemeral: true
                });
            }
            
            const totalWealth = user.balance + user.bank_balance;
            const isOwnBalance = targetUser.id === interaction.user.id;
            
            // Calculate daily bank interest (if applicable)
            const dailyInterest = Math.floor(user.bank_balance * config.economy.bankInterestRate);
            const maxBankCapacity = config.economy.maxBankBalance;
            const bankUtilization = Math.floor((user.bank_balance / maxBankCapacity) * 100);
            
            // Create balance display
            const balanceContainer = new ContainerBuilder()
                .setAccentColor(config.colors.primary)
                .addSectionComponents(
                    section => section
                        .addTextDisplayComponents(
                            textDisplay => textDisplay
                                .setContent(`💰 **${targetUser.username}'s Finances**\n\n**Current Balance**\n🪙 Wallet: **${user.balance.toLocaleString()}** coins\n🏦 Bank: **${user.bank_balance.toLocaleString()}** coins\n💎 Total Wealth: **${totalWealth.toLocaleString()}** coins`),
                            textDisplay => textDisplay
                                .setContent(`**Banking Information**\n📈 Daily Interest: **${dailyInterest.toLocaleString()}** coins (${(config.economy.bankInterestRate * 100).toFixed(1)}%)\n📊 Bank Utilization: **${bankUtilization}%** (${user.bank_balance.toLocaleString()}/${maxBankCapacity.toLocaleString()})\n\n💡 *Keep money in the bank to earn daily interest!*`)
                        )
                );
            
            // Add statistics if viewing own balance
            if (isOwnBalance) {
                balanceContainer.addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent(`**Career Statistics**\n🦅 Birds Caught: **${user.total_birds_caught}**\n💸 Total Earned: **${user.total_money_earned.toLocaleString()}** coins\n📅 Member Since: ${new Date(user.created_at).toLocaleDateString()}`)
                );
            }
            
            // Action buttons (only for own balance)
            const actionRows = [];
            if (isOwnBalance) {
                const depositButton = new ButtonBuilder()
                    .setCustomId('deposit_money')
                    .setLabel('💳 Deposit')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(user.balance === 0);
                
                const withdrawButton = new ButtonBuilder()
                    .setCustomId('withdraw_money')
                    .setLabel('💸 Withdraw')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(user.bank_balance === 0);
                
                const historyButton = new ButtonBuilder()
                    .setCustomId('transaction_history')
                    .setLabel('📊 Transaction History')
                    .setStyle(ButtonStyle.Secondary);
                
                actionRows.push(new ActionRowBuilder().addComponents(depositButton, withdrawButton, historyButton));
            }
            
            await interaction.reply({
                components: [balanceContainer, ...actionRows],
                flags: MessageFlags.IsComponentsV2
            });
            
        } catch (error) {
            console.error('Error in balance command:', error);
            
            const errorContainer = new ContainerBuilder()
                .setAccentColor(config.colors.error)
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('❌ **Error**\n\nCouldn\'t retrieve balance information. Please try again later.')
                );
            
            await interaction.reply({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
        }
    }
};
