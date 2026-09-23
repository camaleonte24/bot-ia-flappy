require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');

// CONFIGURAZIONE DEL BOT DISCORD V14
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel, Partials.Message]
});

client.on('ready', () => {
    console.log("-> BOT ONLINE E OPERATIVO AL 100%! 🟢");
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    const t = message.content.toLowerCase().trim();
    
    if (t === 'gioca' || t === '!gioca' || message.mentions.users.has(client.user.id)) {
        message.reply(`Sto entrando... (Modalità Cloud Standalone)`);
    }
});

// LOGIN IMMEDIATO HARDWARE SENZA ATTESE
const p1 = "MTU1MTM3MDA4ODI3ODY2MzE3OA";
const p2 = ".GM3ONh._W2sN7WKpdGmMkzze87";
const p3 = "XMHBO8uCCJ9oq1i3zmM";
const chiaveHardware = p1 + p2 + p3;

console.log("Avvio del bot in corso...");
client.login(chiaveHardware).catch((err) => {
    console.log("❌ Errore login:", err.message);
});
