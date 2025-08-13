const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SelectMenuBuilder,
        ContainerBuilder, SectionBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { formatCurrency } = require('../../utils/economy.js');
const config = require('../../config.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pass')
        .setDescription('View and purchase premium season passes and subscriptions')
        .addStringOption(option =>
            option.setName('action')
                .setDescription('What would you like to do?')
                .setRequired(false)
                .addChoices(
                    { name: 'View Benefits', value: 'benefits' },
                    { name: 'Purchase Pass', value: 'purchase' },
                    { name: 'Check Status', value: 'status' },
                    { name: 'Gift Pass', value: 'gift' }
                )),

    async execute(interaction) {
        const userId = interaction.user.id;
        const action = interaction.options.getString('action') || 'benefits';
        const db = interaction.client.database;
        
        // Ensure user exists
        const user = db.ensureUser(userId, interaction.user.username);
        
        // Check current premium status
        const isPremium = user.premium_until && new Date(user.premium_until) > new Date();
        const premiumExpiry = isPremium ? new Date(user.premium_until) : null;
        
        if (action === 'status') {
            await showPremiumStatus(interaction, user, isPremium, premiumExpiry);
        } else if (action === 'purchase') {
            await showPurchaseOptions(interaction, user, db, isPremium);
        } else if (action === 'gift') {
            await showGiftOptions(interaction, user, db);
        } else {
            await showPremiumBenefits(interaction, user, isPremium, premiumExpiry);
        }
    }
};

async function showPremiumBenefits(interaction, user, isPremium, premiumExpiry) {
    const benefitsContainer = new ContainerBuilder()
        .setAccentColor(isPremium ? config.bot.successColor : config.bot.color)
        .addSectionComponents(
            section => section
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent(`🎁 **Premium Season Pass**\n\n${isPremium ? `✅ **Active Premium Member**\nExpires: ${premiumExpiry.toLocaleDateString()}` : '**Upgrade to Premium**\nUnlock exclusive features and bonuses!'}`),
                    textDisplay => textDisplay
                        .setContent(`**Current Status:** ${isPremium ? '🌟 Premium' : '⚪ Standard'}\n**Available Plans:** Monthly, Seasonal, Annual\n**Starting at:** ${formatCurrency(999)} per month`)
                )
                .setThumbnailAccessory(
                    thumbnail => thumbnail
                        .setURL('https://via.placeholder.com/150x150/FFD700/000000?text=🎁')
                        .setDescription('Premium Season Pass')
                )
        );

    benefitsContainer.addSeparatorComponents(separator => separator);
    
    // Premium benefits list
    benefitsContainer.addTextDisplayComponents(
        textDisplay => textDisplay
            .setContent(`🌟 **Premium Benefits**\n\n🎯 **Hunting Advantages:**\n• 50% reduced hunt cooldowns\n• +15% capture success rate\n• Access to exclusive hunting locations\n• Premium equipment in shop`),
        textDisplay => textDisplay
            .setContent(`💰 **Economy Bonuses:**\n• +15% work payment bonus\n• Daily premium login rewards\n• Exclusive premium quests\n• Priority customer support`),
        textDisplay => textDisplay
            .setContent(`🦅 **Collection Features:**\n• Unlimited bird storage\n• Premium album themes\n• Advanced bird analytics\n• Early access to new species`)
    );

    benefitsContainer.addSeparatorComponents(separator => separator);
    
    // Social and customization benefits
    benefitsContainer.addTextDisplayComponents(
        textDisplay => textDisplay
            .setContent(`🎨 **Customization & Social:**\n• Premium profile themes\n• Custom titles and badges\n• Enhanced guild features\n• Exclusive emotes and reactions`),
        textDisplay => textDisplay
            .setContent(`🎁 **Seasonal Events:**\n• Exclusive event participation\n• Premium event rewards\n• Early access to new features\n• Special seasonal content`)
    );

    const actionRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('pass_purchase')
                .setLabel(isPremium ? '🔄 Extend Premium' : '🎁 Get Premium')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('pass_compare')
                .setLabel('📊 Compare Plans')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('pass_gift')
                .setLabel('🎁 Gift to Friend')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('pass_faq')
                .setLabel('❓ FAQ')
                .setStyle(ButtonStyle.Secondary)
        );

    await interaction.reply({
        components: [benefitsContainer, actionRow],
        flags: MessageFlags.IsComponentsV2,
        ephemeral: true
    });
    
    // Handle button interactions
    const collector = interaction.createMessageComponentCollector({
        time: 300000 // 5 minutes
    });
    
    collector.on('collect', async buttonInteraction => {
        if (buttonInteraction.user.id !== interaction.user.id) {
            return buttonInteraction.reply({
                content: '❌ This premium interface belongs to someone else!',
                ephemeral: true
            });
        }
        
        if (buttonInteraction.customId === 'pass_purchase') {
            await showPurchaseOptions(buttonInteraction, user, interaction.client.database, isPremium);
        } else if (buttonInteraction.customId === 'pass_compare') {
            await showPlanComparison(buttonInteraction);
        } else if (buttonInteraction.customId === 'pass_gift') {
            await showGiftOptions(buttonInteraction, user, interaction.client.database);
        } else if (buttonInteraction.customId === 'pass_faq') {
            await showPremiumFAQ(buttonInteraction);
        }
    });
}

