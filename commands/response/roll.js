const commando = require('discord.js-commando');

module.exports = class RollCommand extends commando.Command {
    constructor(client) {
        super(client, {
            name: 'roll',
            aliases: [
                'randomnumber',
                'dice'
            ],
            group: 'response',
            memberName: 'roll',
            description: 'Rolls a Dice of your choice. (;roll 6)',
            examples: [';roll 6'],
            args: [{
                key: 'number',
                prompt: 'Which number do you want to roll?',
                type: 'integer',
                default: 6
            }]
        });
    }

    run(message, args) {
        if (message.channel.type !== 'dm') {
            if (!message.channel.permissionsFor(this.client.user).hasPermission(['SEND_MESSAGES', 'READ_MESSAGES'])) return;
        }
        const value = args.number;
        const roll = Math.floor(Math.random() * value) + 1;
        return message.say(`You rolled a ${roll}.`);
    }
};
