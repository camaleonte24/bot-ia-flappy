require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let contatoreGiocatori = 0;
let cronologiaPartita = []; // Salva i punteggi per il report finale su Discord

let stanza = {
    giocatori: {}, 
    bot: { y: 250, vy: 0, attivo: false, vivo: false, score: 0, color: "#ffff33", numero: 0, errorePianificato: false, tuboDecisoId: -1 },
    tuboX: 600,
    tuboBucoY: 200,
    tuboId: 0,
    recordAssoluto: 0
};

const GRAVITA = 0.4;
const SALTO = -7;
const POSIZIONE_X_LINEA = 100; // Tutti allineati sulla stessa linea!

// TAVOLOZZA DI COLORI VIVIDI E NETTAMENTE DISTINGUIBILI
const COLORI_PREDEFINITI = [
    "rgb(255,45,85)",   // Rosso acceso
    "rgb(76,217,100)",  // Verde brillante
    "rgb(0,122,255)",   // Blu elettrico
    "rgb(255,149,0)",   // Arancione saturo
    "rgb(142,68,173)",  // Viola scuro
    "rgb(90,200,250)",  // Ciano/Azzurro
    "rgb(255,204,0)",   // Oro/Giallo carico
    "rgb(255,45,140)"   // Rosa shock
];

function generaColoreCasuale() {
    // Cerca il primo colore della tavolozza non ancora usato nella stanza
    let coloriInUso = Object.values(stanza.giocatori).map(p => p.color);
    let coloreTrovato = COLORI_PREDEFINITI.find(c => !coloriInUso.includes(c));
    
    // Se la stanza è affollatissima e i colori sono finiti, ne genera uno casuale forte
    if (!coloreTrovato) {
        let r = Math.floor(Math.random() * 3) * 90 + 50;
        let g = Math.floor(Math.random() * 3) * 90 + 50;
        let b = Math.floor(Math.random() * 3) * 90 + 50;
        coloreTrovato = `rgb(${r},${g},${b})`;
    }
    return coloreTrovato;
}

function inviaReportDiscord() {
    if (cronologiaPartita.length === 0) return;
    
    // Ordina la classifica finale dal punteggio più alto
    cronologiaPartita.sort((a, b) => b.score - a.score);
    
    let messaggio = `🎮 **La sessione di gioco è terminata!** Ecco la classifica finale:\n`;
    cronologiaPartita.forEach((player, index) => {
        const medaglia = index === 0 ? "🏆 " : index === 1 ? "🥈 " : index === 2 ? "🥉 " : "✨ ";
        messaggio += `${medaglia}**Giocatore ${player.numero}**: ${player.score} Punti ${player.isBot ? '(IO)' : ''}\n`;
    });

    if (client.channels.cache.size > 0) {
        const canale = client.channels.cache.find(c => c.type === 0); // Trova il primo canale di testo
        if (canale) canale.send(messaggio);
    }
    
    cronologiaPartita = []; // Svuota la cronologia
}

