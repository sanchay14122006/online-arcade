document.addEventListener('DOMContentLoaded', () => {
    const appContainer = document.getElementById('app-container');
    let audioContext;

    // --- Sound Engine (Web Audio API) ---
    const soundEngine = {
        init() {
            if (!audioContext) {
                try { audioContext = new (window.AudioContext || window.webkitAudioContext)(); }
                catch (e) { console.error("Web Audio API is not supported in this browser."); }
            }
        },
        play(sound, ...args) {
            if (!audioContext || !this.sounds[sound]) return;
            this.sounds[sound](...args);
        },
        sounds: {
            click: () => { const o = audioContext.createOscillator(), g = audioContext.createGain(); o.connect(g); g.connect(audioContext.destination); o.type = 'sine'; o.frequency.setValueAtTime(800, audioContext.currentTime); g.gain.setValueAtTime(0.15, audioContext.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2); o.start(); o.stop(audioContext.currentTime + 0.2); },
            transition: () => { const o = audioContext.createOscillator(), g = audioContext.createGain(); o.connect(g); g.connect(audioContext.destination); o.type = 'sawtooth'; o.frequency.setValueAtTime(50, audioContext.currentTime); o.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.3); g.gain.setValueAtTime(0.1, audioContext.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3); o.start(); o.stop(audioContext.currentTime + 0.3); },
            lose: () => { const o = audioContext.createOscillator(), g = audioContext.createGain(); o.connect(g); g.connect(audioContext.destination); o.type = 'sawtooth'; o.frequency.setValueAtTime(150, audioContext.currentTime); o.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.8); g.gain.setValueAtTime(0.2, audioContext.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.8); o.start(); o.stop(audioContext.currentTime + 0.8); },
            smallWin: () => { const n = audioContext.currentTime, o = audioContext.createOscillator(), g = audioContext.createGain(); o.connect(g); g.connect(audioContext.destination); o.type = 'sine'; o.frequency.setValueAtTime(880, n); g.gain.setValueAtTime(0.2, n); g.gain.exponentialRampToValueAtTime(0.001, n + 0.3); o.start(n); o.stop(n + 0.3); },
            mediumWin: () => { const n = audioContext.currentTime, f = 440, s = [0, 4, 7]; for (let i = 0; i < 3; i++) { const o = audioContext.createOscillator(), g = audioContext.createGain(); o.connect(g); g.connect(audioContext.destination); o.type = 'triangle'; const fr = f * Math.pow(2, s[i] / 12); o.frequency.setValueAtTime(fr, n + i * 0.1); g.gain.setValueAtTime(0.2, n + i * 0.1); g.gain.exponentialRampToValueAtTime(0.001, n + i * 0.1 + 0.2); o.start(n + i * 0.1); o.stop(n + i * 0.1 + 0.2); } },
            bigWin: () => { const n = audioContext.currentTime, f = 261.63, s = [0, 4, 7, 12]; for (let i = 0; i < 16; i++) { const o = audioContext.createOscillator(), g = audioContext.createGain(); o.connect(g); g.connect(audioContext.destination); o.type = 'sine'; const fr = f * Math.pow(2, s[i % s.length] / 12); o.frequency.setValueAtTime(fr, n + i * 0.08); g.gain.setValueAtTime(0.2, n + i * 0.08); g.gain.exponentialRampToValueAtTime(0.001, n + i * 0.08 + 0.15); o.start(n + i * 0.08); o.stop(n + i * 0.08 + 0.15); } },
            reelSpin: (d) => { const g = audioContext.createGain(); g.connect(audioContext.destination); const o = audioContext.createOscillator(); o.connect(g); o.type = 'sawtooth'; g.gain.setValueAtTime(0.1, audioContext.currentTime); o.frequency.setValueAtTime(1200, audioContext.currentTime); o.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + d); g.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + d); o.start(); o.stop(audioContext.currentTime + d); },
            reelStop: () => { const o = audioContext.createOscillator(), g = audioContext.createGain(); o.connect(g); g.connect(audioContext.destination); o.type = 'sine'; g.gain.setValueAtTime(0.4, audioContext.currentTime); o.frequency.setValueAtTime(150, audioContext.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15); o.start(); o.stop(audioContext.currentTime + 0.15); },
            rouletteSpinning: (d) => { const g = audioContext.createGain(); g.connect(audioContext.destination); g.gain.setValueAtTime(0.3, audioContext.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + d); const i = setInterval(() => { const o = audioContext.createOscillator(); o.connect(g); o.type = 'sawtooth'; o.frequency.value = 600 * (1 - (audioContext.currentTime - g.context.currentTime) / d) + (Math.random() * 100 - 50); o.start(); o.stop(audioContext.currentTime + 0.05); }, 80); setTimeout(() => clearInterval(i), d * 1000); }
        }
    };

    const state = { currentPlayer: { username: null, balance: 0 }, activeScreen: null };

    const api = {
        login: async (u, p) => { const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p }), }); return { ok: r.ok, data: await r.json() }; },
        logout: async () => await fetch('/api/logout', { method: 'POST' }),
        getPlayerData: async () => { const r = await fetch('/api/player'); if (r.ok) { state.currentPlayer = await r.json(); return true; } return false; },
        spinSlotMachine: async (w) => { const r = await fetch('/api/games/slot-machine/spin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wager: w }), }); return { ok: r.ok, data: await r.json() }; },
        spinRoulette: async (b) => { const r = await fetch('/api/games/roulette/spin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bets: b }) }); return { ok: r.ok, data: await r.json() }; },
    };

    const render = (screenId, ...args) => {
        soundEngine.init(); soundEngine.play('transition');
        const currentScreen = appContainer.querySelector('.screen.active');
        if (currentScreen && currentScreen.cleanup) currentScreen.cleanup();
        if (currentScreen) { currentScreen.classList.add('exiting'); currentScreen.classList.remove('active'); setTimeout(() => currentScreen.remove(), 700); }
        const newScreen = screenTemplates[screenId](...args);
        newScreen.classList.add('screen', 'entering');
        appContainer.appendChild(newScreen);
        void newScreen.offsetWidth;
        setTimeout(() => { newScreen.classList.remove('entering'); newScreen.classList.add('active'); }, 10);
        state.activeScreen = screenId;
    };

    const createHeader = () => {
        const header = document.createElement('header');
        header.className = 'main-header';
        header.innerHTML = `<div class="player-info"><span id="player-username">Welcome, ${state.currentPlayer.username}</span><span>Tokens: <span id="player-balance">${Math.floor(state.currentPlayer.balance)}</span></span></div><button id="logout-btn" class="btn-glow">Logout</button>`;
        header.querySelector('#logout-btn').addEventListener('click', async () => { soundEngine.play('click'); await api.logout(); render('login'); });
        return header;
    };

    const updateHeader = (newBalance) => {
        if (typeof newBalance !== 'number') return;
        state.currentPlayer.balance = newBalance;
        const balanceEl = document.getElementById('player-balance');
        if (balanceEl) balanceEl.textContent = Math.floor(newBalance);
    };

    const playWinSound = (prize, wager) => {
        if (prize <= 0) { soundEngine.play('lose'); return; }
        const ratio = prize / wager;
        if (ratio >= 10) soundEngine.play('bigWin');
        else if (ratio >= 3) soundEngine.play('mediumWin');
        else soundEngine.play('smallWin');
    };

    const showGameMessage = (message, prize, wager, parent) => {
        const messageEl = document.createElement('div');
        messageEl.className = 'game-message'; messageEl.textContent = message;
        const isWin = prize > 0;
        messageEl.style.color = isWin ? 'var(--accent-gold)' : 'var(--accent-crimson)';
        parent.appendChild(messageEl);
        setTimeout(() => {
            messageEl.classList.add('show');
            playWinSound(prize, wager);
        }, 10);
        setTimeout(() => { messageEl.classList.remove('show'); setTimeout(() => messageEl.remove(), 500); }, 4000);
    };

    const createRulesModal = (game) => {
        const rules = {
            'slot-machine': { title: 'Golden Sevens Rules', content: `<p>The goal is to match symbols on the center line.</p><ul><li><strong>2 Matching Symbols (on reels 1 & 2, or 2 & 3):</strong> Prize equals your wager multiplied by the symbol's value.</li><li><strong>3 Matching Symbols:</strong> Prize equals your wager multiplied by the symbol's value, then multiplied by 3 for the jackpot!</li></ul><p><strong>Symbol Values (Multiplier):</strong></p><ul><li>🍒: 1x</li><li>🍋: 2x</li><li>🍊: 3x</li><li>🍉: 4x</li><li>⭐: 5x</li><li>💎: 6x</li><li>💰: 7x</li></ul>` },
            'roulette': { title: 'Royal Roulette Rules', content: `<p>The objective is to predict which numbered pocket the wheel will land on. You place bets on the table to make your predictions.</p><p><strong>Inside Bets (on the numbers):</strong></p><ul><li><strong>Straight Up (1 number):</strong> Bet on a single number. Pays 35 to 1.</li><li><strong>Split (2 numbers):</strong> Bet on the line between two numbers. Pays 17 to 1.</li><li><strong>Corner (4 numbers):</strong> Bet on the corner where four numbers meet. Pays 8 to 1.</li></ul><p><strong>Outside Bets (grouped bets):</strong></p><ul><li><strong>Dozens (1st 12, etc.):</strong> Bet on a group of 12 numbers. Pays 2 to 1.</li><li><strong>Columns (vertical lines):</strong> Bet on a full column of 12 numbers. Pays 2 to 1.</li><li><strong>Red/Black:</strong> Bet on the winning color. Pays 1 to 1.</li><li><strong>Even/Odd:</strong> Bet on whether the number is even or odd. Pays 1 to 1.</li><li><strong>Low (1-18) / High (19-36):</strong> Bet on a high or low number range. Pays 1 to 1.</li></ul><p>Note: If the wheel lands on 0, all outside bets lose.</p>` }
        };
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = `<div class="modal-content"><h3>${rules[game].title}</h3><div>${rules[game].content}</div><button class="btn-glow modal-close-btn">Close</button></div>`;
        modal.querySelector('.modal-close-btn').addEventListener('click', () => modal.classList.remove('show'));
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('show'); });
        return modal;
    };

    const screenTemplates = {
        login: () => {
            const screen = document.createElement('div'); screen.id = 'login-screen';
            screen.innerHTML = `<h1 class="login-title">GRAND ARCADE</h1><form class="login-form" id="login-form"><div class="input-group"><label for="username">Username</label><input type="text" id="username" name="username" required autocomplete="username"></div><div class="input-group"><label for="password">Password</label><input type="password" id="password" name="password" required autocomplete="current-password"></div><p id="login-error"></p><button type="submit" class="btn-glow">Enter</button></form>`;
            screen.querySelector('#login-form').addEventListener('submit', async (e) => {
                e.preventDefault(); soundEngine.play('click');
                const username = e.target.username.value, password = e.target.password.value;
                const result = await api.login(username, password);
                const errorEl = screen.querySelector('#login-error');
                if (result.ok) { errorEl.textContent = ''; if (result.data.isAdmin) { window.location.href = '/admin/panel'; } else { await api.getPlayerData(); render('lobby'); } }
                else { errorEl.textContent = result.data.message; }
            });
            return screen;
        },
        lobby: () => {
            const screen = document.createElement('div'); screen.id = 'lobby-screen';
            screen.appendChild(createHeader());
            const games = [
                { id: 'slot-machine', name: 'Golden Sevens', icon: '🎰', desc: 'Classic slot action with a modern twist.' },
                { id: 'roulette', name: 'Royal Roulette', icon: '🎡', desc: 'Place your bets on the iconic wheel.' }
            ];
            const grid = document.createElement('div'); grid.className = 'lobby-grid';
            games.forEach(game => { const card = document.createElement('div'); card.className = 'game-card'; card.innerHTML = `<div class="icon">${game.icon}</div><h3>${game.name}</h3><p>${game.desc}</p>`; card.addEventListener('click', () => { soundEngine.play('click'); render(game.id); }); grid.appendChild(card); });
            screen.appendChild(grid);
            return screen;
        },
        'slot-machine': () => {
            const screen = document.createElement('div'); screen.className = 'game-screen';
            screen.appendChild(createHeader());
            const gameContainer = document.createElement('div'); gameContainer.className = 'game-container';
            gameContainer.innerHTML = `<div id="slot-machine-container"><div id="slot-machine"><div class="reel"><div class="reel-symbols"></div></div><div class="reel"><div class="reel-symbols"></div></div><div class="reel"><div class="reel-symbols"></div></div></div><div id="win-line"></div></div>`;
            const controls = document.createElement('div'); controls.className = 'game-controls';
            controls.innerHTML = `<button id="back-to-lobby-btn" class="btn-glow">Lobby</button><div class="input-group"><label for="slot-wager">Wager:</label><input type="number" id="slot-wager" value="10" min="1" step="1"></div><button id="spin-btn" class="btn-glow">Spin</button><button class="rules-btn">How to Play</button>`;
            screen.appendChild(gameContainer); screen.appendChild(controls);
            const modal = createRulesModal('slot-machine'); screen.appendChild(modal);
            controls.querySelector('.rules-btn').addEventListener('click', () => modal.classList.add('show'));
            controls.querySelector('#back-to-lobby-btn').addEventListener('click', () => render('lobby'));
            const slotMachineContainer = screen.querySelector('#slot-machine-container');
            const reels = screen.querySelectorAll('.reel-symbols'); const spinBtn = screen.querySelector('#spin-btn'); const winLine = screen.querySelector('#win-line');
            const symbols = ['🍒', '🍋', '🍊', '🍉', '⭐', '💎', '💰']; let isSpinning = false;
            reels.forEach(reel => { const f = document.createDocumentFragment(), e = [...symbols, ...symbols, ...symbols, ...symbols]; e.forEach(s => { const span = document.createElement('span'); span.textContent = s; f.appendChild(span); }); reel.appendChild(f); });
            const spin = async () => {
                if (isSpinning) return;
                isSpinning = true; spinBtn.disabled = true; winLine.classList.remove('show'); soundEngine.play('click');
                const wager = parseInt(document.getElementById('slot-wager').value, 10);
                const result = await api.spinSlotMachine(wager);
                if (!result.ok) { showGameMessage(result.data.message, 0, wager, gameContainer); isSpinning = false; spinBtn.disabled = false; return; }
                updateHeader(state.currentPlayer.balance - wager); soundEngine.play('reelSpin', 3);
                await Promise.all(Array.from(reels).map(async (reel, i) => {
                    reel.style.transition = 'none'; reel.style.top = '0px'; void reel.offsetWidth;
                    const finalSymbol = result.data.results[i], finalIndex = symbols.indexOf(finalSymbol);
                    const symbolHeight = reel.querySelector('span').offsetHeight, targetPosition = -(finalIndex + symbols.length * 3) * symbolHeight;
                    await new Promise(r => setTimeout(r, i * 200));
                    reel.style.transition = `top ${3 + i * 0.5}s cubic-bezier(0.33, 1, 0.68, 1)`;
                    reel.style.top = `${targetPosition}px`;
                }));
                await new Promise(r => setTimeout(r, 3800));
                reels.forEach((_, i) => setTimeout(() => soundEngine.play('reelStop'), i * 200));
                if (result.data.prize > 0) {
                    winLine.classList.add('show');
                    showGameMessage(`You Won ${Math.floor(result.data.prize)} Tokens!`, result.data.prize, wager, gameContainer);
                    slotMachineContainer.classList.add('payout-glow');
                    for (let i = 0; i < 30; i++) {
                        setTimeout(() => {
                            const particle = document.createElement('div');
                            particle.className = 'payout-particle';
                            particle.style.left = `${Math.random() * 100}%`;
                            particle.style.animationDuration = `${Math.random() * 0.5 + 0.5}s`;
                            gameContainer.appendChild(particle);
                            setTimeout(() => particle.remove(), 1000);
                        }, i * 50);
                    }
                    setTimeout(() => slotMachineContainer.classList.remove('payout-glow'), 3000);
                }
                else { showGameMessage('Try Again!', 0, wager, gameContainer); }
                updateHeader(result.data.newBalance);
                isSpinning = false; spinBtn.disabled = false;
            };
            spinBtn.addEventListener('click', spin);
            return screen;
        },
        'roulette': () => {
            const screen = document.createElement('div'); screen.className = 'game-screen';
            screen.appendChild(createHeader());
            const gameContainer = document.createElement('div'); gameContainer.className = 'game-container';
            gameContainer.innerHTML = `<div id="roulette-container"><div id="roulette-wheel-container"><canvas id="roulette-canvas" width="450" height="450"></canvas></div><div class="roulette-table"></div></div><div id="bet-helper"></div>`;
            const controls = document.createElement('div'); controls.className = 'game-controls';
            controls.innerHTML = `<button id="back-to-lobby-btn" class="btn-glow">Lobby</button><div class="input-group"><label>Bet Amount:</label><input type="number" id="roulette-wager" value="5" min="1"></div> <button id="spin-wheel-btn" class="btn-glow">Spin</button><button id="clear-bets-btn" class="btn-glow">Clear Bets</button><button class="rules-btn">How to Play</button>`;
            screen.appendChild(gameContainer); screen.appendChild(controls);
            const modal = createRulesModal('roulette'); screen.appendChild(modal);
            controls.querySelector('.rules-btn').addEventListener('click', () => modal.classList.add('show'));
            controls.querySelector('#back-to-lobby-btn').addEventListener('click', () => render('lobby'));
            const canvas = screen.querySelector('#roulette-canvas'), tableEl = screen.querySelector('.roulette-table'), helperEl = screen.querySelector('#bet-helper');
            const spinBtn = screen.querySelector('#spin-wheel-btn'), clearBtn = screen.querySelector('#clear-bets-btn');
            const wagerInput = screen.querySelector('#roulette-wager'), ctx = canvas.getContext('2d');
            const numbers = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
            const numberIsRed = (n) => [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(n);
            const segmentAngle = 2 * Math.PI / numbers.length; let currentAngle = 0, bets = {}, isSpinning = false;

            const drawWheel = (rot = 0) => {
                const cX = 225, cY = 225, rad = 210; ctx.clearRect(0, 0, 450, 450);
                const woodGrad = ctx.createRadialGradient(cX, cY, rad - 20, cX, cY, rad + 15);
                woodGrad.addColorStop(0, '#855E42'); woodGrad.addColorStop(0.8, '#5D4037'); woodGrad.addColorStop(1, '#3E2723');
                ctx.fillStyle = woodGrad; ctx.beginPath(); ctx.arc(cX, cY, rad + 15, 0, Math.PI * 2); ctx.fill();
                for (let i = 0; i < numbers.length; i++) { const sA = i * segmentAngle + rot, eA = sA + segmentAngle; ctx.beginPath(); ctx.moveTo(cX, cY); ctx.arc(cX, cY, rad, sA, eA); ctx.closePath(); ctx.fillStyle = numbers[i] === 0 ? '#006000' : numberIsRed(numbers[i]) ? '#990000' : '#111'; ctx.fill(); }
                ctx.strokeStyle = '#D4AF37'; ctx.lineWidth = 2.5;
                for (let i = 0; i < numbers.length; i++) { const angle = i * segmentAngle + rot; ctx.beginPath(); ctx.moveTo(cX + Math.cos(angle) * rad * 0.85, cY + Math.sin(angle) * rad * 0.85); ctx.lineTo(cX + Math.cos(angle) * rad, cY + Math.sin(angle) * rad); ctx.stroke(); }
                const shadowGrad = ctx.createRadialGradient(cX, cY, rad - 20, cX, cY, rad);
                shadowGrad.addColorStop(0, 'transparent'); shadowGrad.addColorStop(1, 'rgba(0,0,0,0.4)');
                ctx.fillStyle = shadowGrad; ctx.beginPath(); ctx.arc(cX, cY, rad, 0, Math.PI * 2); ctx.fill();
                const turretGrad = ctx.createRadialGradient(cX, cY, 5, cX, cY, rad * 0.25);
                turretGrad.addColorStop(0, '#FFFDE4'); turretGrad.addColorStop(0.5, '#D4AF37'); turretGrad.addColorStop(1, '#a07c2c');
                ctx.fillStyle = turretGrad; ctx.beginPath(); ctx.arc(cX, cY, rad * 0.25, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.stroke();
                for (let i = 0; i < numbers.length; i++) { const a = i * segmentAngle + segmentAngle / 2 + rot; ctx.save(); ctx.translate(cX, cY); ctx.rotate(a); ctx.textAlign = 'right'; ctx.fillStyle = 'white'; ctx.font = 'bold 18px "Georgia", serif'; ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 3; ctx.fillText(numbers[i], rad - 15, 6); ctx.restore(); }
                // Static pointer at the top
                ctx.beginPath(); ctx.moveTo(cX - 10, 12); ctx.lineTo(cX + 10, 12); ctx.lineTo(cX, 28); ctx.closePath();
                const pointerGrad = ctx.createLinearGradient(cX, 12, cX, 28); pointerGrad.addColorStop(0, '#FFFDE4'); pointerGrad.addColorStop(1, '#D4AF37');
                ctx.fillStyle = pointerGrad; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.stroke();
            };

            const createBettingTable = () => {
                tableEl.innerHTML = '';
                const mainGrid = document.createElement('div'); mainGrid.className = 'main-grid';
                const zero = document.createElement('div'); zero.className = 'bet-spot zero'; zero.textContent = '0'; zero.dataset.betType = 'number'; zero.dataset.betValue = '0'; mainGrid.appendChild(zero);
                for (let i = 1; i <= 36; i++) {
                    const s = document.createElement('div');
                    s.className = `bet-spot n${i}`;
                    s.classList.add(numberIsRed(i) ? 'red' : 'black');
                    s.textContent = i; s.dataset.betType = 'number';
                    s.dataset.betValue = i;
                    const row = 3 - ((i - 1) % 3);
                    const col = Math.floor((i - 1) / 3) + 2;
                    s.style.gridRow = `${row} / span 1`;
                    s.style.gridColumn = `${col} / span 1`;
                    mainGrid.appendChild(s);
                }
                ['2-1', '2-1', '2-1'].forEach((t, i) => {
                    const c = document.createElement('div');
                    c.className = 'bet-spot column-bet';
                    c.textContent = t; c.dataset.betType = 'column';
                    c.dataset.betValue = 3 - i;
                    c.style.gridRow = `${i + 1} / span 1`;
                    c.style.gridColumn = `14 / span 1`;
                    mainGrid.appendChild(c);
                });
                const outside = document.createElement('div'); outside.className = 'outside-bets-container';
                const betsData = [{ t: '1st 12', bt: 'dozen', v: 1 }, { t: '2nd 12', bt: 'dozen', v: 2 }, { t: '3rd 12', bt: 'dozen', v: 3 }, { t: '1-18', bt: 'low' }, { t: 'EVEN', bt: 'even' }, { t: 'RED', bt: 'red', cl: 'red' }, { t: 'BLACK', bt: 'black', cl: 'black' }, { t: 'ODD', bt: 'odd' }, { t: '19-36', bt: 'high' }];
                betsData.forEach(b => { const s = document.createElement('div'); s.className = 'bet-spot'; if (b.cl) s.classList.add(b.cl); s.textContent = b.t; s.dataset.betType = b.bt; if (b.v) s.dataset.betValue = b.v; outside.appendChild(s); });
                tableEl.appendChild(mainGrid); tableEl.appendChild(outside);
                tableEl.addEventListener('click', placeBet);
            };

            const placeBet = (e) => {
                if (isSpinning || !e.target.classList.contains('bet-spot')) return;
                const spot = e.target; const wager = parseInt(wagerInput.value, 10);
                if (wager <= 0 || state.currentPlayer.balance < wager) { showGameMessage("Not enough tokens or invalid wager", 0, 1, gameContainer); return; }
                const betType = spot.dataset.betType, betValue = spot.dataset.betValue || '';
                if (!bets[betType]) bets[betType] = [];
                bets[betType].push({ value: betValue, amount: wager, element: spot });
                const chip = document.createElement('div'); chip.className = 'bet-chip player-chip'; chip.textContent = wager;
                const rect = spot.getBoundingClientRect(); chip.style.left = `${e.clientX - rect.left}px`; chip.style.top = `${e.clientY - rect.top}px`; spot.appendChild(chip);
                updateHeader(state.currentPlayer.balance - wager); soundEngine.play('click');
            };
            const clearBets = () => { if (isSpinning) return; api.getPlayerData().then(ok => { if (ok) updateHeader(state.currentPlayer.balance); }); bets = {}; tableEl.querySelectorAll('.bet-chip').forEach(c => c.remove()); };

            const spin = async () => {
                const totalWager = Object.values(bets).flat().reduce((s, b) => s + b.amount, 0);
                if (isSpinning || totalWager === 0) return;
                isSpinning = true; spinBtn.disabled = true; clearBtn.disabled = true;
                const result = await api.spinRoulette(bets);
                if (!result.ok) { showGameMessage(result.data.message, 0, totalWager, gameContainer); isSpinning = false; spinBtn.disabled = false; clearBtn.disabled = false; clearBets(); return; }
                const { winningNumber, prize, newBalance } = result.data;
                const winIndex = numbers.indexOf(winningNumber);

                const targetPointerAngle = 3 * Math.PI / 2; // Pointer is at the top
                const winningSegmentCenterAngle = winIndex * segmentAngle + segmentAngle / 2;
                const finalAngle = targetPointerAngle - winningSegmentCenterAngle;

                const spins = 8 * 2 * Math.PI, duration = 8000;
                let startTime = null;

                soundEngine.play('rouletteSpinning', duration / 1000);

                const animate = (t) => {
                    if (!startTime) startTime = t;
                    const elapsed = t - startTime;

                    const wheelProgress = Math.min(elapsed / duration, 1), wheelEaseOut = 1 - Math.pow(1 - wheelProgress, 4);
                    const wheelAngle = currentAngle + (finalAngle + spins - currentAngle) * wheelEaseOut;

                    drawWheel(wheelAngle);

                    if (elapsed < duration) {
                        requestAnimationFrame(animate);
                    } else {
                        currentAngle = finalAngle % (2 * Math.PI);
                        drawWheel(currentAngle);
                        isSpinning = false; spinBtn.disabled = false; clearBtn.disabled = false;
                        setTimeout(() => {
                            const winningSpot = tableEl.querySelector(`.bet-spot[data-bet-value="${winningNumber}"]`);
                            if (winningSpot) {
                                winningSpot.classList.add('winner-highlight');
                                setTimeout(() => winningSpot.classList.remove('winner-highlight'), 4000);
                            }
                            showGameMessage(prize > 0 ? `Winner: ${winningNumber}! You won ${Math.floor(prize)} Tokens!` : `Winner: ${winningNumber}. No win.`, prize, totalWager, gameContainer);
                            updateHeader(newBalance);
                            clearBets();
                        }, 50);
                    }
                };
                requestAnimationFrame(animate);
            };

            spinBtn.addEventListener('click', spin);
            clearBtn.addEventListener('click', clearBets);
            drawWheel();
            createBettingTable();

            tableEl.addEventListener('mouseover', e => {
                if (e.target.classList.contains('bet-spot')) {
                    const type = e.target.dataset.betType;
                    const payouts = { number: '35:1', red: '1:1', black: '1:1', even: '1:1', odd: '1:1', low: '1:1', high: '1:1', dozen: '2:1', column: '2:1' };
                    helperEl.textContent = `${type.charAt(0).toUpperCase() + type.slice(1)} Bet (Pays ${payouts[type]})`;
                    helperEl.style.opacity = '1';
                }
            });
            tableEl.addEventListener('mouseout', () => helperEl.style.opacity = '0');

            return screen;
        },
    };

    const init = async () => { const loggedIn = await api.getPlayerData(); if (loggedIn) { render('lobby'); } else { render('login'); } };
    init();
});

