require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const COLORI_DISPONIBILI = ["#ff5555", "#55ff55", "#5555ff", "#ffaa00", "#ff55ff", "#00ffff"];

let stanza = {
    giocatori: {}, 
    bot: { y: 250, vy: 0, attivo: false, vivo: false, score: 0, color: "#ffff55" },
    tuboX: 600,
    tuboBucoY: 200,
    recordAssoluto: 0
};

const GRAVITA = 0.4;
const SALTO = -7;

function gameLoop() {
    stanza.tuboX -= 4;
    
    if (stanza.tuboX < -60) {
        stanza.tuboX = 600;
        stanza.tuboBucoY = Math.floor(Math.random() * 180) + 110;
        
        Object.keys(stanza.giocatori).forEach(id => {
            if (stanza.giocatori[id].vivo) {
                stanza.giocatori[id].score++;
                if (stanza.giocatori[id].score > stanza.recordAssoluto) stanza.recordAssoluto = stanza.giocatori[id].score;
            }
        });
        if (stanza.bot.attivo && stanza.bot.vivo) {
            stanza.bot.score++;
            if (stanza.bot.score > stanza.recordAssoluto) stanza.recordAssoluto = stanza.bot.score;
        }
    }

    // FISICA GIOCATORI
    Object.keys(stanza.giocatori).forEach(id => {
        let p = stanza.giocatori[id];
        if (!p.vivo) return;
        p.vy += GRAVITA; p.y += p.vy;
        if (p.y > 485 || p.y < 15) p.vivo = false;
        if (stanza.tuboX < 115 && stanza.tuboX > 40) {
            if (p.y < (stanza.tuboBucoY - 65) || p.y > (stanza.tuboBucoY + 65)) p.vivo = false;
        }
    });

    // FISICA E CERVELLO POTENZIATO DEL BOT IA
    if (stanza.bot.attivo && stanza.bot.vivo) {
        stanza.bot.vy += GRAVITA; 
        stanza.bot.y += stanza.bot.vy;
        
        // Controllo collisioni soffitto/pavimento (Immunità sul primo tubo a punteggio 0)
        if (stanza.bot.y > 485 || stanza.bot.y < 15) {
            if (stanza.bot.score > 0) {
                stanza.bot.vivo = false; 
            } else {
                stanza.bot.y = 250; 
                stanza.bot.vy = SALTO;
            }
        }
        
        // Controllo collisione con il tubo (Immunità sul primo tubo a punteggio 0)
        if (stanza.tuboX < 165 && stanza.tuboX > 90) {
            if (stanza.bot.y < (stanza.tuboBucoY - 65) || stanza.bot.y > (stanza.tuboBucoY + 65)) {
                if (stanza.bot.score > 0) stanza.bot.vivo = false;
            }
        }
        
        // INTELLIGENZA ARTIFICIALE: Guarda avanti e reagisce solo se il tubo è vicino!
        if (stanza.tuboX < 350) {
            let obiettivoY = stanza.tuboBucoY; // Punta al centro del buco
            
            // Salta solo se scende sotto l'obiettivo e sta effettivamente cadendo
            if (stanza.bot.y > (obiettivoY + 10) && stanza.bot.vy > 0) {
                stanza.bot.vy = SALTO;
            }
        } else {
            // Se il tubo è lontano, fluttua dolcemente attorno al centro dello schermo (y: 250) per stabilizzarsi
            if (stanza.bot.y > 270 && stanza.bot.vy > 0) {
                stanza.bot.vy = SALTO;
            }
        }
    }


    let datiDaInviare = JSON.stringify({ type: "update", data: stanza });
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) client.send(datiDaInviare);
    });
}
setInterval(gameLoop, 1000 / 30);

wss.on('connection', (ws) => {
    const idGiocatore = Math.random().toString(36).substring(2, 9);
    let coloriInUso = Object.keys(stanza.giocatori).map(id => stanza.giocatori[id].color);
    let coloreScelto = COLORI_DISPONIBILI.find(c => !coloriInUso.includes(c)) || "#ffffff";
    
    stanza.giocatori[idGiocatore] = { y: 250, vy: 0, color: coloreScelto, vivo: true, score: 0 };
    ws.send(JSON.stringify({ type: "welcome", yourId: idGiocatore }));

    ws.on('message', (message) => {
        let msg = JSON.parse(message);
        if (msg.type === "jump" && stanza.giocatori[idGiocatore]) {
            let p = stanza.giocatori[idGiocatore];
            if (p.vivo) p.vy = SALTO;
            else { p.y = 250; p.vy = 0; p.score = 0; p.vivo = true; }
        }
    });
    ws.on('close', () => { delete stanza.giocatori[idGiocatore]; });
});

