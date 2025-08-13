const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ContainerBuilder, SectionBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { userOps, transactionOps } = require('../../database/database.js');
const { createUserIfNotExists } = require('../../utils/economy.js');
const config = require('../../config.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('withdraw')
        .setDescription('Withdraw coins from your bank account')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Amount to withdraw (leave blank to withdraw all)')
                .setMinValue(1)
                .setRequired(false)),
    
    async execute(interaction) {
        try {
            await createUserIfNotExists(interaction.user.id, interaction.user.username);
            
            const user = userOps.get.get(interaction.user.id);
            const amount = interaction.options.getInteger('amount');
            
            if (user.bank_balance === 0) {
                const errorContainer = new ContainerBuilder()
                    .setAccentColor(config.colors.warning)
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent('🏦 **No Funds to Withdraw**\n\nYou don\'t have any coins in your bank account to withdraw.\n\nUse `/deposit` to put some coins in your bank first!')
                    );
                
                return await interaction.reply({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2,
                    ephemeral: true
                });
            }
            
            // If amount is specified, validate it
            if (amount) {
                if (amount > user.bank_balance) {
                    const errorContainer = new ContainerBuilder()
                        .setAccentColor(config.colors.error)
                        .addTextDisplayComponents(
                            textDisplay => textDisplay
                                .setContent(`❌ **Insufficient Bank Funds**\n\nYou want to withdraw **${amount.toLocaleString()}** coins, but you only have **${user.bank_balance.toLocaleString()}** coins in your bank account.`)
                        );
                    
                    return await interaction.reply({
                        components: [errorContainer],
                        flags: MessageFlags.IsComponentsV2,
                        ephemeral: true
                    });
                }
                
                // Process immediate withdrawal
                await this.processWithdrawal(interaction, amount);
            } else {
                // Show withdrawal modal for user input
                await this.showWithdrawalModal(interaction, user);
            }
            
        } catch (error) {
            console.error('Error in withdraw command:', error);
            
            const errorContainer = new ContainerBuilder()
                .setAccentColor(config.colors.error)
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('❌ **Error**\n\nSomething went wrong while processing your withdrawal. Please try again.')
                );
            
            await interaction.reply({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
        }
    },
    
    async showWithdrawalModal(interaction, user) {
        const modal = new ModalBuilder()
            .setCustomId('withdraw_modal')
            .setTitle('Bank Withdrawal');
        
        const amountInput = new TextInputBuilder()
            .setCustomId('withdraw_amount')
            .setLabel('How much do you want to withdraw?')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(`1 - ${user.bank_balance.toLocaleString()} coins (or 'all')`)
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(10);
        
        const confirmInput = new TextInputBuilder()
            .setCustomId('withdraw_confirm')
            .setLabel('Confirm your withdrawal (type "YES")')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('YES')
            .setRequired(true)
            .setMinLength(3)
            .setMaxLength(3);
        
        const firstRow = new ActionRowBuilder().addComponents(amountInput);
        const secondRow = new ActionRowBuilder().addComponents(confirmInput);
        
        modal.addComponents(firstRow, secondRow);
        
        await interaction.showModal(modal);
    },
    
    async handleWithdrawalModal(interaction) {
        try {
            const amountInput = interaction.fields.getTextInputValue('withdraw_amount').toLowerCase();
            const confirmInput = interaction.fields.getTextInputValue('withdraw_confirm').toUpperCase();
            
            if (confirmInput !== 'YES') {
                const errorContainer = new ContainerBuilder()
                    .setAccentColor(config.colors.error)
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent('❌ **Withdrawal Cancelled**\n\nYou must type "YES" to confirm your withdrawal.')
                    );
                
                return await interaction.reply({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2,
                    ephemeral: true
                });
            }
            
            const user = userOps.get.get(interaction.user.id);
            let amount;
            
            if (amountInput === 'all') {
                amount = user.bank_balance;
            } else {
                amount = parseInt(amountInput.replace(/,/g, ''));
                
                if (isNaN(amount) || amount <= 0) {
                    const errorContainer = new ContainerBuilder()
                        .setAccentColor(config.colors.error)
                        .addTextDisplayComponents(
                            textDisplay => textDisplay
                                .setContent('❌ **Invalid Amount**\n\nPlease enter a valid positive number or "all".')
                        );
                    
                    return await interaction.reply({
                        components: [errorContainer],
                        flags: MessageFlags.IsComponentsV2,
                        ephemeral: true
                    });
                }
            }
            
            // Validate amount
            if (amount > user.bank_balance) {
                const errorContainer = new ContainerBuilder()
                    .setAccentColor(config.colors.error)
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent(`❌ **Insufficient Bank Funds**\n\nYou want to withdraw **${amount.toLocaleString()}** coins, but you only have **${user.bank_balance.toLocaleString()}** coins in your bank.`)
                    );
                
                return await interaction.reply({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2,
                    ephemeral: true
                });
            }
            
            await this.processWithdrawal(interaction, amount);
            
        } catch (error) {
            console.error('Error in withdrawal modal handler:', error);
            
            const errorContainer = new ContainerBuilder()
                .setAccentColor(config.colors.error)
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('❌ **Error**\n\nSomething went wrong while processing your withdrawal.')
                );
            
            await interaction.reply({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
        }
    },
    
    async processWithdrawal(interaction, amount) {
        try {
            const user = userOps.get.get(interaction.user.id);
            
            // Perform the withdrawal
            const newBalance = user.balance + amount;
            const newBankBalance = user.bank_balance - amount;
            
            userOps.updateBalance.run(newBalance, newBankBalance, user.last_work, interaction.user.id);
            
            // Record transaction
            transactionOps.create.run(interaction.user.id, 'earn', 0, `Withdrew ${amount} coins from bank`);
            
            // Calculate lost daily interest for display
            const lostDailyInterest = Math.floor(amount * config.economy.bankInterestRate);
            
            // Success response
            const successContainer = new ContainerBuilder()
                .setAccentColor(config.colors.success)
                .addSectionComponents(
                    section => section
                        .addTextDisplayComponents(
                            textDisplay => textDisplay
                                .setContent(`💸 **Withdrawal Successful!**\n\nYou have withdrawn **${amount.toLocaleString()}** coins from your bank account.`),
                            textDisplay => textDisplay
                                .setContent(`**Updated Balances:**\n💰 Wallet: **${newBalance.toLocaleString()}** coins\n🏦 Bank: **${newBankBalance.toLocaleString()}** coins\n💎 Total: **${(newBalance + newBankBalance).toLocaleString()}** coins`),
                            textDisplay => textDisplay
                                .setContent(`**Interest Impact:**\n📉 Lost Daily Interest: **${lostDailyInterest.toLocaleString()}** coins\n📈 Remaining Daily Interest: **${Math.floor(newBankBalance * config.economy.bankInterestRate).toLocaleString()}** coins\n\n💡 *Consider keeping money in the bank to earn interest!*`)
                        )
                );
            
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    components: [successContainer],
                    flags: MessageFlags.IsComponentsV2
                });
            } else {
                await interaction.reply({
                    components: [successContainer],
                    flags: MessageFlags.IsComponentsV2
                });
            }
            
        } catch (error) {
            console.error('Error processing withdrawal:', error);
            throw error;
        }
    }
};
