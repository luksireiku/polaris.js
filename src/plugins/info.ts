import { Bot, Message } from '..';
import { db } from '../main';
import { PluginBase } from '../plugin';
import { DatabaseConversation, DatabaseUser } from '../types';
import { dateFromTimestamp, formatNumber, getFullName, getInput, getTags, getTarget, isInt, logger } from '../utils';

export class InfoPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/info',
        parameters: [
          {
            name: 'target',
            required: false,
          },
        ],
        description: 'Info about the user and group',
        skipHelp: true,
      },
    ];
    this.strings = {
      bot: 'Bot',
      reported: 'Reported',
      channel: 'Channel',
      members: 'Members',
      restrictionReason: 'Restriction reason',
    };
  }
  async run(msg: Message): Promise<void> {
    const gid = String(msg.conversation.id);
    const input = getInput(msg, false);
    let target = getTarget(this.bot, msg, input);

    let text = '';
    const user: DatabaseUser = {};
    const group: DatabaseConversation = {};
    let showGroup = false;
    let info, infoFull, userId, groupId, userTags, groupTags;

    logger.info(`target: ${target}`);
    if (target && isInt(target) && +target > 0) {
      info = await this.bot.bindings['serverRequest']('getUser', { user_id: target });
      infoFull = await this.bot.bindings['serverRequest']('getUserFullInfo', { user_id: target });
    } else if (target && isInt(target) && target.startsWith('-100')) {
      info = await this.bot.bindings['serverRequest']('getSupergroup', { supergroup_id: target.slice(4) });
      infoFull = await this.bot.bindings['serverRequest']('getSupergroupFullInfo', { supergroup_id: target.slice(4) });
    }
    logger.info(`info: ${JSON.stringify(info)}`);
    logger.info(`infoFull: ${JSON.stringify(infoFull)}`);

    if (target && (+target == 0 || !(db.users[target] || db.users[target] || info))) {
      return this.bot.replyMessage(msg, this.bot.errors.noResults);
    }

    if (target) {
      if (+target > 0) {
        userId = target;
        if (db.users[target]) {
          if (db.users[target].first_name) {
            user.first_name = db.users[target].first_name;
          }
          if (db.users[target].last_name) {
            user.last_name = db.users[target].last_name;
          }
          if (db.users[target].username) {
            user.username = db.users[target].username;
          }
          if (db.users[target].description) {
            user.description = db.users[target].description;
          }
          if (db.users[target].description) {
            user.description = db.users[target].description;
          }
          if (db.users[target].is_bot) {
            user.is_bot = db.users[target].is_bot;
          }
          if (db.users[target].is_scam) {
            user.is_scam = db.users[target].is_scam;
          }
        }

        if (info && Object.keys(info).length > 0) {
          userId = info.id;
          user.first_name = info.first_name || '';
          user.last_name = info.last_name || '';
          user.username = info.username || '';
          user.is_scam = info.is_scam || false;
          user.is_bot = info.type._ == 'userTypeBot';
        }
        if (infoFull && Object.keys(infoFull).length > 0) {
          user.description = info['bio'] || '';
        }
        logger.info(JSON.stringify(user));
        db.users[target] = user;
        db.usersSnap.child(target).ref.set(user);
        const tags = getTags(this.bot, userId);
        if (tags && tags.length > 0) {
          userTags = tags.join(', ');
        }
      } else {
        showGroup = true;
        groupId = target;
      }
    } else {
      return this.bot.replyMessage(msg, this.bot.errors.noResults);
    }

    if (+gid < 0 && !input) {
      showGroup = true;
      target = gid;
      groupId = gid;
    }

    if (showGroup) {
      if (db.groups[target]) {
        if (db.groups[target].title) {
          group.title = db.groups[target].title;
        }
        if (db.groups[target].username) {
          group.username = db.groups[target].username;
        }
        if (db.groups[target].description) {
          group.description = db.groups[target].description;
        }
        if (db.groups[target].member_count) {
          group.member_count = db.groups[target].member_count;
        }
        if (db.groups[target].invite_link) {
          group.invite_link = db.groups[target].invite_link;
        }
      }

      if (target == gid) {
        info = await this.bot.bindings['serverRequest']('getSupergroup', { supergroup_id: target.slice(4) });
        infoFull = await this.bot.bindings['serverRequest']('getSupergroupFullInfo', {
          supergroup_id: target.slice(4),
        });
        logger.info(`info: ${JSON.stringify(info)}`);
        logger.info(`infoFull: ${JSON.stringify(infoFull)}`);
      }

      if (info && Object.keys(info).length > 0) {
        // group.title = info.title || '';
        group.username = info.username || '';
        group.member_count = info.member_count || 0;
        group.is_channel || false;
        group.is_scam || false;
        group.date = info.date || '';
        group.restriction_reason || '';
      }
      if (infoFull && Object.keys(infoFull).length > 0) {
        group.description = infoFull.description || '';
        group.invite_link = infoFull.invite_link || '';
        group.linked_chat_id = infoFull.linked_chat_id || '';
      }
      logger.info(JSON.stringify(group));
      db.groups[target] = group;
      db.groupsSnap.child(target).ref.set(group);
      const tags = getTags(this.bot, groupId);
      if (tags && tags.length > 0) {
        groupTags = tags.join(', ');
      }
    }

    if (Object.keys(user).length > 0) {
      let name = getFullName(userId, false);
      if (user.username && user.username.length > 0) {
        name += `\n\t     @${user.username}`;
      }
      text = `👤 ${name}\n🆔 ${userId}`;
      if (user.is_scam) {
        text += `\n⚠️ ${this.strings['reported']}`;
      }
      if (user.is_bot) {
        text += `\n🤖 ${this.strings['bot']}`;
      }
      if (userTags && userTags.length > 0) {
        text += `\n🏷 ${userTags}`;
      }
      if (user.description && user.description.length > 0) {
        text += `\n\n${user.description}`;
      }
    }
    if (text.length > 0) {
      text += '\n\n';
    }
    if (Object.keys(group).length > 0) {
      let name = group.title;
      if (group.username && group.username.length > 0) {
        name += `\n\t     @${group.username}`;
      }
      text += `👥 ${name}\n🆔 ${groupId}`;
      if (group.invite_link && group.invite_link.length > 0) {
        text += `\n🔗 ${group.invite_link}`;
      }
      if (group.member_count && group.member_count > 0) {
        text += `\n👪 ${formatNumber(group.member_count)}`;
      }
      if (group.linked_chat_id && group.linked_chat_id > 0) {
        let title;
        if (db.groups[group.linked_chat_id]) {
          title = db.groups[group.linked_chat_id].title;
        }
        if (title) {
          text += `\n🗨️ ${title} [<code>${group.linked_chat_id}</code>]`;
        } else {
          text += `\n🗨️ <code>${group.linked_chat_id}</code>`;
        }
      }
      if (group.date && group.date > 0) {
        text += `\n📅 ${dateFromTimestamp(group.date)}`;
      }
      if (groupTags && groupTags.length > 0) {
        text += `\n🏷 ${groupTags}`;
      }
      if (group.is_channel) {
        text += `\n📢 ${this.strings['channel']}`;
      }
      if (group.is_scam) {
        text += `\n⚠️ ${this.strings['reported']}`;
      }
      if (group.restriction_reason && group.restriction_reason.length > 0) {
        text += `\n🚫 <i>${group.restriction_reason}</i>`;
      }
      if (group.description && group.description.length > 0) {
        text += `\nℹ️ <i>${group.description}</i>`;
      }
    }

    this.bot.replyMessage(msg, text);
  }
}