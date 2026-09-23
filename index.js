require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const express = require('express');
const { ProxyAgent } = require('undici'); // Modulo moderno per il tunnel proxy

// INIZIALIZZAZIONE MICRO SERVER PER RENDER
const app = _ => express();
const router = express.Router();
router.get('/', (req, res) => res.send('Bot Online con Bypass Tunnel Proxy 🚀'));
const serverExpress = express();
serverExpress.use('/', router);

// SELEZIONE PROXY PUBBLICO DI BACKUP PER AGGIRARE IL FIREWALL DI DISCORD
// Usiamo un tunnel HTTP standard trasparente
// FORZIAMO IL PASSAGGIO SU UN TUNNEL PROXY RESIDENZIALE FUNZIONANTE
const agentProxy = new ProxyAgent('http://185.195.234.6:3128');


// CONFIGURAZIONE BOT DISCORD V14 CON AGENT DI RETE MODIFICATO
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel, Partials.Message],
    rest: { agent: agentProxy } // Forza Discord a passare attraverso il proxy pulito
});

client.on('ready', () => {
    console.log("-> BYPASS RIUSCITO: BOT ONLINE SUL CLOUD! 🟢");
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    const t = message.content.toLowerCase().trim();
    
    if (t === 'gioca' || t === '!gioca' || message.mentions.users.has(client.user.id)) {
        message.reply(`Sto entrando... (Bypass Proxy Cloud)`);
    }
});

// AVVIO PORTA INTERNET ED ESECUZIONE LOGIN
const PORT = process.env.PORT || 10000;
serverExpress.listen(PORT, () => {
    console.log(`Porta di controllo ${PORT} sbloccata.`);
    
    if (process.env.DISCORD_TOKEN) {
        console.log("Tentativo di connessione attraverso il tunnel proxy...");
        client.login(process.env.DISCORD_TOKEN).catch((err) => {
            console.log("❌ Errore login Proxy:", err.message);
        });
    } else {
        console.log("❌ Errore: Manca il token nella scheda Environment!");
    }
});
