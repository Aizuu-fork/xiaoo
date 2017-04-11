const commando = require('discord.js-commando');
const Discord = require('discord.js');

module.exports = class DiscrimCommand extends commando.Command {
    constructor(client) {
        super(client, {
            name: 'discrim',
            aliases: [
                'discriminator',
                'searchdiscrim'
            ],
            group: 'search',
            memberName: 'discrim',
            description: 'Searches the server for a certain discriminator. (;discrim 8081)',
            examples: [';discrim 8081'],
            args: [{
                key: 'discrim',
                prompt: 'Which discriminator would you like to search for?',
                type: 'string',
                validate: discrim => {
                    if (discrim.match(/^[0-9]+$/) && discrim.length === 4) {
                        return true;
                    }
                    return 'Invalid discriminator.';
                }
            }]
        });
    }

    async run(message, args) {
        if (message.channel.type !== 'dm') {
            if (!message.channel.permissionsFor(this.client.user).hasPermission(['SEND_MESSAGES', 'READ_MESSAGES'])) return;
            if (!message.channel.permissionsFor(this.client.user).hasPermission('EMBED_LINKS')) return message.say(':x: Error! I don\'t have the Embed Links Permission!');
        }
        const userToSearch = args.discrim;
        const users = await this.client.users.filter(u => u.discriminator === userToSearch).map(u => u.username).sort();
        const embed = new Discord.RichEmbed()
            .setTitle(`${users.length} Users with the discriminator: ${userToSearch}`)
            .setDescription(users.join(', '));
        return message.embed(embed);
    }
};
