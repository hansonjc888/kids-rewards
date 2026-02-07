import { getTelegramProvider } from './lib/messaging';

async function test() {
  const telegram = getTelegramProvider();
  const me = await telegram.getMe();
  console.log('✅ Bot is working!');
  console.log('Bot username:', me.username);
  console.log('Bot name:', me.first_name);
  
  // Test sending a message (you'll need to get your chat ID first)
  console.log('\nTo get your chat ID:');
  console.log('1. Send a message to your bot on Telegram');
  console.log('2. Visit: https://api.telegram.org/bot7686005555:AAE3WuVii55hcgnr3YUssjiu6ibX8HY2szE/getUpdates');
  console.log('3. Look for "chat":{"id": YOUR_NUMBER}');
}

test().catch(console.error);
