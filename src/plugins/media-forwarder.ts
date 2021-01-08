import { Bot, Message } from '..';
import { db } from '../main';
import { PluginBase } from '../plugin';
import {
  delTag,
  generateCommandHelp,
  getInput,
  getTags,
  getWord,
  hasTag,
  isCommand,
  isInt,
  logger,
  sendRequest,
  setTag,
  telegramLinkRegExp,
} from '../utils';

export class MediaForwarderPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/resends',
        hidden: true,
      },
      {
        command: '/resend',
        parameters: [
          {
            name: 'origin',
            required: true,
          },
          {
            name: 'destination',
            required: true,
          },
        ],
        description: 'Resend all media from origin to destination',
        hidden: true,
      },
      {
        command: '/rmresend',
        parameters: [
          {
            name: 'origin',
            required: true,
          },
        ],
        description: 'Remove all resends from origin',
        hidden: true,
      },
      {
        command: '/cleanresends',
        description: 'Remove all resends from unknown groups',
        hidden: true,
      },
    ];
    this.strings = {
      resends: 'Resends',
      forwards: 'Forwards',
    };
  }

  async run(msg: Message): Promise<void> {
    const ids = {
      nsfw: -1001230470587,
      hentai: -1001495126561,
      porn: -1001409180171,
    };
    const clean = isCommand(this, 4, msg.content);
    if (isCommand(this, 1, msg.content) || clean) {
      const resends = [];
      const forwards = [];
      const removedResends = [];
      const removedForwards = [];

      let text = '';

      for (const gid in db.tags) {
        for (const tag of getTags(this.bot, gid)) {
          if (tag.indexOf('resend:') > -1) {
            resends.push(`${gid}:${tag.split(':')[1]}`);
          }
          if (tag.indexOf('fwd:') > -1) {
            forwards.push(`${gid}:${tag.split(':')[1]}`);
          }
        }
      }

      if (clean) {
        for (const item of resends) {
          const orig = item.split(':')[0];
          const dest = item.split(':')[1];
          if (!db.groups[orig] || !db.groups[dest]) {
            delTag(this.bot, orig, `resend:${dest}`);
            removedResends.push(item);
          }
        }
        for (const item of forwards) {
          const orig = item.split(':')[0];
          const dest = item.split(':')[1];

          if (!db.groups[orig] || !db.groups[dest]) {
            delTag(this.bot, orig, `fwd:${dest}`);
            removedForwards.push(item);
          }
        }
      }

      if (!clean) {
        if (resends.length > 0) {
          text += `<b>${this.strings['resends']}:</b>`;
          text += this.generateText(resends);
        }

        if (forwards.length > 0) {
          text += `\n<b>${this.strings['forwards']}:</b>`;
          text += this.generateText(forwards);
        }
      } else {
        if (removedResends.length > 0) {
          text += `<b>${this.strings['resends']}:</b>`;
          text += this.generateText(removedResends);
        }

        if (removedForwards.length > 0) {
          text += `\n<b>${this.strings['forwards']}:</b>`;
          text += this.generateText(removedForwards);
        }
      }

      this.bot.replyMessage(msg, text);
    } else if (isCommand(this, 2, msg.content)) {
      const input = getInput(msg, false);
      if (!input) {
        return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
      }
      const orig = getWord(input, 1);
      let dest = getWord(input, 2);
      if (ids[dest]) {
        dest = ids[dest];
      }
      if (!isInt(orig) || !isInt(dest)) {
        return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
      }
      setTag(this.bot, orig, `resend:${dest}`);
      this.bot.replyMessage(msg, '✅');
    } else if (isCommand(this, 3, msg.content)) {
      const input = getInput(msg, false);
      if (!input) {
        return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
      }
      const orig = getWord(input, 1);
      delTag(this.bot, orig, 'resend:?');
      delTag(this.bot, orig, 'fwd:?');
      this.bot.replyMessage(msg, '✅');
    }
  }

  generateText(items: string[]): string {
    let text = '';
    for (const item of items) {
      const orig = item.split(':')[0];
      const dest = item.split(':')[1];

      text += '\n';
      if (db.groups[orig]) {
        text += `\t${db.groups[orig].title} [${orig}]`;
      } else {
        text += `\t${orig}`;
      }
      if (db.groups[dest]) {
        text += ` ➡️ ${db.groups[dest].title} [${dest}]`;
      } else {
        text += ` ➡️ ${dest}`;
      }

      text += '\n';
    }

    return text;
  }

  async always(msg: Message): Promise<void> {
    const gid = String(msg.conversation.id);

    if (msg.sender['isBot']) {
      logger.info(`ignoring bot: ${msg.sender['firstName']} [${msg.sender.id}]`);
      return;
    }
    if (msg.sender.id == 777000) {
      logger.info(`ignoring anonymous message: ${msg.sender['firstName']} [${msg.sender.id}]`);
      return;
    }
    if (hasTag(this.bot, msg.sender.id, 'muted')) {
      logger.info(`ignoring muted user: ${msg.sender['firstName']} [${msg.sender.id}]`);
      return;
    }
    if (msg.extra.replyMarkup) {
      logger.info(`ignoring reply markup: ${msg.sender['firstName']} [${msg.sender.id}]`);
      return;
    }
    if (msg.extra.viaBotUserId) {
      const uid = String(msg.extra.viaBotUserId);
      let name = null;
      if (db.users[uid]) {
        name = db.users[uid].first_name;
      }
      logger.info(`ignoring message via bot: ${name} [${uid}]`);
      return;
    }

    if (hasTag(this.bot, gid, 'resend:?') || hasTag(this.bot, gid, 'fwd:?')) {
      for (const tag of getTags(this.bot, gid)) {
        let forward = false;
        if (tag.startsWith('resend:') || tag.startsWith('fwd:')) {
          const cid = tag.split(':')[1];
          if (msg.extra.fromChatId) {
            if (String(msg.extra['from_chat_id']) == String(cid)) {
              break;
            } else if (String(msg.extra.fromChatId) != '0') {
              if (hasTag(this.bot, cid, 'resend:?') || hasTag(this.bot, cid, 'fwd:?')) {
                logger.info('forward');
                forward = true;
              }
            }
          }
          logger.info(`tag: ${tag}, forward: ${forward}`);
        }
        if (tag.startsWith('resend:') && !forward) {
          const cid = tag.split(':')[1];

          if (
            msg.type == 'photo' ||
            msg.type == 'video' ||
            msg.type == 'animation' ||
            msg.type == 'document' ||
            (msg.type == 'text' && msg.extra.urls)
          ) {
            const r: Message = { ...msg };
            r.conversation.id = cid;
            r.conversation.title = tag;
            if (r.extra.urls) {
              for (let url of r.extra.urls) {
                const inputMatch = telegramLinkRegExp.exec(url);
                if (inputMatch && inputMatch.length > 0) {
                  logger.info(`ignoring telegram url: ${url}`);
                } else {
                  if (url.indexOf('instagram') > -1) {
                    url = url.split('?')[0];
                  }
                }
                this.bot.replyMessage(r, url, 'text', null, { preview: true });
              }
            } else {
              this.bot.replyMessage(r, msg.content, msg.type, null, { preview: true });
            }
          } else if (msg.type != 'text') {
            logger.info(`invalid type: ${msg.type}`);
          }
        } else if (tag.startsWith('fwd:') || forward) {
          const cid = tag.split(':')[1];
          if (
            msg.type == 'photo' ||
            msg.type == 'video' ||
            msg.type == 'animation' ||
            msg.type == 'document' ||
            (msg.type == 'text' && msg.extra.urls)
          ) {
            this.bot.forwardMessage(msg, cid);
          }
        }
      }
    }

    if (hasTag(this.bot, gid, 'discord:?')) {
      for (const tag of getTags(this.bot, gid, 'discord:?')) {
        const token = tag.split(':')[1];
        const webhookUrl = `https://discord.com/api/webhooks/${token}`;
        if (
          msg.type == 'photo' ||
          msg.type == 'video' ||
          msg.type == 'animation' ||
          msg.type == 'document' ||
          (msg.type == 'text' && msg.extra.urls)
        ) {
          if (msg.extra.urls) {
            for (let url of msg.extra.urls) {
              const inputMatch = telegramLinkRegExp.exec(url);
              if (inputMatch && inputMatch.length > 0) {
                logger.info(`ignoring telegram url: ${url}`);
              } else {
                if (url.indexOf('instagram') > -1) {
                  url = url.split('?')[0];
                }
              }
              await sendRequest(
                webhookUrl,
                { content: url },
                {
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                null,
                true,
                this.bot,
              );
            }
          } else {
            if (msg.content.startsWith('http')) {
              await sendRequest(
                webhookUrl,
                { content: msg.content },
                {
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                null,
                true,
                this.bot,
              );
            } else {
              const file = await this.bot.bindings.getFile(msg.content);
              // TODO
              if (file) {
                await sendRequest(
                  webhookUrl,
                  { content: file },
                  {
                    'Content-Type': 'multipart/form-data',
                  },
                  null,
                  true,
                  this.bot,
                );
              }
            }
          }
        }
      }
    }
  }
}
