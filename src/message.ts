import { Conversation, User } from '.';

export class Message {
  id: number;
  conversation: Conversation;
  sender: User;
  content: string;
  type: string;
  date: number;
  reply: Message;
  extra: string;

  constructor(
    id: number,
    conversation: Conversation,
    sender: User,
    content: string,
    type: string = 'text',
    date: number = null,
    reply: Message = null,
    extra = null,
  ) {
    this.id = id;
    this.conversation = conversation;
    this.sender = sender;
    this.content = content;
    this.type = type;
    this.date = date;
    this.reply = reply;
    this.extra = extra;
  }
}
