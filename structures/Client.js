const { CommandoClient } = require('discord.js-commando');
const { WebhookClient } = require('discord.js');
const request = require('node-superfetch');
const Collection = require('@discordjs/collection');
const winston = require('winston');
const fontFinder = require('font-finder');
const nsfw = require('nsfwjs');
const moment = require('moment-timezone');
const fs = require('fs');
const url = require('url');
const path = require('path');
const Redis = require('./Redis');
const Font = require('./Font');
const BotList = require('./BotList');
const Patreon = require('./Patreon');
const PhoneManager = require('./phone/PhoneManager');
const TimerManager = require('./remind/TimerManager');
const PokemonStore = require('./pokemon/PokemonStore');
const activities = require('../assets/json/activity');
const leaveMsgs = require('../assets/json/leave-messages');
const {
	XIAO_WEBHOOK_ID,
	XIAO_WEBHOOK_TOKEN,
	REPORT_CHANNEL_ID,
	JOIN_LEAVE_CHANNEL_ID,
	COMMAND_CHANNEL_ID
} = process.env;

module.exports = class XiaoClient extends CommandoClient {
	constructor(options) {
		super(options);

		this.logger = winston.createLogger({
			transports: [new winston.transports.Console()],
			format: winston.format.combine(
				winston.format.timestamp({ format: 'MM/DD/YYYY HH:mm:ss' }),
				winston.format.printf(log => `[${log.timestamp}] [${log.level.toUpperCase()}]: ${log.message}`)
			)
		});
		this.fonts = new Collection();
		this.redis = Redis ? Redis.db : null;
		this.webhook = new WebhookClient(XIAO_WEBHOOK_ID, XIAO_WEBHOOK_TOKEN, { disableMentions: 'everyone' });
		this.timers = new TimerManager(this);
		this.botList = new BotList(this);
		this.patreon = new Patreon();
		this.blacklist = { guild: [], user: [] };
		this.pokemon = new PokemonStore();
		this.games = new Collection();
		this.dispatchers = new Map();
		this.cleverbots = new Map();
		this.phone = new PhoneManager(this);
		this.activities = activities;
		this.leaveMessages = leaveMsgs;
		this.adultSiteList = null;
		this.nsfwModel = null;
	}

	async registerFontsIn(filepath) {
		const files = fs.readdirSync(filepath);
		for (const file of files) {
			const metadata = await fontFinder.get(path.join(filepath, file));
			const font = new Font(path.join(filepath, file), file, metadata);
			this.fonts.set(file, font);
			font.register();
		}
		return this.fonts;
	}

	setTimezones() {
		moment.tz.link('America/Vancouver|Neopia');
		moment.tz.link('America/Los_Angeles|Discord');
		moment.tz.link('America/New_York|Dragon');
	}

	importBlacklist() {
		const read = fs.readFileSync(path.join(__dirname, '..', 'blacklist.json'), { encoding: 'utf8' });
		const file = JSON.parse(read);
		if (typeof file !== 'object' || Array.isArray(file)) return null;
		if (!file.guild || !file.user) return null;
		for (const id of file.guild) {
			if (typeof id !== 'string') continue;
			if (this.blacklist.guild.includes(id)) continue;
			this.blacklist.guild.push(id);
		}
		for (const id of file.user) {
			if (typeof id !== 'string') continue;
			if (this.blacklist.user.includes(id)) continue;
			this.blacklist.user.push(id);
		}
		return file;
	}

	exportBlacklist() {
		let text = '{\n	"guild": [\n		';
		if (this.blacklist.guild.length) {
			for (const id of this.blacklist.guild) {
				text += `"${id}",\n		`;
			}
			text = text.slice(0, -4);
		}
		text += '\n	],\n	"user": [\n		';
		if (this.blacklist.user.length) {
			for (const id of this.blacklist.user) {
				text += `"${id}",\n		`;
			}
			text = text.slice(0, -4);
		}
		text += '\n	]\n}\n';
		const buf = Buffer.from(text);
		fs.writeFileSync(path.join(__dirname, '..', 'blacklist.json'), buf, { encoding: 'utf8' });
		return buf;
	}

	importCommandLeaderboard(add = false) {
		const read = fs.readFileSync(path.join(__dirname, '..', 'command-leaderboard.json'), {
			encoding: 'utf8'
		});
		const file = JSON.parse(read);
		if (typeof file !== 'object' || Array.isArray(file)) return null;
		for (const [id, value] of Object.entries(file)) {
			if (typeof value !== 'number') continue;
			const found = this.registry.commands.get(id);
			if (!found || found.uses === undefined) continue;
			if (add) found.uses += value;
			else found.uses = value;
		}
		return file;
	}

	exportCommandLeaderboard() {
		let text = '{';
		for (const command of this.registry.commands.values()) {
			if (command.unknown) continue;
			if (command.uses === undefined) continue;
			text += `\n	"${command.name}": ${command.uses},`;
		}
		text = text.slice(0, -1);
		text += '\n}\n';
		const buf = Buffer.from(text);
		fs.writeFileSync(path.join(__dirname, '..', 'command-leaderboard.json'), buf, {
			encoding: 'utf8'
		});
		return buf;
	}

	importLastRun() {
		const read = fs.readFileSync(path.join(__dirname, '..', 'command-last-run.json'), {
			encoding: 'utf8'
		});
		const file = JSON.parse(read);
		if (typeof file !== 'object' || Array.isArray(file)) return null;
		for (const [id, value] of Object.entries(file)) {
			if (!value) continue;
			const date = new Date(value);
			if (date.toString() === 'Invalid Date') continue;
			const found = this.registry.commands.get(id);
			if (!found || found.lastRun === undefined) continue;
			found.lastRun = date;
		}
		return file;
	}

	exportLastRun() {
		let text = '{';
		for (const command of this.registry.commands.values()) {
			if (command.unknown) continue;
			if (command.lastRun === undefined) continue;
			text += `\n	"${command.name}": ${command.lastRun ? `"${command.lastRun.toISOString()}"` : null},`;
		}
		text = text.slice(0, -1);
		text += '\n}\n';
		const buf = Buffer.from(text);
		fs.writeFileSync(path.join(__dirname, '..', 'command-last-run.json'), buf, {
			encoding: 'utf8'
		});
		return buf;
	}

	async fetchAdultSiteList(force = false) {
		if (!force && this.adultSiteList) return this.adultSiteList;
		const { text } = await request
			.get('https://raw.githubusercontent.com/blocklistproject/Lists/master/alt-version/porn-nl.txt');
		this.adultSiteList = text.split('\n').filter(site => site && !site.startsWith('#'));
		setTimeout(() => this.fetchAdultSiteList(true), 8.64e+7);
		return this.adultSiteList;
	}

	async loadNSFWModel() {
		const model = await nsfw.load(
			`${url.pathToFileURL(path.join(__dirname, '..', 'tf_models', 'nsfw', 'web_model')).href}/`,
			{ type: 'graph' }
		);
		this.nsfwModel = model;
		return this.nsfwModel;
	}

	fetchReportChannel() {
		if (!REPORT_CHANNEL_ID) return null;
		return this.channels.fetch(REPORT_CHANNEL_ID);
	}

	fetchJoinLeaveChannel() {
		if (!JOIN_LEAVE_CHANNEL_ID) return null;
		return this.channels.fetch(JOIN_LEAVE_CHANNEL_ID);
	}

	fetchCommandChannel() {
		if (!COMMAND_CHANNEL_ID) return null;
		return this.channels.fetch(COMMAND_CHANNEL_ID);
	}
};
