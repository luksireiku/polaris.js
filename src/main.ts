import { Bot, Config, Database } from '.';

const bots = [];

export const stop = (): void => {
  for (const bot of bots) {
    bot.stop();
  }
  process.exit(1);
};

export const db = new Database();
db.events.once('update:configs', () => {
  const bots = [];
  for (const key in db.configs.val()) {
    const configs = Config.loadInstancesFromJSON(db.configs.child(key).val());
    for (const config of configs) {
      const bot = new Bot(config);
      bot.start();
      bots.push(bot);
    }
  }
});
db.init();

process.once('SIGINT', stop);
process.once('SIGTERM', stop);
