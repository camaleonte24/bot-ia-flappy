require('dotenv').config();
const express = require('express');

const app = express();
app.use(express.json()); // Obbligatorio per leggere i dati da Discord

// PAGINA DI CONTROLLO STANDARD
app.get('/', (req, res) => res.send('Ponte Webhook Discord Attivo e Sbloccato! 🚀'));

// IL PUNTO DI ASCOLTO DOVE DISCORD MANDERA' I MESSAGGI
app.post('/webhook', (req, res) => {
    const { type, data } = req.body;

    // 1. Controllo di sicurezza obbligatorio di Discord (Ping-Pong iniziale)
    if (type === 1) {
        return res.json({ type: 1 });
    }

    // 2. Intercettiamo il comando quando qualcuno scrive nella chat
    if (type === 2) {
        const comando = data.name;
        
        if (comando === 'gioca') {
            console.log("Comando 'gioca' intercettato tramite Webhook! Attivazione bot...");
            
            // Qui mandiamo la risposta immediata a Discord che apparirà in chat
            return res.json({
                type: 4,
                data: {
                    content: "Sto entrando... (Ponte Cloud Webhook Attivato!) 🟢"
                }
            });
        }
    }

    res.status(200).end();
});

// AVVIO PORTA PER RENDER
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Ponte Webhook in ascolto sulla porta ${PORT} 🚀`);
});