function gameLoop() {
    stanza.tuboX -= 4;
    
    if (stanza.tuboX < -60) {
        stanza.tuboX = 600;
        stanza.tuboBucoY = Math.floor(Math.random() * 180) + 110;
        stanza.tuboId++;
        
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
        
        if (stanza.tuboX < (POSIZIONE_X_LINEA + 15) && stanza.tuboX > (POSIZIONE_X_LINEA - 60)) {
            if (p.y < (stanza.tuboBucoY - 65) || p.y > (stanza.tuboBucoY + 65)) p.vivo = false;
        }
    });

    // FISICA E CERVELLO IA CON GARANZIA DI ERRORE
    if (stanza.bot.attivo && stanza.bot.vivo) {
        stanza.bot.vy += GRAVITA; 
        stanza.bot.y += stanza.bot.vy;
        
        if (stanza.bot.y > 485 || stanza.bot.y < 15) {
            if (stanza.bot.score > 0) stanza.bot.vivo = false;
            else { stanza.bot.y = 250; stanza.bot.vy = SALTO; }
        }
        
        if (stanza.tuboX < (POSIZIONE_X_LINEA + 15) && stanza.tuboX > (POSIZIONE_X_LINEA - 60)) {
            if (stanza.bot.y < (stanza.tuboBucoY - 65) || stanza.bot.y > (stanza.tuboBucoY + 65)) {
                if (stanza.bot.score > 0) stanza.bot.vivo = false;
            }
        }
        
        // PIANIFICAZIONE ERRORE SICURA: Decide una volta sola per tubo se sbagliare
        if (stanza.bot.tuboDecisoId !== stanza.tuboId) {
            stanza.bot.tuboDecisoId = stanza.tuboId;
            stanza.bot.errorePianificato = (stanza.bot.score >= 3) && (Math.random() < 0.15);
        }
        
        if (stanza.tuboX < 350) {
            let obiettivoY = stanza.tuboBucoY;
            
            if (stanza.bot.errorePianificato && stanza.tuboX < 180) {
                // Smette di saltare e si schianta matematicamente!
            } else {
                if (stanza.bot.y > (obiettivoY + 10) && stanza.bot.vy > 0) {
                    stanza.bot.vy = SALTO;
                }
            }
        } else {
            if (stanza.bot.y > 270 && stanza.bot.vy > 0) {
                stanza.bot.vy = SALTO;
            }
        }
    }

    if (stanza.bot.attivo && !stanza.bot.vivo && !cronologiaPartita.some(x => x.isBot)) {
        cronologiaPartita.push({ numero: stanza.bot.numero, score: stanza.bot.score, isBot: true });
    }

    let datiDaInviare = JSON.stringify({ type: "update", data: stanza });
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) client.send(datiDaInviare);
    });
}
setInterval(gameLoop, 1000 / 30);
wss.on('connection', (ws) => {
    contatoreGiocatori++;
    const mioNumero = contatoreGiocatori;
    const idGiocatore = Math.random().toString(36).substring(2, 9);
    let coloreScelto = generaColoreCasuale();
    
    stanza.giocatori[idGiocatore] = { y: 250, vy: 0, color: coloreScelto, vivo: true, score: 0, numero: mioNumero };
    ws.send(JSON.stringify({ type: "welcome", yourId: idGiocatore }));

    ws.on('message', (message) => {
        let msg = JSON.parse(message);
        if (msg.type === "jump" && stanza.giocatori[idGiocatore]) {
            let p = stanza.giocatori[idGiocatore];
            if (p.vivo) p.vy = SALTO;
            else { p.y = 250; p.vy = 0; p.score = 0; p.vivo = true; }
        }
    });

    ws.on('close', () => {
        if (stanza.giocatori[idGiocatore]) {
            cronologiaPartita.push({ numero: stanza.giocatori[idGiocatore].numero, score: stanza.giocatori[idGiocatore].score, isBot: false });
            delete stanza.giocatori[idGiocatore];
        }
        
        if (Object.keys(stanza.giocatori).length === 0) {
            if (stanza.bot.attivo && stanza.bot.vivo) {
                cronologiaPartita.push({ numero: stanza.bot.numero, score: stanza.bot.score, isBot: true });
            }
            inviaReportDiscord();
            stanza.bot.attivo = false;
            stanza.bot.vivo = false;
            contatoreGiocatori = 0;
        }
    });
});

