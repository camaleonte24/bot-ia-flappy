const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const app = express();

// 1. MOTORE DELL'IA PRE-ADDESTRATA
let gioco = { botY: 250, botVy: 0, tuboX: 400, tuboBucoY: 200, score: 0 };
const GRAVITA = 0.4;
const SALTO = -7;

function aggiornaIA() {
    gioco.botVy += GRAVITA;
    gioco.botY += gioco.botVy;
    gioco.tuboX -= 3;

    if (gioco.tuboX < -50) {
        gioco.tuboX = 400;
        gioco.tuboBucoY = Math.floor(Math.random() * 200) + 100;
        gioco.score++;
    }

    // Cervello dell'IA Umana: anticipa la traiettoria e fa micro-errori realistici
    let distanzaDalBuco = gioco.botY - gioco.tuboBucoY;
    if (distanzaDalBuco > 20 && gioco.botVy > 0) {
        if (Math.random() > 0.15) { // 15% di probabilità di errore umano
            gioco.botVy = SALTO; 
        }
    }
}
setInterval(aggiornaIA, 1000 / 30);

// 2. CONFIGURAZIONE BOT DISCORD
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.on('ready', () => { console.log(`Bot IA Online come ${client.user.tag}`); });

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content === '!gioca') {
        message.reply(`🎮 **Sfida Flappy Bot avviata!** L'IA sta giocando nel Cloud. Scrivi **!punteggio** per vedere come va!`);
    }
    if (message.content === '!punteggio') {
        message.reply(`🤖 **Bot_IA:** ${gioco.score} punti (Altezza: ${Math.round(gioco.botY)})`);
    }
});

// Usa la variabile d'ambiente sicura di Render per il Token
client.login(process.env.DISCORD_TOKEN).catch(console.error);

// Mantiene attivo Render
app.get('/', (req, res) => res.send('Bot Flappy IA Attivo!'));
app.listen(process.env.PORT || 3000);