async function showPurchaseOptions(interaction, user, db, isPremium) {
    const plans = [
        {
            name: 'Monthly Premium',
            duration: '30 days',
            price: 999,
            savings: 0,
            popular: false,
            value: 'monthly'
        },
        {
            name: 'Seasonal Premium',
            duration: '90 days',
            price: 2499,
            savings: 498,
            popular: true,
            value: 'seasonal'
        },
        {
            name: 'Annual Premium',
            duration: '365 days',
            price: 7999,
            savings: 3989,
            popular: false,
            value: 'annual'
        }
    ];
    
    const purchaseContainer = new ContainerBuilder()
        .setAccentColor(config.bot.color)
        .addTextDisplayComponents(
            textDisplay => textDisplay
                .setContent(`💳 **Premium Purchase**\n\n${isPremium ? 'Extend your premium subscription:' : 'Choose your premium plan:'}\n\n💰 **Your Balance:** ${formatCurrency(user.wallet)}`)
        );

    purchaseContainer.addSeparatorComponents(separator => separator);
    
    plans.forEach(plan => {
        const canAfford = user.wallet >= plan.price;
        const popularBadge = plan.popular ? '⭐ **POPULAR** ' : '';
        const savingsText = plan.savings > 0 ? `\n💚 **Save:** ${formatCurrency(plan.savings)}` : '';
        
        purchaseContainer.addSectionComponents(
            section => section
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent(`${popularBadge}**${plan.name}**\n⏰ Duration: ${plan.duration}`),
                    textDisplay => textDisplay
                        .setContent(`💰 **Price:** ${formatCurrency(plan.price)}${savingsText}\n${canAfford ? '✅ Can Afford' : '❌ Insufficient Funds'}`)
                )
                .setButtonAccessory(
                    button => button
                        .setCustomId(`purchase_${plan.value}`)
                        .setLabel(canAfford ? 'Purchase' : 'Can\'t Afford')
                        .setStyle(canAfford ? (plan.popular ? ButtonStyle.Primary : ButtonStyle.Secondary) : ButtonStyle.Secondary)
                        .setDisabled(!canAfford)
                )
        );
        
        if (plan !== plans[plans.length - 1]) {
            purchaseContainer.addSeparatorComponents(
                separator => separator
                    .setSpacing(0)
                    .setDivider(false)
            );
        }
    });

    await interaction.reply({
        components: [purchaseContainer],
        flags: MessageFlags.IsComponentsV2,
        ephemeral: true
    });
}

async function showPlanComparison(interaction) {
    const comparisonContainer = new ContainerBuilder()
        .setAccentColor(config.bot.color)
        .addTextDisplayComponents(
            textDisplay => textDisplay
                .setContent(`📊 **Plan Comparison**\n\nChoose the plan that fits your bird watching journey:`)
        );

    comparisonContainer.addSeparatorComponents(separator => separator);
    
    comparisonContainer.addTextDisplayComponents(
        textDisplay => textDisplay
            .setContent(`**💎 Monthly Premium - ${formatCurrency(999)}**\n• Perfect for trying premium\n• All premium benefits\n• No commitment\n• ${formatCurrency(33)} per day value`),
        textDisplay => textDisplay
            .setContent(`**⭐ Seasonal Premium - ${formatCurrency(2499)}** (Popular)\n• Best value for regular players\n• 3 months of premium\n• 17% savings vs monthly\n• ${formatCurrency(28)} per day value`),
        textDisplay => textDisplay
            .setContent(`**🏆 Annual Premium - ${formatCurrency(7999)}**\n• Maximum savings\n• Full year of premium\n• 33% savings vs monthly\n• ${formatCurrency(22)} per day value\n• Exclusive annual rewards`)
    );

    comparisonContainer.addSeparatorComponents(separator => separator);
    comparisonContainer.addTextDisplayComponents(
        textDisplay => textDisplay
            .setContent(`💡 **Pro Tips:**\n• Seasonal is most popular for good reason\n• Annual includes exclusive yearly events\n• Premium stacks - purchase extends current subscription\n• All plans include immediate activation`)
    );

    await interaction.reply({
        components: [comparisonContainer],
        flags: MessageFlags.IsComponentsV2,
        ephemeral: true
    });
}

