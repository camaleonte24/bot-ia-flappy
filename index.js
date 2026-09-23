const express = require('express');
const { InteractionType, InteractionResponseType, verifyKeyMiddleware } = require('discord-interactions');

const app = express();

// LA TUA CHIAVE PUBBLICA HARDWARE PRESA DALLO SCHERMO
const CHIAVE_PUBBLICA = '2c7779edaafb7ce531ece50025663ac7870c1ba7325d366218194a71104f76b2';

app.get('/', (req, res) => res.send('Ponte Webhook Ufficiale Attivo! 🚀'));

// IL MITICO FILTRO DI DISCORD CHE VERIFICA LE FIRME AUTOMATICAMENTE IN UN MILLISECONDO
app.post('/webhook', verifyKeyMiddleware(CHIAVE_PUBBLICA), (req, res) => {
    const { type, data } = req.body;

    // 1. Gestione del PING iniziale di Discord (Il test che bloccava il salvataggio)
    if (type === InteractionType.PING) {
        console.log("-> Discord ha validato la firma con successo! 🤝");
        return res.send({ type: InteractionResponseType.PONG });
    }

    // 2. Lettura del comando in chat
    if (type === InteractionType.APPLICATION_COMMAND) {
        if (data && data.name === 'gioca') {
            console.log("Comando /gioca intercettato via Webhook!");
            return res.send({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content: "Sto entrando... (Ponte Cloud Webhook Ufficiale!) 🟢"
                }
            });
        }
    }

    res.status(200).end();
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server Webhook Ufficiale in ascolto sulla porta ${PORT} 🚀`);
});
