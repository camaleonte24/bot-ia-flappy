require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const express = require('express');

// INIZIALIZZAZIONE SERVER DI CONTROLLO PER RENDER
const app = express();
app.get('/', (req, res) => res.send('Flappy Arena Cloud Online! 🚀'));

// CONFIGURAZIONE BOT DISCORD V14 PER LETTURA CHAT STANDARED
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
    console.log("-> DISCORD ACCESO E OPERATIVO SUL NETWORK! 🟢");
});

// IL MOTORE CHE LEGGE I MESSAGGI TRADIZIONALI SENZA SLASH (/)
client.on('messageCreate', async (message) => {
    if (message.author.bot) return; // Ignora gli altri bot
    
    const t = message.content.toLowerCase().trim();
    
    // Controlla se qualcuno scrive 'gioca', '!gioca' o menziona il bot
    if (t === 'gioca' || t === '!gioca' || message.mentions.users.has(client.user.id)) {
        console.log(`Comando di gioco ricevuto da ${message.author.tag}!`);
        message.reply(`Sto entrando... (Ponte Cloud Attivo) 🟢`);
    }
});

// AVVIO PORTA ED ESECUZIONE LOGIN
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server Express attivo sulla porta ${PORT} 🚀`);
    
    if (process.env.DISCORD_TOKEN) {
        console.log("Tentativo di connessione a Discord...");
        client.login(process.env.DISCORD_TOKEN).catch((err) => {
            console.log("❌ Errore login Discord:", err.message);
        });
    } else {
        console.log("❌ Errore critico: Variabile DISCORD_TOKEN vuota!");
    }
});