async function showGiftOptions(interaction, user, db) {
    const giftContainer = new ContainerBuilder()
        .setAccentColor(config.bot.color)
        .addTextDisplayComponents(
            textDisplay => textDisplay
                .setContent(`🎁 **Gift Premium Pass**\n\nSpread the joy of premium bird watching to friends!\n\n💰 **Your Balance:** ${formatCurrency(user.wallet)}\n\n**How it works:**\n1. Select a plan to gift\n2. Choose a recipient\n3. Add a personal message\n4. Recipient gets premium instantly!`)
        );

    giftContainer.addSeparatorComponents(separator => separator);
    giftContainer.addTextDisplayComponents(
        textDisplay => textDisplay
            .setContent(`🎨 **Gift Features Coming Soon:**\n\n• Gift any premium plan\n• Personalized gift messages\n• Instant delivery notifications\n• Gift history tracking\n• Surprise gift scheduling\n\nThis feature is currently in development. Check back soon!`)
    );

    await interaction.reply({
        components: [giftContainer],
        flags: MessageFlags.IsComponentsV2,
        ephemeral: true
    });
}

async function showPremiumFAQ(interaction) {
    const faqContainer = new ContainerBuilder()
        .setAccentColor(config.bot.color)
        .addTextDisplayComponents(
            textDisplay => textDisplay
                .setContent(`❓ **Premium FAQ**\n\nFrequently asked questions about premium:`)
        );

    faqContainer.addSeparatorComponents(separator => separator);
    
    faqContainer.addTextDisplayComponents(
        textDisplay => textDisplay
            .setContent(`**Q: How do I activate premium?**\nA: Purchase any plan and premium activates instantly!\n\n**Q: Do premiums stack?**\nA: Yes! New purchases extend your current subscription.\n\n**Q: Can I downgrade?**\nA: Premium runs until expiry, then reverts to standard.`),
        textDisplay => textDisplay
            .setContent(`**Q: What happens to premium birds/items if premium expires?**\nA: You keep everything! Premium just unlocks access to new content.\n\n**Q: Are there premium-only birds?**\nA: Some rare species require premium access to hunt.`),
        textDisplay => textDisplay
            .setContent(`**Q: Can I gift premium?**\nA: Gift features are coming soon!\n\n**Q: Is premium worth it?**\nA: Premium pays for itself through bonuses and exclusive content.\n\n**Q: Support?**\nA: Premium users get priority support!`)
    );

    await interaction.reply({
        components: [faqContainer],
        flags: MessageFlags.IsComponentsV2,
        ephemeral: true
    });
}

async function showPremiumStatus(interaction, user, isPremium, premiumExpiry) {
    const statusContainer = new ContainerBuilder()
        .setAccentColor(isPremium ? config.bot.successColor : config.bot.warningColor);

    if (isPremium) {
        const daysLeft = Math.ceil((premiumExpiry - new Date()) / (1000 * 60 * 60 * 24));
        
        statusContainer.addTextDisplayComponents(
            textDisplay => textDisplay
                .setContent(`🌟 **Premium Status: Active**\n\n✅ **Member Since:** Your premium journey\n📅 **Expires:** ${premiumExpiry.toLocaleDateString()}\n⏰ **Days Remaining:** ${daysLeft} days`),
            textDisplay => textDisplay
                .setContent(`**Active Benefits:**\n🎯 Faster hunt cooldowns\n💰 Bonus work payments\n🎨 Premium customization\n🦅 Exclusive hunting areas\n🎁 Daily premium rewards`)
        );
    } else {
        statusContainer.addTextDisplayComponents(
            textDisplay => textDisplay
                .setContent(`⚪ **Premium Status: Inactive**\n\nYou're currently using the standard (free) version of the bot.\n\n**Missing Out On:**\n• 50% faster hunting\n• 15% bonus earnings\n• Exclusive content\n• Premium support`),
            textDisplay => textDisplay
                .setContent(`💡 **Upgrade Today:**\nPremium users earn back their subscription cost through bonuses and exclusive opportunities!\n\nUse \`/pass purchase\` to get started.`)
        );
    }

    await interaction.reply({
        components: [statusContainer],
        flags: MessageFlags.IsComponentsV2,
        ephemeral: true
    });
}
