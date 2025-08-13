const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ContainerBuilder, SectionBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { userOps, transactionOps } = require('../../database/database.js');
const { createUserIfNotExists } = require('../../utils/economy.js');
const config = require('../../config.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deposit')
        .setDescription('Deposit coins into your bank account to earn interest')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Amount to deposit (leave blank to deposit all)')
                .setMinValue(1)
                .setRequired(false)),
    
    async execute(interaction) {
        try {
            await createUserIfNotExists(interaction.user.id, interaction.user.username);
            
            const user = userOps.get.get(interaction.user.id);
            const amount = interaction.options.getInteger('amount');
            
            if (user.balance === 0) {
                const errorContainer = new ContainerBuilder()
                    .setAccentColor(config.colors.warning)
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent('💸 **No Funds to Deposit**\n\nYou don\'t have any coins in your wallet to deposit.\n\nTry using `/work` or `/hunt` to earn some coins first!')
                    );
                
                return await interaction.reply({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2,
                    ephemeral: true
                });
            }
            
            // If amount is specified, validate it
            if (amount) {
                if (amount > user.balance) {
                    const errorContainer = new ContainerBuilder()
                        .setAccentColor(config.colors.error)
                        .addTextDisplayComponents(
                            textDisplay => textDisplay
                                .setContent(`❌ **Insufficient Funds**\n\nYou want to deposit **${amount.toLocaleString()}** coins, but you only have **${user.balance.toLocaleString()}** coins in your wallet.`)
                        );
                    
                    return await interaction.reply({
                        components: [errorContainer],
                        flags: MessageFlags.IsComponentsV2,
                        ephemeral: true
                    });
                }
                
                if (user.bank_balance + amount > config.economy.maxBankBalance) {
                    const errorContainer = new ContainerBuilder()
                        .setAccentColor(config.colors.warning)
                        .addTextDisplayComponents(
                            textDisplay => textDisplay
                                .setContent(`🏦 **Bank Limit Exceeded**\n\nDepositing **${amount.toLocaleString()}** coins would exceed your bank limit of **${config.economy.maxBankBalance.toLocaleString()}** coins.\n\nYour current bank balance: **${user.bank_balance.toLocaleString()}** coins\nMaximum you can deposit: **${(config.economy.maxBankBalance - user.bank_balance).toLocaleString()}** coins`)
                        );
                    
                    return await interaction.reply({
                        components: [errorContainer],
                        flags: MessageFlags.IsComponentsV2,
                        ephemeral: true
                    });
                }
                
                // Process immediate deposit
                await this.processDeposit(interaction, amount);
            } else {
                // Show deposit modal for user input
                await this.showDepositModal(interaction, user);
            }
            
        } catch (error) {
            console.error('Error in deposit command:', error);
            
            const errorContainer = new ContainerBuilder()
                .setAccentColor(config.colors.error)
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('❌ **Error**\n\nSomething went wrong while processing your deposit. Please try again.')
                );
            
            await interaction.reply({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
        }
    },
    
    async showDepositModal(interaction, user) {
        // Calculate potential interest
        const maxDeposit = Math.min(user.balance, config.economy.maxBankBalance - user.bank_balance);
        const dailyInterest = Math.floor(maxDeposit * config.economy.bankInterestRate);
        
        const modal = new ModalBuilder()
            .setCustomId('deposit_modal')
            .setTitle('Bank Deposit');
        
        const amountInput = new TextInputBuilder()
            .setCustomId('deposit_amount')
            .setLabel('How much do you want to deposit?')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(`1 - ${maxDeposit.toLocaleString()} coins (or 'all')`)
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(10);
        
        const confirmInput = new TextInputBuilder()
            .setCustomId('deposit_confirm')
            .setLabel('Confirm your deposit (type "YES")')
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
    
    async handleDepositModal(interaction) {
        try {
            const amountInput = interaction.fields.getTextInputValue('deposit_amount').toLowerCase();
            const confirmInput = interaction.fields.getTextInputValue('deposit_confirm').toUpperCase();
            
            if (confirmInput !== 'YES') {
                const errorContainer = new ContainerBuilder()
                    .setAccentColor(config.colors.error)
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent('❌ **Deposit Cancelled**\n\nYou must type "YES" to confirm your deposit.')
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
                amount = user.balance;
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
            if (amount > user.balance) {
                const errorContainer = new ContainerBuilder()
                    .setAccentColor(config.colors.error)
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent(`❌ **Insufficient Funds**\n\nYou want to deposit **${amount.toLocaleString()}** coins, but you only have **${user.balance.toLocaleString()}** coins.`)
                    );
                
                return await interaction.reply({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2,
                    ephemeral: true
                });
            }
            
            if (user.bank_balance + amount > config.economy.maxBankBalance) {
                const maxAllowed = config.economy.maxBankBalance - user.bank_balance;
                const errorContainer = new ContainerBuilder()
                    .setAccentColor(config.colors.warning)
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent(`🏦 **Bank Limit Exceeded**\n\nDepositing **${amount.toLocaleString()}** coins would exceed your bank limit.\n\nMaximum you can deposit: **${maxAllowed.toLocaleString()}** coins`)
                    );
                
                return await interaction.reply({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2,
                    ephemeral: true
                });
            }
            
            await this.processDeposit(interaction, amount);
            
        } catch (error) {
            console.error('Error in deposit modal handler:', error);
            
            const errorContainer = new ContainerBuilder()
                .setAccentColor(config.colors.error)
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('❌ **Error**\n\nSomething went wrong while processing your deposit.')
                );
            
            await interaction.reply({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
        }
    },
    
    async processDeposit(interaction, amount) {
        try {
            const user = userOps.get.get(interaction.user.id);
            
            // Perform the deposit
            const newBalance = user.balance - amount;
            const newBankBalance = user.bank_balance + amount;
            
            userOps.updateBalance.run(newBalance, newBankBalance, user.last_work, interaction.user.id);
            
            // Record transaction
            transactionOps.create.run(interaction.user.id, 'earn', 0, `Deposited ${amount} coins to bank`);
            
            // Calculate daily interest for display
            const dailyInterest = Math.floor(amount * config.economy.bankInterestRate);
            const annualInterest = Math.floor(dailyInterest * 365);
            
            // Success response
            const successContainer = new ContainerBuilder()
                .setAccentColor(config.colors.success)
                .addSectionComponents(
                    section => section
                        .addTextDisplayComponents(
                            textDisplay => textDisplay
                                .setContent(`🏦 **Deposit Successful!**\n\nYou have deposited **${amount.toLocaleString()}** coins into your bank account.`),
                            textDisplay => textDisplay
                                .setContent(`**Updated Balances:**\n💰 Wallet: **${newBalance.toLocaleString()}** coins\n🏦 Bank: **${newBankBalance.toLocaleString()}** coins\n💎 Total: **${(newBalance + newBankBalance).toLocaleString()}** coins`),
                            textDisplay => textDisplay
                                .setContent(`**Interest Earnings:**\n📈 Daily Interest: **${Math.floor(newBankBalance * config.economy.bankInterestRate).toLocaleString()}** coins (${(config.economy.bankInterestRate * 100).toFixed(1)}%)\n📊 Annual Projection: **${Math.floor(newBankBalance * config.economy.bankInterestRate * 365).toLocaleString()}** coins\n\n💡 *Your money is now earning interest safely in the bank!*`)
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
            console.error('Error processing deposit:', error);
            throw error;
        }
    }
};
