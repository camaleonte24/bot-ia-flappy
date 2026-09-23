require('dotenv').config();
const express = require('express');
const crypto = require('crypto'); // Modulo nativo per verificare la sicurezza di Discord

const app = express();

// CHIAVE PUBBLICA HARDWARE (Presa dal tuo screenshot)
const CHIAVE_PUBBLICA = "2c7779edaafb7ce531ece50025663ac7870c1ba7325d366218194a71104f76b2";

// FUNZIONE DI VERIFICA OBBLIGATORIA RICHIESTA DA DISCORD
function verificaFirmaDiscord(req, res, buf) {
    const signature = req.headers['x-signature-ed25519'];
    const timestamp = req.headers['x-signature-timestamp'];
    
    if (!signature || !timestamp) {
        throw new Error('Firma mancante');
    }

    const isVerified = crypto.verify(
        null,
        Buffer.concat([Buffer.from(timestamp), buf]),
        { key: Buffer.from(CHIAVE_PUBBLICA, 'hex'), format: 'der', type: 'public' },
        Buffer.from(signature, 'hex')
    );

    if (!isVerified) {
        throw new Error('Firma invalida, intruso rilevato!');
    }
}

// Configura Express per controllare la firma di ogni messaggio in arrivo
app.use(express.json({ verify: verificaFirmaDiscord }));

// PAGINA DI CONTROLLO STANDARD
app.get('/', (req, res) => res.send('Ponte Webhook Certificato Discord Attivo! 🚀'));

// IL PUNTO DI ASCOLTO SBLOCCATO
app.post('/webhook', (req, res) => {
    const { type, data } = req.body;

    // 1. Risposta al PING iniziale di Discord (Ora passerà il test!)
    if (type === 1) {
        console.log("Discord ha verificato il server con successo! 🤝");
        return res.json({ type: 1 });
    }

    // 2. Intercettiamo il comando quando qualcuno scriverà in chat
    if (type === 2) {
        if (data && data.name === 'gioca') {
            console.log("Comando /gioca intercettato!");
            return res.json({
                type: 4,
                data: {
                    content: "Sto entrando... (Ponte Cloud Webhook Certificato!) 🟢"
                }
            });
        }
    }

    res.status(200).end();
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Ponte crittografato in ascolto sulla porta ${PORT} 🚀`);
});
