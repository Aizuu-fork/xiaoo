const { Command } = require('discord.js-commando');
const { list, pad } = require('../../util/Util');
const modes = ['encode', 'decode'];

module.exports = class BinaryCommand extends Command {
	constructor(client) {
		super(client, {
			name: 'binary',
			group: 'text-edit',
			memberName: 'binary',
			description: 'Converts text to binary.',
			args: [
				{
					key: 'mode',
					prompt: `Would you like to ${list(modes, 'or')}?`,
					type: 'string',
					format: `<${modes.join('|')}>`,
					validate: mode => {
						if (modes.includes(mode.toLowerCase())) return true;
						return `Invalid mode, please enter either ${list(modes, 'or')}.`;
					},
					parse: mode => mode.toLowerCase()
				},
				{
					key: 'text',
					prompt: 'What text would you like to convert to binary?',
					type: 'string',
					validate: text => {
						if (this.binary(text).length < 2000) return true;
						return 'Invalid text, your text is too long.';
					}
				}
			]
		});
	}

	run(msg, { mode, text }) { // eslint-disable-line consistent-return
		if (mode === 'encode') return msg.say(this.binary(text));
		else if (mode === 'decode') return msg.say(this.unbinary(text));
	}

	binary(text) {
		return text.split('').map(str => {
			const converted = str.charCodeAt(0).toString(2);
			return pad(converted, '00000000');
		}).join(' ');
	}

	unbinary(text) {
		return text.split(' ').map(str => String.fromCharCode(parseInt(str, 2))).join('');
	}
};
