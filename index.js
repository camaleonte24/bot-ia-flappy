const { Client, GatewayIntentBits, Partials } = require('discord.js');
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// STATO DEL GIOCO MULTIPLAYER IN TEMPO REALE
let stanza = {
    giocatori: {}, // Connessioni { id: { y, vy, color, vivo, score } }
    bot: { y: 250, vy: 0, attivo: false, vivo: false, score: 0 },
    tuboX: 600,
    tuboBucoY: 200
};

const GRAVITA = 0.4;
const SALTO = -7;

// MOTORE DI GIOCO IN CLOUD (30 FPS)
function gameLoop() {
    stanza.tuboX -= 4;
    
    // Rigenera il tubo quando esce a sinistra
    if (stanza.tuboX < -60) {
        stanza.tuboX = 600;
        stanza.tuboBucoY = Math.floor(Math.random() * 180) + 110;
        
        // Assegna il punto a chi è ancora vivo
        Object.keys(stanza.giocatori).forEach(id => {
            if (stanza.giocatori[id].vivo) stanza.giocatori[id].score++;
        });
        if (stanza.bot.attivo && stanza.bot.vivo) stanza.bot.score++;
    }

    // FISICA E COLLISIONI GIOCATORI REALI
    Object.keys(stanza.giocatori).forEach(id => {
        let p = stanza.giocatori[id];
        if (!p.vivo) return;

        p.vy += GRAVITA;
        p.y += p.vy;

        // Collisione Soffitto/Pavimento
        if (p.y > 485 || p.y < 15) p.vivo = false;

        // Collisione Tubi (Margine di 15px)
        if (stanza.tuboX < 115 && stanza.tuboX > 40) {
            if (p.y < (stanza.tuboBucoY - 65) || p.y > (stanza.tuboBucoY + 65)) {
                p.vivo = false;
            }
        }
    });

    // FISICA AND IA DEL BOT
    if (stanza.bot.attivo && stanza.bot.vivo) {
        stanza.bot.vy += GRAVITA;
        stanza.bot.y += stanza.bot.vy;

        // Controllo Collisioni Pavimento/Soffitto Bot
        if (stanza.bot.y > 485 || stanza.bot.y < 15) stanza.bot.vivo = false;

        // Controllo Collisioni Tubi Bot
        if (stanza.tuboX < 165 && stanza.tuboX > 90) {
            if (stanza.bot.y < (stanza.tuboBucoY - 65) || stanza.bot.y > (stanza.tuboBucoY + 65)) {
                stanza.bot.vivo = false;
            }
        }
        
        // Cervello IA Predittivo Umano
        let distanzaDalBuco = stanza.bot.y - stanza.tuboBucoY;
        if (stanza.tuboX < 280 && distanzaDalBuco > 12 && stanza.bot.vy > 0) {
            if (Math.random() > 0.15) { // 15% di errore umano
                stanza.bot.vy = SALTO;
            }
        }
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
    
    // Il giocatore nasce attivo e vivo
    stanza.giocatori[idGiocatore] = { 
        y: 250, 
        vy: 0, 
        color: colori[Math.floor(Math.random() * colori.length)], 
        vivo: true, 
        score: 0 
    };

    ws.on('message', (message) => {
        let msg = JSON.parse(message);
        if (msg.type === "jump" && stanza.giocatori[idGiocatore] && stanza.giocatori[idGiocatore].vivo) {
            stanza.giocatori[idGiocatore].vy = SALTO;
        }
        // Se tocca lo schermo quando è morto, resuscita per la prossima partita
        if (msg.type === "jump" && stanza.giocatori[idGiocatore] && !stanza.giocatori[idGiocatore].vivo) {
            stanza.giocatori[idGiocatore].y = 250;
            stanza.giocatori[idGiocatore].vy = 0;
            stanza.giocatori[idGiocatore].score = 0;
            stanza.giocatori[idGiocatore].vivo = true;
        }
    });

    ws.on('close', () => { delete stanza.giocatori[idGiocatore]; });
});

// INTERFACCIA WEB PULITA PER SMARTPHONE
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>Flappy Arena 📱</title>
        <style>
            body { margin: 0; background: #70c5ce; font-family: sans-serif; text-align: center; overflow: hidden; touch-action: none; }
            canvas { display: block; width: 100vw; height: 75vh; background: #70c5ce; border-bottom: 5px solid #73bf2e; }
            #info { padding: 15px; color: #fff; font-size: 20px; font-weight: bold; background: #222; height: 25vh; box-sizing: border-box; }
        </style>
    </head>
    <body>
        <canvas id="game" width="600" height="500"></canvas>
        <div id="info">TOCCA PER SALTARE<br><span id="score">Punteggio: 0</span></div>

        <script>
            const canvas = document.getElementById("game");
            const ctx = canvas.getContext("2d");
            const scoreEl = document.getElementById("score");

            const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
            const ws = new WebSocket(protocol + window.location.host);

            let datiLocali = { giocatori: {}, bot: { attivo: false, vivo: false, y: 250, score: 0 }, tuboX: 600, tuboBucoY: 200 };

            ws.onmessage = (event) => {
                let msg = JSON.parse(event.data);
                if (msg.type === "update") datiLocali = msg.data;
            };

            document.addEventListener("touchstart", (e) => {
                e.preventDefault();
                ws.send(JSON.stringify({ type: "jump" }));
            }, { passive: false });

            function draw() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                // Disegna i Tubi Ostacolo
                ctx.fillStyle = "#73bf2e";
                ctx.fillRect(datiLocali.tuboX, 0, 60, datiLocali.tuboBucoY - 65);
                ctx.fillRect(datiLocali.tuboX, datiLocali.tuboBucoY + 65, 60, canvas.height);

                // Disegna voi reali
                Object.keys(datiLocali.giocatori).forEach(id => {
                    let p = datiLocali.giocatori[id];
                    ctx.fillStyle = p.vivo ? p.color : "#555555"; // Grigio se morto
                    ctx.beginPath(); ctx.arc(100, p.y, 15, 0, Math.PI * 2); ctx.fill();
                    
                    // Mostra il tuo punteggio in basso
                    scoreEl.innerHTML = "Tubi superati: " + p.score;
                });

                // Disegna l'avversario Bot Giallo (Solo se evocato da Discord ed è vivo)
                if (datiLocali.bot.attivo && datiLocali.bot.vivo) {
                    ctx.fillStyle = "#ffff55";
                    ctx.beginPath(); ctx.arc(150, datiLocali.bot.y, 15, 0, Math.PI * 2); ctx.fill();
                    scoreEl.innerHTML += " | Avversario IA: " + datiLocali.bot.score;
                }

                requestAnimationFrame(draw);
            }
            draw();
        </script>
    </body>
    </html>
    `);
});

// BOT DISCORD (ASINCRONO PER RENDER)
const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
    partials: [Partials.Channel, Partials.Message]
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content === '!gioca') {
        stanza.bot.attivo = true;
        stanza.bot.vivo = true;
        stanza.bot.score = 0;
        stanza.bot.y = 250;
        stanza.bot.vy = 0;
        
        message.reply(`Sto entrando...`);
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`1. Server visivo attivo sulla porta ${PORT} 🚀`);
    if (process.env.DISCORD_TOKEN) {
        client.login(process.env.DISCORD_TOKEN)
            .then(() => console.log("2. Connessione a Discord stabilita! 🟢"))
            .catch((err) => console.log("❌ Errore Discord:", err.message));
    }
});