// INTERFACCIA GRAFICA MULTIPLAYER PER SMARTPHONE
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>Flappy Arena 📱</title>
        <style>
            body { margin: 0; background: #70c5ce; font-family: sans-serif; text-align: center; overflow: hidden; touch-action: none; }
            canvas { display: block; width: 100vw; height: 60vh; background: #70c5ce; border-bottom: 5px solid #73bf2e; }
            #info { padding: 10px; color: #fff; background: #222; height: 40vh; box-sizing: border-box; overflow-y: auto; text-align: left; font-size: 16px; }
            .classifica-item { padding: 6px 10px; margin: 4px 0; border-radius: 4px; font-weight: bold; display: flex; justify-content: space-between; }
            #record-box { background: #ffd700; color: #000; padding: 8px; font-weight: bold; text-align: center; margin-bottom: 10px; border-radius: 5px; font-size: 18px; }
        </style>
    </head>
    <body>
        <canvas id="game" width="600" height="500"></canvas>
        <div id="info">
            <div id="record-box">🏆 RECORD GLOBALE: <span id="valore-record">0</span> PUNTI</div>
            <div style="text-align:center; font-weight:bold; margin-bottom:10px; color:#aaa;">TOCCA LO SCHERMO PER SALTARE</div>
            <div id="leaderboard"></div>
        </div>
        <script>
            const canvas = document.getElementById("game");
            const ctx = canvas.getContext("2d");
            const leaderboardEl = document.getElementById("leaderboard");
            const recordValEl = document.getElementById("valore-record");
            const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
            const ws = new WebSocket(protocol + window.location.host);
            let mioId = "";
            let datiLocali = { giocatori: {}, bot: { attivo: false, vivo: false, y: 250, score: 0, color: "#ffff55" }, tuboX: 600, tuboBucoY: 200, recordAssoluto: 0 };

            ws.onmessage = (event) => {
                let msg = JSON.parse(event.data);
                if (msg.type === "welcome") mioId = msg.yourId;
                if (msg.type === "update") { datiLocali = msg.data; aggiornaClassifica(); }
            };

            document.addEventListener("touchstart", (e) => { e.preventDefault(); ws.send(JSON.stringify({ type: "jump" })); }, { passive: false });

            function aggiornaClassifica() {
                recordValEl.innerText = datiLocali.recordAssoluto;
                let html = "";
                let lista = Object.keys(datiLocali.giocatori).map(id => {
                    let p = datiLocali.giocatori[id];
                    let etichetta = id === mioId ? "Tu" : "Giocatore Online";
                    return { name: etichetta, score: p.score, color: p.color, vivo: p.vivo };
                });
                if (datiLocali.bot.attivo) {
                    let statoText = datiLocali.bot.vivo ? "" : " (ELIMINATO)";
                    lista.push({ name: "Player_Giallo" + statoText, score: datiLocali.bot.score, color: datiLocali.bot.color, vivo: datiLocali.bot.vivo });
                }
                lista.sort((a, b) => b.score - a.score);
                lista.forEach(item => {
                    let stileMorte = item.vivo ? "" : "opacity: 0.4; text-decoration: line-through;";
                    html += \`<div class="classifica-item" style="background: \${item.color}; color: #000; \${stileMorte}">
                        <span>\${item.name}</span>
                        <span>\${item.score} Punti</span>
                    </div>\`;
                });
                leaderboardEl.innerHTML = html;
            }

            function draw() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = "#73bf2e";
                ctx.fillRect(datiLocali.tuboX, 0, 60, datiLocali.tuboBucoY - 65);
                ctx.fillRect(datiLocali.tuboX, datiLocali.tuboBucoY + 65, 60, canvas.height);
                Object.keys(datiLocali.giocatori).forEach(id => {
                    let p = datiLocali.giocatori[id];
                    ctx.fillStyle = p.vivo ? p.color : "#555555";
                    ctx.beginPath(); ctx.arc(100, p.y, 15, 0, Math.PI * 2); ctx.fill();
                });
                if (datiLocali.bot.attivo && datiLocali.bot.vivo) {
                    ctx.fillStyle = datiLocali.bot.color;
                    ctx.beginPath(); ctx.arc(150, datiLocali.bot.y, 15, 0, Math.PI * 2); ctx.fill();
                }
                requestAnimationFrame(draw);
            }
            draw();
        </script>
    </body>
    </html>
    `);
});

// MESSAGGI DISCORD CON DIGITAZIONE A 5 SECONDI
const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
    partials: [Partials.Channel, Partials.Message]
});

client.on('ready', () => {
    console.log("-> DISCORD ACCESO E REGISTRATO SUL NETWORK V14! 🟢");
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    const t = message.content.toLowerCase().trim();
    
    if (message.mentions.users.has(client.user.id) && t.includes('gioca')) {
        message.channel.sendTyping();

        setTimeout(() => {
            stanza.bot.attivo = true;
            stanza.bot.vivo = true;
            stanza.bot.score = 0;
            stanza.bot.y = 250;
            stanza.bot.vy = SALTO;

            // 4. Invia il messaggio di risposta
            message.reply(`Ricevuto! Sto entrando nella Flappy Arena! Record attuale: ${stanza.recordAssoluto} 🏆`);
        }, 5000); // Puoi cambiare 2000 con 3000 se vuoi 3 secondi di attesa!
    }
});

function connettiBot() {
    if (!process.env.DISCORD_TOKEN) return;
    client.login(process.env.DISCORD_TOKEN).catch((err) => {
        setTimeout(connettiBot, 10000);
    });
}

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`Server visivo attivo sulla porta ${PORT} 🚀`);
    connettiBot();
});
