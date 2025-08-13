const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, SectionBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { userOps, transactionOps } = require('../../database/database.js');
const { createUserIfNotExists } = require('../../utils/economy.js');
const { setCooldown, getCooldown } = require('../../utils/cooldowns.js');
const config = require('../../config.js');

const jobs = [
    {
        title: 'Bird Survey Assistant',
        description: 'Help researchers count local bird populations',
        minPay: 75,
        maxPay: 150,
        emoji: '📊'
    },
    {
        title: 'Wildlife Photography',
        description: 'Submit photos to nature magazines',
        minPay: 100,
        maxPay: 200,
        emoji: '📸'
    },
    {
        title: 'Nature Guide',
        description: 'Lead birdwatching tours for beginners',
        minPay: 60,
        maxPay: 120,
        emoji: '🥾'
    },
    {
        title: 'Nest Monitoring',
        description: 'Check on protected nesting sites',
        minPay: 80,
        maxPay: 160,
        emoji: '🥚'
    },
    {
        title: 'Conservation Volunteer',
        description: 'Help with habitat restoration projects',
        minPay: 50,
        maxPay: 100,
        emoji: '🌱'
    },
    {
        title: 'Bird Band Recovery',
        description: 'Report found bird bands to researchers',
        minPay: 90,
        maxPay: 180,
        emoji: '🏷️'
    },
    {
        title: 'Citizen Science Data Entry',
        description: 'Input bird sighting data into databases',
        minPay: 70,
        maxPay: 140,
        emoji: '💻'
    },
    {
        title: 'Wildlife Rehabilitation Aid',
        description: 'Assist with injured bird care',
        minPay: 85,
        maxPay: 170,
        emoji: '🏥'
    }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('work')
        .setDescription('Work various bird-related jobs to earn coins'),
    
    async execute(interaction) {
        await interaction.deferReply();
        
        try {
            await createUserIfNotExists(interaction.user.id, interaction.user.username);
            
            // Check cooldown
            const cooldownTime = getCooldown(interaction.user.id, 'work');
            if (cooldownTime > 0) {
                const hours = Math.ceil(cooldownTime / (1000 * 60 * 60));
                
                const errorContainer = new ContainerBuilder()
                    .setAccentColor(config.colors.warning)
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent(`⏰ **Work Cooldown Active**\n\nYou've already worked today! You can work again in **${hours} hours**.\n\nTry other activities like `/hunt`, `/observe`, or `/trade` while you wait.`)
                    );
                
                return await interaction.editReply({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2
                });
            }
            
            // Select random jobs
            const availableJobs = [...jobs].sort(() => 0.5 - Math.random()).slice(0, 3);
            
            // Create work interface
            const workContainer = new ContainerBuilder()
                .setAccentColor(config.colors.primary)
                .addSectionComponents(
                    section => section
                        .addTextDisplayComponents(
                            textDisplay => textDisplay
                                .setContent(`💼 **Daily Work Opportunities**\n\nChoose from today's available bird-related jobs. Each job pays differently based on difficulty and time investment.\n\n🕐 **Work Cooldown:** 24 hours\n💰 **Pay Range:** ${config.economy.dailyWorkMin}-${config.economy.dailyWorkMax} coins`)
                        )
                );
            
            // Add job options
            availableJobs.forEach((job, index) => {
                workContainer.addSectionComponents(
                    section => section
                        .addTextDisplayComponents(
                            textDisplay => textDisplay
                                .setContent(`${job.emoji} **${job.title}**\n${job.description}\n\n💰 **Pay:** ${job.minPay}-${job.maxPay} coins`)
                        )
                        .setButtonAccessory(
                            button => button
                                .setCustomId(`work_job_${index}`)
                                .setLabel(`Work as ${job.title.split(' ')[0]}`)
                                .setStyle(ButtonStyle.Success)
                        )
                );
            });
            
            // Store jobs in interaction for later use
            interaction.availableJobs = availableJobs;
            
            await interaction.editReply({
                components: [workContainer],
                flags: MessageFlags.IsComponentsV2
            });
            
        } catch (error) {
            console.error('Error in work command:', error);
            
            const errorContainer = new ContainerBuilder()
                .setAccentColor(config.colors.error)
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('❌ **Error**\n\nCouldn\'t load work opportunities. Please try again later.')
                );
            
            await interaction.editReply({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2
            });
        }
    },
    
    async handleJobSelection(interaction, jobIndex) {
        try {
            // Get job from the original jobs array since we can't reliably store in interaction
            const selectedJob = jobs[jobIndex % jobs.length]; // Fallback to modulo to prevent errors
            
            // Calculate random pay within job range
            const basePay = Math.floor(Math.random() * (selectedJob.maxPay - selectedJob.minPay + 1)) + selectedJob.minPay;
            
            // Add small random bonus for good work
            const bonus = Math.random() < 0.3 ? Math.floor(Math.random() * 50) + 10 : 0;
            const totalPay = basePay + bonus;
            
            // Update user balance
            const user = userOps.get.get(interaction.user.id);
            const newBalance = user.balance + totalPay;
            const currentTime = new Date().toISOString();
            userOps.updateBalance.run(newBalance, user.bank_balance, currentTime, interaction.user.id);
            
            // Record transaction
            transactionOps.create.run(interaction.user.id, 'earn', totalPay, `Work: ${selectedJob.title}`);
            
            // Set work cooldown
            setCooldown(interaction.user.id, 'work', config.cooldowns.work);
            
            // Generate work completion story
            const workStories = [
                'You completed your shift efficiently and impressed your supervisor.',
                'Your keen eye for detail helped identify several rare species.',
                'Other volunteers appreciated your dedication and teamwork.',
                'You went above and beyond, staying late to finish the task.',
                'Your previous birdwatching experience proved invaluable.',
                'You helped train a new volunteer, earning extra recognition.',
                'Perfect weather conditions made for a productive day.',
                'You discovered an interesting behavioral pattern worth noting.'
            ];
            
            const randomStory = workStories[Math.floor(Math.random() * workStories.length)];
            
            // Success response
            const successContainer = new ContainerBuilder()
                .setAccentColor(config.colors.success)
                .addSectionComponents(
                    section => section
                        .addTextDisplayComponents(
                            textDisplay => textDisplay
                                .setContent(`✅ **Work Complete!**\n\nYou worked as a **${selectedJob.title}** and earned **${totalPay} coins**!`),
                            textDisplay => textDisplay
                                .setContent(`**Work Summary:**\n${selectedJob.emoji} ${selectedJob.description}\n\n**Your Experience:**\n*${randomStory}*`),
                            textDisplay => textDisplay
                                .setContent(`**Earnings Breakdown:**\n• Base Pay: ${basePay} coins\n${bonus > 0 ? `• Performance Bonus: ${bonus} coins\n` : ''}**Total Earned:** ${totalPay} coins\n**New Balance:** ${newBalance.toLocaleString()} coins\n\n🕐 You can work again in 24 hours.`)
                        )
                );
            
            // Action buttons
            const huntButton = new ButtonBuilder()
                .setCustomId('work_go_hunt')
                .setLabel('🦅 Go Hunting')
                .setStyle(ButtonStyle.Primary);
            
            const balanceButton = new ButtonBuilder()
                .setCustomId('work_check_balance')
                .setLabel('💰 Check Balance')
                .setStyle(ButtonStyle.Secondary);
            
            const actionRow = new ActionRowBuilder().addComponents(huntButton, balanceButton);
            
            await interaction.update({
                components: [successContainer, actionRow],
                flags: MessageFlags.IsComponentsV2
            });
            
        } catch (error) {
            console.error('Error in job selection handler:', error);
            
            const errorContainer = new ContainerBuilder()
                .setAccentColor(config.colors.error)
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('❌ **Error**\n\nSomething went wrong while processing your work. Please try again.')
                );
            
            await interaction.update({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2
            });
        }
    }
};
