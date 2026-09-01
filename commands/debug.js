const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const os = require('os');
const process = require('process');
const si = require('systeminformation');

const configPath = path.join(__dirname, '..', 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('debug')
    .setDescription('Host Information'),

  async execute(interaction, client) {
    try {
      const ping = Math.round(client.ws.ping);
      const uptime = process.uptime() * 1000;

      const formatUptime = ms => {
        const s = Math.floor(ms / 1000);
        const d = Math.floor(s / 86400);
        const h = Math.floor((s % 86400) / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;

        return `${d}d ${h}h ${m}m ${sec}s`;
      };

      const memUsage = (
        process.memoryUsage().heapUsed /
        1024 /
        1024
      ).toFixed(2);

      const load = await si.currentLoad();
      const cpuLoad = load.currentLoad.toFixed(2);

      const cpuSpeed = await si.cpuCurrentSpeed();

      const reply =
`ping: ${ping} ms
uptime: ${formatUptime(uptime)}
RAM load: ${memUsage} MB
CPU load: ${cpuLoad}%
OS: ${os.type()} ${os.release()} (${os.arch()})
node.js version: ${process.version}
core speeds: ${cpuSpeed.cores.map(core => `${core.toFixed(2)} GHz`).join(', ')}
bot version: ${config.version}`;

      await interaction.reply(reply);
    } catch (err) {
      console.error('/debug failed...!', err);

      const errorMessage = err instanceof Error
        ? err.message
        : String(err);

      await interaction.reply({
        content: `\`${errorMessage}\`\nError! Please report this to ales.js (<@1044985132777480253>)`,
        ephemeral: true
      });
    }
  }
};