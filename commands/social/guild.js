const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ContainerBuilder, SectionBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { guildOps, userOps } = require('../../database/database.js');
const { createUserIfNotExists } = require('../../utils/economy.js');
const config = require('../../config.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('guild')
        .setDescription('Manage your bird hunting guild')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a new guild')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Name for your guild')
                        .setRequired(true)
                        .setMinLength(3)
                        .setMaxLength(50)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('View guild information')
                .addStringOption(option =>
                    option.setName('guild')
                        .setDescription('Guild name to view (leave blank for your guild)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('join')
                .setDescription('Join a guild')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Name of the guild to join')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('leave')
                .setDescription('Leave your current guild'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('invite')
                .setDescription('Invite a user to your guild')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to invite')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('members')
                .setDescription('View guild members'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('bank')
                .setDescription('Manage guild bank')),
    
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        try {
            await createUserIfNotExists(interaction.user.id, interaction.user.username);
            
            switch (subcommand) {
                case 'create':
                    await this.handleCreate(interaction);
                    break;
                case 'info':
                    await this.handleInfo(interaction);
                    break;
                case 'join':
                    await this.handleJoin(interaction);
                    break;
                case 'leave':
                    await this.handleLeave(interaction);
                    break;
                case 'invite':
                    await this.handleInvite(interaction);
                    break;
                case 'members':
                    await this.handleMembers(interaction);
                    break;
                case 'bank':
                    await this.handleBank(interaction);
                    break;
            }
        } catch (error) {
            console.error('Error in guild command:', error);
            
            const errorContainer = new ContainerBuilder()
                .setAccentColor(config.colors.error)
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('❌ **Error**\n\nSomething went wrong with the guild command. Please try again.')
                );
            
            await interaction.reply({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
        }
    },
    
    async handleCreate(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const guildName = interaction.options.getString('name');
        
        // Check if user already owns a guild
        const existingGuild = guildOps.getByOwner.get(interaction.user.id);
        if (existingGuild) {
            const errorContainer = new ContainerBuilder()
                .setAccentColor(config.colors.warning)
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent(`🏛️ **Guild Already Owned**\n\nYou already own a guild called "**${existingGuild.name}**".\n\nYou can only own one guild at a time. You can transfer ownership or disband your current guild first.`)
                );
            
            return await interaction.editReply({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2
            });
        }
        
        // Check if guild name is taken
        try {
            guildOps.create.run(guildName, interaction.user.id, `A guild founded by ${interaction.user.username}`);
            const newGuild = guildOps.getByOwner.get(interaction.user.id);
            
            // Add creator as owner member
            guildOps.addMember.run(newGuild.id, interaction.user.id);
            
            const successContainer = new ContainerBuilder()
                .setAccentColor(config.colors.success)
                .addSectionComponents(
                    section => section
                        .addTextDisplayComponents(
                            textDisplay => textDisplay
                                .setContent(`🏛️ **Guild Created Successfully!**\n\nWelcome to "**${guildName}**"! You are now the guild owner.`),
                            textDisplay => textDisplay
                                .setContent(`**Guild Features:**\n• Invite other bird hunters to join\n• Share resources and collaborate\n• Compete in guild events\n• Build a guild bank for shared funds\n\n**Next Steps:**\n• Use \`/guild invite @user\` to invite members\n• Set up a guild description and rules\n• Start building your guild community!`)
                        )
                );
            
            await interaction.editReply({
                components: [successContainer],
                flags: MessageFlags.IsComponentsV2
            });
            
        } catch (error) {
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                const errorContainer = new ContainerBuilder()
                    .setAccentColor(config.colors.error)
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent(`❌ **Guild Name Taken**\n\nA guild named "**${guildName}**" already exists.\n\nPlease choose a different name for your guild.`)
                    );
                
                await interaction.editReply({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2
                });
            } else {
                throw error;
            }
        }
    },
    
    async handleInfo(interaction) {
        await interaction.deferReply();
        
        const guildName = interaction.options.getString('guild');
        let guild;
        
        if (guildName) {
            // Find guild by name
            guild = guildOps.db.prepare('SELECT * FROM guilds WHERE name = ?').get(guildName);
        } else {
            // Find user's guild
            const userMembership = guildOps.db.prepare(`
                SELECT g.* FROM guilds g 
                JOIN guild_members gm ON g.id = gm.guild_id 
                WHERE gm.user_id = ?
            `).get(interaction.user.id);
            guild = userMembership;
        }
        
        if (!guild) {
            const errorContainer = new ContainerBuilder()
                .setAccentColor(config.colors.warning)
                .addTextDisplayComponents(
                    textDisplay => textDisplay
                        .setContent('🔍 **Guild Not Found**\n\nNo guild found with that name, or you\'re not a member of any guild.\n\nUse `/guild create` to start your own guild or `/guild join` to join an existing one.')
                );
            
            return await interaction.editReply({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2
            });
        }
        
        const members = guildOps.getMembers.all(guild.id);
        const owner = await interaction.client.users.fetch(guild.owner_id).catch(() => null);
        
        const infoContainer = new ContainerBuilder()
            .setAccentColor(config.colors.primary)
            .addSectionComponents(
                section => section
                    .addTextDisplayComponents(
                        textDisplay => textDisplay
                            .setContent(`🏛️ **${guild.name}**\n\n${guild.description || '*No description set*'}`),
                        textDisplay => textDisplay
                            .setContent(`**Guild Information:**\n👑 Owner: ${owner ? owner.username : 'Unknown'}\n👥 Members: **${members.length}**/50\n🏦 Bank: **${guild.bank_balance.toLocaleString()}** coins\n📅 Founded: ${new Date(guild.created_at).toLocaleDateString()}`)
                    )
            );
        
        // Show recent members
        if (members.length > 0) {
            const memberList = members.slice(0, 10).map(member => {
                const roleEmoji = member.role === 'owner' ? '👑' : member.role === 'admin' ? '⭐' : '👤';
                return `${roleEmoji} ${member.username}`;
            }).join('\n');
            
            const moreMembers = members.length > 10 ? `\n*...and ${members.length - 10} more*` : '';
            
            infoContainer.addTextDisplayComponents(
                textDisplay => textDisplay
                    .setContent(`**Members:**\n${memberList}${moreMembers}`)
            );
        }
        
        // Action buttons
        const viewMembersButton = new ButtonBuilder()
            .setCustomId(`guild_view_members_${guild.id}`)
            .setLabel('👥 View All Members')
            .setStyle(ButtonStyle.Secondary);
        
        const actionRow = new ActionRowBuilder().addComponents(viewMembersButton);
        
        await interaction.editReply({
            components: [infoContainer, actionRow],
            flags: MessageFlags.IsComponentsV2
        });
    },
    
    async handleJoin(interaction) {
        const notImplementedContainer = new ContainerBuilder()
            .setAccentColor(config.colors.info)
            .addTextDisplayComponents(
                textDisplay => textDisplay
                    .setContent('🚧 **Feature In Development**\n\nGuild joining system is being implemented.\n\nThis will include:\n• Public guild directory\n• Join requests and approvals\n• Guild search and filtering\n\nCheck back in the next update!')
            );
        
        await interaction.reply({
            components: [notImplementedContainer],
            flags: MessageFlags.IsComponentsV2,
            ephemeral: true
        });
    },
    
    async handleLeave(interaction) {
        const notImplementedContainer = new ContainerBuilder()
            .setAccentColor(config.colors.info)
            .addTextDisplayComponents(
                textDisplay => textDisplay
                    .setContent('🚧 **Feature In Development**\n\nGuild leave system is being implemented.\n\nThis will include:\n• Leave confirmation\n• Role transfer for owners\n• Proper cleanup procedures\n\nCheck back in the next update!')
            );
        
        await interaction.reply({
            components: [notImplementedContainer],
            flags: MessageFlags.IsComponentsV2,
            ephemeral: true
        });
    },
    
    async handleInvite(interaction) {
        const notImplementedContainer = new ContainerBuilder()
            .setAccentColor(config.colors.info)
            .addTextDisplayComponents(
                textDisplay => textDisplay
                    .setContent('🚧 **Feature In Development**\n\nGuild invitation system is being implemented.\n\nThis will include:\n• Member invitations\n• Invite acceptance/rejection\n• Role permissions\n\nCheck back in the next update!')
            );
        
        await interaction.reply({
            components: [notImplementedContainer],
            flags: MessageFlags.IsComponentsV2,
            ephemeral: true
        });
    },
    
    async handleMembers(interaction) {
        const notImplementedContainer = new ContainerBuilder()
            .setAccentColor(config.colors.info)
            .addTextDisplayComponents(
                textDisplay => textDisplay
                    .setContent('🚧 **Feature In Development**\n\nDetailed member management is being implemented.\n\nThis will include:\n• Member list with roles\n• Activity tracking\n• Permission management\n\nCheck back in the next update!')
            );
        
        await interaction.reply({
            components: [notImplementedContainer],
            flags: MessageFlags.IsComponentsV2,
            ephemeral: true
        });
    },
    
    async handleBank(interaction) {
        const notImplementedContainer = new ContainerBuilder()
            .setAccentColor(config.colors.info)
            .addTextDisplayComponents(
                textDisplay => textDisplay
                    .setContent('🚧 **Feature In Development**\n\nGuild banking system is being implemented.\n\nThis will include:\n• Shared guild treasury\n• Member contributions\n• Guild expenses and investments\n\nCheck back in the next update!')
            );
        
        await interaction.reply({
            components: [notImplementedContainer],
            flags: MessageFlags.IsComponentsV2,
            ephemeral: true
        });
    }
};