// INTERFACCIA GRAFICA 3D FLUIDA
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>Flappy Arena 3D 📱</title>
        <style>
            body { margin: 0; background: #222; font-family: 'Segoe UI', sans-serif; text-align: center; overflow: hidden; touch-action: none; }
            #game-container { position: relative; width: 100vw; height: 60vh; background: linear-gradient(to bottom, #4a90e2 0%, #70c5ce 70%, #efe1b5 100%); }
            canvas { display: block; width: 100vw; height: 60vh; }
            #info { padding: 15px; color: #fff; background: #1a1a1a; height: 40vh; box-sizing: border-box; overflow-y: auto; text-align: left; }
            .classifica-item { padding: 10px 15px; margin: 6px 0; border-radius: 8px; font-weight: bold; display: flex; justify-content: space-between; box-shadow: 0 4px 6px rgba(0,0,0,0.15); border-left: 5px solid rgba(0,0,0,0.2); }
            #record-box { background: linear-gradient(135deg, #ffd700 0%, #ffa500 100%); color: #000; padding: 12px; font-weight: bold; text-align: center; margin-bottom: 12px; border-radius: 8px; font-size: 18px; box-shadow: 0 4px 10px rgba(255,215,0,0.3); }
        </style>
    </head>
    <body>
        <div id="game-container">
            <canvas id="game" width="600" height="500"></canvas>
        </div>
        <div id="info">
            <div id="record-box">🏆 RECORD GLOBALE: <span id="valore-record">0</span> PUNTI</div>
            <div style="text-align:center; font-weight:bold; margin-bottom:12px; color:#888; font-size: 14px;">TOCCA PER SALTARE / RESPRAWN IMMEDIATO</div>
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
            let datiLocali = { giocatori: {}, bot: { attivo: false, vivo: false, y: 250, score: 0, color: "#ffff33", numero: 0 }, tuboX: 600, tuboBucoY: 200, recordAssoluto: 0 };

            ws.onmessage = (event) => {
                let msg = JSON.parse(event.data);
                if (msg.type === "welcome") mioId = msg.yourId;
                if (msg.type === "update") { datiLocali = msg.data; recordValEl.innerText = datiLocali.recordAssoluto; aggiornaClassifica(); }
            };

            document.addEventListener("touchstart", (e) => { e.preventDefault(); ws.send(JSON.stringify({ type: "jump" })); }, { passive: false });

            function aggiornaClassifica() {
                let html = "";
                let lista = Object.keys(datiLocali.giocatori).map(id => {
                    let p = datiLocali.giocatori[id];
                    let nome = id === mioId ? "Tu (Giocatore " + p.numero + ")" : "Giocatore " + p.numero;
                    return { name: nome, score: p.score, color: p.color, vivo: p.vivo };
                });
                if (datiLocali.bot.attivo) {
                    let statoText = datiLocali.bot.vivo ? " (IA)" : " (IA) [ELIMINATO]";
                    lista.push({ name: "Giocatore " + datiLocali.bot.numero + statoText, score: datiLocali.bot.score, color: datiLocali.bot.color, vivo: datiLocali.bot.vivo });
                }
                lista.sort((a, b) => b.score - a.score);
                lista.forEach(item => {
                    let stileMorte = item.vivo ? "" : "opacity: 0.3; text-decoration: line-through; filter: grayscale(50%);";
                    html += \`<div class="classifica-item" style="background: \${item.color}; color: #111; \${stileMorte}">
                        <span>\${item.name}</span>
                        <span>\${item.score} Pts</span>
                    </div>\`;
                });
                leaderboardEl.innerHTML = html;
            }

            function drawPlayer3D(x, y, vy, color, vivo) {
                ctx.save();
                ctx.translate(x, y);
                
                let angolo = Math.min(Math.max(vy * 0.06, -0.4), 0.7);
                ctx.rotate(angolo);

                ctx.shadowColor = "rgba(0,0,0,0.3)";
                ctx.shadowBlur = 8;
                ctx.shadowOffsetY = 4;

                let grad = ctx.createRadialGradient(-4, -4, 2, 0, 0, 15);
                grad.addColorStop(0, '#ffffff');
                grad.addColorStop(0.2, color);
                grad.addColorStop(1, '#111');
                
                ctx.fillStyle = vivo ? grad : "#777777";
                ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
                
                ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

                ctx.fillStyle = "#fff";
                ctx.beginPath(); ctx.arc(7, -4, 5, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = "#000";
                ctx.beginPath(); ctx.arc(8, -4, 2, 0, Math.PI * 2); ctx.fill();

                ctx.fillStyle = "#ff7700";
                ctx.beginPath(); ctx.moveTo(13, -2); ctx.lineTo(22, 2); ctx.lineTo(13, 6);
                ctx.closePath(); ctx.fill();

                ctx.restore();
            }

            function draw() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                let tx = datiLocali.tuboX;
                let bY = datiLocali.tuboBucoY;
                
                let gradTuboSup = ctx.createLinearGradient(tx, 0, tx + 60, 0);
                gradTuboSup.addColorStop(0, '#53a318'); gradTuboSup.addColorStop(0.3, '#73bf2e');
                gradTuboSup.addColorStop(0.7, '#92e043'); gradTuboSup.addColorStop(1, '#2c610b');
                
                ctx.fillStyle = gradTuboSup;
                ctx.fillRect(tx, 0, 60, bY - 65);
                ctx.fillRect(tx - 4, bY - 80, 68, 15);

                let gradTuboInf = ctx.createLinearGradient(tx, 0, tx + 60, 0);
                gradTuboInf.addColorStop(0, '#53a318'); gradTuboInf.addColorStop(0.3, '#73bf2e');
                gradTuboInf.addColorStop(0.7, '#92e043'); gradTuboInf.addColorStop(1, '#2c610b');
                
                ctx.fillStyle = gradTuboInf;
                ctx.fillRect(tx, bY + 65, 60, canvas.height - (bY + 65));
                ctx.fillRect(tx - 4, bY + 65, 68, 15);

                Object.keys(datiLocali.giocatori).forEach(id => {
                    let p = datiLocali.giocatori[id];
                    drawPlayer3D(100, p.y, p.vy, p.color, p.vivo);
                });

                if (datiLocali.bot.attivo && datiLocali.bot.vivo) {
                    drawPlayer3D(100, datiLocali.bot.y, datiLocali.bot.vy, datiLocali.bot.color, datiLocali.bot.vivo);
                }

                requestAnimationFrame(draw);
            }
            draw();
        </script>
    </body>
    </html>
    `);
});

// DISCORD SYSTEM
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
            contatoreGiocatori++;
            stanza.bot.numero = contatoreGiocatori;
            
            stanza.bot.attivo = true;
            stanza.bot.vivo = true;
            stanza.bot.score = 0;
            stanza.bot.y = 250;
            stanza.bot.vy = SALTO;
            stanza.bot.tuboDecisoId = -1;

            message.reply(`Ricevuto! Sto entrando come **Giocatore ${stanza.bot.numero}**! Record da battere: ${stanza.recordAssoluto} 🏆`);
        }, 5000); 
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
