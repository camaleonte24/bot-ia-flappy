require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Bot diagnostico 🚀'));

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
    console.log("-> DISCORD ACCESO E REGISTRATO SUL NETWORK V14! 🟢");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server web attivo sulla porta ${PORT}`);
    
    const token = process.env.DISCORD_TOKEN;
    
    if (!token) {
        console.log("❌ ERRORE CRITICO: La cassaforte di Render è COMPLETAMENTE VUOTA!");
        return;
    }

    console.log(`Verifica: Il token caricato è lungo ${token.length} caratteri.`);
    console.log("Inizializzazione bot...");

    // TIMER DI SICUREZZA: Se dopo 5 secondi non è online, qualcosa non va
    const timerBlocco = setTimeout(() => {
        console.log("❌ ERRORE: Il login si è piantato. Controllo caratteri speciali...");
        if (token.includes(" ") || token.includes("\r") || token.includes("\n")) {
            console.log("👉 RILEVATI SPAZI O ACCAPO NASCOSTI NEL TOKEN SU RENDER! Pulisci la variabile!");
        } else {
            console.log("👉 Nessuno spazio rilevato. Il problema è il firewall di rete di Render.");
        }
    }, 5000);

    client.login(token)
        .then(() => clearTimeout(timerBlocco))
        .catch((err) => {
            clearTimeout(timerBlocco);
            console.log("❌ Errore login diretto:", err.message);
        });
});
