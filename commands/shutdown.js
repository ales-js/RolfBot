const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shutdown')
    .setDescription('[ADMIN] shuts down the bot.'),
  async execute(interaction, client) {
    if (interaction.user.id !== config.ownerId) {
        return await interaction.reply({ content: '`Unauthorized`\n cheeky little guy...', ephemeral: true });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('confirm_shutdown')
        .setLabel('Shut Down')
        .setStyle(ButtonStyle.Danger),

      new ButtonBuilder()
        .setCustomId('cancel_shutdown')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
      content: 'are you sure?',
      components: [row]
    });

    const filter = i =>
      i.user.id === interaction.user.id &&
      ['confirm_shutdown', 'cancel_shutdown'].includes(i.customId);

    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 15000, max: 1 });

    collector.on('collect', async i => {
      if (i.customId === 'confirm_shutdown') {
        await i.update({ content: 'Shutting Down RolfBot...', components: [] });
        console.log('[ADMIN ACTION]: Shutdown confirmed by owner; shutting down');
        await client.destroy();
        process.exit();
      } else {
        await i.update({ content: 'shutdown canceled', components: [] });
      }
    });

    collector.on('end', collected => {
      if (collected.size === 0) {
        interaction.editReply({ content: 'shutdown timed out.', components: [] });
      }
    });
  }
};