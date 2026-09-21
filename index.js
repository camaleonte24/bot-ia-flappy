require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// STATO DEL GIOCO MULTIPLAYER IN TEMPO REALE
let stanza = {
    giocatori: {}, // Contiene i telefoni connessi { id: { y, vy, color, name } }
    bot: { y: 250, vy: 0, attivo: false, score: 0 },
    tuboX: 600,
    tuboBucoY: 200,
    stato: "attesa"
};

const GRAVITA = 0.4;
const SALTO = -7;

// MOTORE DI GIOCO IN CLOUD (30 FPS)
function gameLoop() {
    stanza.tuboX -= 4;
    if (stanza.tuboX < -60) {
        stanza.tuboX = 600;
        stanza.tuboBucoY = Math.floor(Math.random() * 180) + 110;
        if (stanza.bot.attivo) stanza.bot.score++;
    }

    // Fisica dei giocatori reali
    Object.keys(stanza.giocatori).forEach(id => {
        let p = stanza.giocatori[id];
        p.vy += GRAVITA;
        p.y += p.vy;
        if (p.y > 480) { p.y = 480; p.vy = 0; }
        if (p.y < 0) { p.y = 0; p.vy = 0; }
    });

    // Fisica e intelligenza del Bot (Solo se attivo)
    if (stanza.bot.attivo) {
        stanza.bot.vy += GRAVITA;
        stanza.bot.y += stanza.bot.vy;
        
        // IA Predittiva Umana: calcola l'anticipo basandosi sulla distanza del tubo
        let distanzaDalBuco = stanza.bot.y - stanza.tuboBucoY;
        if (stanza.tuboX < 250 && distanzaDalBuco > 15 && stanza.bot.vy > 0) {
            if (Math.random() > 0.15) { // 15% di errore umano casuale
                stanza.bot.vy = SALTO;
            }
        }
        if (stanza.bot.y > 480) stanza.bot.y = 480;
    }

    // Invia i dati a tutti i telefoni connessi
    let datiDaInviare = JSON.stringify({ type: "update", data: stanza });
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) client.send(datiDaInviare);
    });
}
setInterval(gameLoop, 1000 / 30);

// GESTIONE CONNESSIONI TELEFONI (WEBSOCKET)
wss.on('connection', (ws) => {
    const idGiocatore = Math.random().toString(36).substring(2, 9);
    const colori = ["#ff5555", "#55ff55", "#5555ff", "#ffaa00"];
    const coloreCasuale = colori[Math.floor(Math.random() * colori.length)];
    
    stanza.giocatori[idGiocatore] = { y: 250, vy: 0, color: coloreCasuale, name: "Player_" + idGiocatore };

    ws.on('message', (message) => {
        let msg = JSON.parse(message);
        if (msg.type === "jump" && stanza.giocatori[idGiocatore]) {
            stanza.giocatori[idGiocatore].vy = SALTO;
        }
    });

    ws.on('close', () => { delete stanza.giocatori[idGiocatore]; });
});

// PAGINA WEB OTTIMIZZATA PER TELEFONI
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>Flappy Bot Multiplayer 📱</title>
        <style>
            body { margin: 0; background: #70c5ce; font-family: sans-serif; text-align: center; overflow: hidden; touch-action: none; }
            canvas { display: block; width: 100vw; height: 70vh; background: #70c5ce; border-bottom: 5px solid #73bf2e; }
            #info { padding: 10px; color: #fff; font-size: 18px; font-weight: bold; background: #222; height: 30vh; box-sizing: border-box; }
        </style>
    </head>
    <body>
        <canvas id="game" width="600" height="500"></canvas>
        <div id="info">TOCCA LO SCHERMO PER SALTARE!<br><span id="score">Punteggio Bot: 0</span></div>

        <script>
            const canvas = document.getElementById("game");
            const ctx = canvas.getContext("2d");
            const scoreEl = document.getElementById("score");

            // Si connette alla stessa stanza online tramite l'indirizzo del server cloud
            const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
            const ws = new WebSocket(protocol + window.location.host);

            let datiLocali = { giocatori: {}, bot: {}, tuboX: 600, tuboBucoY: 200 };

            ws.onmessage = (event) => {
                let msg = JSON.parse(event.data);
                if (msg.type === "update") datiLocali = msg.data;
            };

            // Tocco sul telefono per saltare
            document.addEventListener("touchstart", (e) => {
                e.preventDefault();
                ws.send(JSON.stringify({ type: "jump" }));
            }, { passive: false });

            function draw() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                // Disegna i Tubi della stanza
                ctx.fillStyle = "#73bf2e";
                ctx.fillRect(datiLocali.tuboX, 0, 60, datiLocali.tuboBucoY - 65);
                ctx.fillRect(datiLocali.tuboX, datiLocali.tuboBucoY + 65, 60, canvas.height);

                // Disegna i giocatori reali connessi
                Object.keys(datiLocali.giocatori).forEach(id => {
                    let p = datiLocali.giocatori[id];
                    ctx.fillStyle = p.color;
                    ctx.beginPath(); ctx.arc(100, p.y, 15, 0, Math.PI * 2); ctx.fill();
                });

                // Disegna il Bot Giallo (Solo se attivo da Discord)
                if (datiLocali.bot.attivo) {
                    ctx.fillStyle = "#ffff55";
                    ctx.beginPath(); ctx.arc(150, datiLocali.bot.y, 15, 0, Math.PI * 2); ctx.fill();
                    scoreEl.innerText = "Punteggio Bot IA: " + datiLocali.bot.score;
                } else {
                    scoreEl.innerText = "Il Bot IA è in attesa su Discord... (!gioca)";
                }

                requestAnimationFrame(draw);
            }
            draw();
        </script>
    </body>
    </html>
    `);
});

// BOT DISCORD (Sintassi corretta per i nuovi permessi obbligatori)
const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
    partials: [Partials.Channel, Partials.Message]
});

client.on('ready', () => { console.log(`Bot IA Pronto!`); });

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Controlla se il messaggio contiene il comando (funziona sia con prefisso che taggando)
    if (message.content.startsWith('!gioca')) {
        stanza.bot.attivo = true;
        stanza.bot.score = 0;
        stanza.bot.y = 250;
        stanza.bot.vy = 0;
        
        let linkGioco = process.env.RENDER_EXTERNAL_URL || "il link del server";
        message.reply(`🎮 **Il Bot IA è entrato nella stanza!**\nAccedete da telefono usando questo unico link per giocare insieme: \n${linkGioco}`);
    }
});

// CONFIGURAZIONE FINALE CORRETTA PER I WEB SERVICES DI RENDER
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`1. Server visivo per i telefoni attivo sulla porta ${PORT} 🚀`);
    
    // Avvia il Bot di Discord solo DOPO che il sito web è felicemente online
    if (process.env.DISCORD_TOKEN) {
        console.log("2. Tento il login nella cassaforte di Render...");
        client.login(process.env.DISCORD_TOKEN)
            .then(() => console.log("3. L'IA DI DISCORD È UFFICIALMENTE ONLINE! 🟢"))
            .catch((err) => console.log("❌ Errore critico Discord:", err.message));
    } else {
        console.log("❌ ERRORE: La variabile DISCORD_TOKEN nella scheda Environment è vuota!");
    }
});
