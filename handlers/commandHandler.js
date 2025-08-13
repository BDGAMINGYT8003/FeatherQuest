const fs = require('fs');
const path = require('path');

function loadCommands(client) {
    const commandFolders = fs.readdirSync(path.join(__dirname, '..', 'commands'));

    for (const folder of commandFolders) {
        const commandFiles = fs.readdirSync(path.join(__dirname, '..', 'commands', folder)).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const command = require(`../commands/${folder}/${file}`);
            if (command.data && command.data.name) {
                client.commands.set(command.data.name, command);
                console.log(`[COMMANDS] Loaded command: ${command.data.name}`);
            } else {
                console.log(`[WARNING] The command at 'commands/${folder}/${file}' is missing a required "data" or "data.name" property.`);
            }
        }
    }
}

module.exports = {
    loadCommands
};
