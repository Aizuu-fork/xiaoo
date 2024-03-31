const Command = require('../../framework/Command');
const gm = require('gm').subClass({ imageMagick: '7+' });
const request = require('node-superfetch');
const { magikToBuffer } = require('../../util/Util');

module.exports = class SwirlCommand extends Command {
	constructor(client) {
		super(client, {
			name: 'swirl',
			group: 'edit-image',
			memberName: 'swirl',
			description: 'Draws an image or a user\'s avatar but swirled.',
			throttling: {
				usages: 2,
				duration: 15
			},
			clientPermissions: ['ATTACH_FILES'],
			credit: [
				{
					name: 'ImageMagick',
					url: 'https://imagemagick.org/index.php',
					reason: 'Image Manipulation'
				}
			],
			args: [
				{
					key: 'degrees',
					type: 'integer',
					min: -360,
					max: 360
				},
				{
					key: 'image',
					type: 'image-or-avatar',
					default: msg => msg.author.displayAvatarURL({ format: 'png', size: 512 })
				}
			]
		});
	}

	async run(msg, { degrees, image }) {
		const { body } = await request.get(image);
		const magik = gm(body);
		magik.swirl(degrees);
		magik.setFormat('png');
		const attachment = await magikToBuffer(magik);
		if (Buffer.byteLength(attachment) > 8e+6) return msg.reply('Resulting image was above 8 MB.');
		return msg.say({ files: [{ attachment, name: 'swirl.png' }] });
	}
};
