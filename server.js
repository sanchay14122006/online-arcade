require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session); // For persistent sessions
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs'); // Still needed to read the certificate file

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware Setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- DATABASE AND SESSION STORE SETUP (SIMPLIFIED & FIXED) ---

// 1. Aiven's URL includes an ssl-mode parameter that mysql2 warns about. We handle SSL through the ssl object, so we can remove it from the string.
const connectionUri = process.env.DATABASE_URL.replace("?ssl-mode=REQUIRED", "");

// 2. Create the Database Pool using the cleaned connection string AND the SSL certificate
const dbPool = mysql.createPool({
    uri: connectionUri, // Use the cleaned connection string
    ssl: {
        ca: fs.readFileSync(path.join(__dirname, 'ca.pem')) // And add the certificate
    },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// 3. Create a session store connected to the database
const sessionStore = new MySQLStore({}, dbPool);

// 4. Use the new session store in the session middleware
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: sessionStore, // Use the new persistent store
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));


// --- STATIC FILE SERVING ---
app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', (req, res, next) => {
    if (req.session && req.session.userId && req.session.isAdmin) {
        return express.static(path.join(__dirname, 'admin'))(req, res, next);
    }
    return res.redirect('/');
});


// --- MIDDLEWARE ---
const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        next();
    } else {
        res.status(401).json({ message: 'Not authenticated' });
    }
};

const isNotBanned = async (req, res, next) => {
    if (!req.session.userId) return next();
    try {
        const [rows] = await dbPool.query('SELECT is_banned FROM players WHERE id = ?', [req.session.userId]);
        if (rows.length > 0 && rows[0].is_banned) {
            return res.status(403).json({ message: 'This account has been banned.' });
        }
        next();
    } catch (error) {
        res.status(500).json({ message: 'Server error checking ban status.' });
    }
};

const isAdmin = (req, res, next) => {
    if (req.session && req.session.userId && req.session.isAdmin) {
        return next();
    }
    res.status(403).json({ message: 'Forbidden: Admins only' });
};


// --- AUTH ROUTES ---
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await dbPool.query('SELECT * FROM players WHERE username = ?', [username]);
        if (rows.length === 0) return res.status(401).json({ message: 'Invalid credentials' });
        
        const player = rows[0];
        if (player.is_banned) return res.status(403).json({ message: 'This account has been banned.' });

        const match = await bcrypt.compare(password, player.password);
        if (match) {
            req.session.userId = player.id;
            req.session.username = player.username;
            req.session.isAdmin = player.is_admin;
            res.json({ message: 'Login successful', isAdmin: player.is_admin });
        } else {
            res.status(401).json({ message: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).json({ message: 'Could not log out.' });
        res.clearCookie('connect.sid');
        res.json({ message: 'Logout successful' });
    });
});


// --- PLAYER API ---
app.get('/api/player', isAuthenticated, async (req, res) => {
    try {
        const [rows] = await dbPool.query('SELECT username, balance FROM players WHERE id = ?', [req.session.userId]);
        if (rows.length > 0) res.json(rows[0]);
        else res.status(404).json({ message: 'Player not found' });
    } catch (error) {
        console.error('Get player error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


// --- GAME LOGIC & ODDS (SERVER-SIDE) ---
async function processPlay(playerId, gameName, wager, prize) {
    const connection = await dbPool.getConnection();
    try {
        await connection.beginTransaction();
        const [playerRows] = await connection.query('SELECT balance FROM players WHERE id = ? FOR UPDATE', [playerId]);
        const currentBalance = playerRows[0].balance;
        
        if (currentBalance < wager) {
            await connection.rollback();
            return { success: false, message: "Insufficient Arcade Tokens" };
        }
        
        const newBalance = currentBalance - wager + prize;
        await connection.query('UPDATE players SET balance = ? WHERE id = ?', [newBalance, playerId]);
        await connection.query('INSERT INTO transactions (player_id, game, amount_wagered, outcome_amount) VALUES (?, ?, ?, ?)', [playerId, gameName, wager, prize]);
        
        await connection.commit();
        return { success: true, newBalance };
    } catch (error) {
        await connection.rollback();
        console.error(`Error in ${gameName} play:`, error);
        return { success: false, message: 'Server error during game play' };
    } finally {
        connection.release();
    }
}

app.post('/api/games/slot-machine/spin', isAuthenticated, isNotBanned, async (req, res) => {
    const wager = parseInt(req.body.wager, 10);
    if (isNaN(wager) || wager <= 0) return res.status(400).json({ message: 'Invalid wager' });
    
    const virtualReel = [ '🍒', '🍒', '🍒', '🍒', '🍒', '🍒', '🍒', '🍒', '🍒', '🍒', '🍋', '🍋', '🍋', '🍋', '🍋', '🍋', '🍋', '🍋', '🍊', '🍊', '🍊', '🍊', '🍊', '🍊', '🍉', '🍉', '🍉', '🍉', '⭐', '⭐', '⭐', '💎', '💎', '💰' ];
    const results = [ virtualReel[Math.floor(Math.random() * virtualReel.length)], virtualReel[Math.floor(Math.random() * virtualReel.length)], virtualReel[Math.floor(Math.random() * virtualReel.length)] ];
    const symbols = ['🍒', '🍋', '🍊', '🍉', '⭐', '💎', '💰'];
    let prize = 0;
    if (results[0] === results[1] && results[1] === results[2]) {
        prize = wager * (symbols.indexOf(results[0]) + 1) * 10;
    } else if (results[0] === results[1]) {
        prize = wager * (symbols.indexOf(results[0]) + 1) * 0.5;
    }
    
    const result = await processPlay(req.session.userId, 'slot-machine', wager, prize);
    if (result.success) { res.json({ results, prize, newBalance: result.newBalance }); }
    else { res.status(400).json({ message: result.message }); }
});

app.post('/api/games/roulette/spin', isAuthenticated, isNotBanned, async(req, res) => {
    const { bets } = req.body;
    let totalWager = 0;
    try {
        totalWager = Object.values(bets).flat().reduce((sum, bet) => sum + bet.amount, 0);
    } catch(e) { return res.status(400).json({message: "Invalid bets format"}); }

    if (totalWager <= 0) return res.status(400).json({message: "No bets placed"});

    const numbers = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
    const winningNumber = numbers[Math.floor(Math.random() * numbers.length)];
    const numberIsRed = (n) => [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(n);
    let prize = 0;

    Object.keys(bets).forEach(betType => {
        bets[betType].forEach(bet => {
            if (betType === 'number' && parseInt(bet.value) === winningNumber) prize += bet.amount * 36;
            if (betType === 'red' && winningNumber !== 0 && numberIsRed(winningNumber)) prize += bet.amount * 2;
            if (betType === 'black' && winningNumber !== 0 && !numberIsRed(winningNumber)) prize += bet.amount * 2;
            if (betType === 'even' && winningNumber !== 0 && winningNumber % 2 === 0) prize += bet.amount * 2;
            if (betType === 'odd' && winningNumber !== 0 && winningNumber % 2 !== 0) prize += bet.amount * 2;
            if (betType === 'low' && winningNumber >= 1 && winningNumber <= 18) prize += bet.amount * 2;
            if (betType === 'high' && winningNumber >= 19 && winningNumber <= 36) prize += bet.amount * 2;
            if (betType === 'dozen') {
                if (bet.value == 1 && winningNumber >= 1 && winningNumber <= 12) prize += bet.amount * 3;
                if (bet.value == 2 && winningNumber >= 13 && winningNumber <= 24) prize += bet.amount * 3;
                if (bet.value == 3 && winningNumber >= 25 && winningNumber <= 36) prize += bet.amount * 3;
            }
            if (betType === 'column') {
                const col1 = [1,4,7,10,13,16,19,22,25,28,31,34], col2 = [2,5,8,11,14,17,20,23,26,29,32,35], col3 = [3,6,9,12,15,18,21,24,27,30,33,36];
                if (bet.value == 1 && col1.includes(winningNumber)) prize += bet.amount * 3;
                if (bet.value == 2 && col2.includes(winningNumber)) prize += bet.amount * 3;
                if (bet.value == 3 && col3.includes(winningNumber)) prize += bet.amount * 3;
            }
        });
    });

    const result = await processPlay(req.session.userId, 'roulette', totalWager, prize);
    if (result.success) { res.json({ winningNumber, prize, newBalance: result.newBalance }); }
    else { res.status(400).json({ message: result.message }); }
});


// --- ADMIN PANEL API ROUTES ---
app.get('/api/admin/players', isAdmin, async (req, res) => {
    try {
        const [rows] = await dbPool.query('SELECT id, username, balance, is_banned, created_at FROM players WHERE is_admin = false ORDER BY created_at DESC');
        res.json(rows);
    } catch (error) { res.status(500).json({ message: 'Failed to fetch players' }); }
});

app.get('/api/admin/transactions/all', isAdmin, async (req, res) => {
    try {
        const [rows] = await dbPool.query('SELECT * FROM transactions ORDER BY timestamp DESC LIMIT 200');
        res.json(rows);
    } catch (error) { res.status(500).json({ message: 'Failed to fetch transactions' }); }
});


app.get('/api/admin/admin-actions', isAdmin, async (req, res) => {
    try {
        const [rows] = await dbPool.query('SELECT a.*, p.username as admin_username FROM admin_actions a LEFT JOIN players p ON a.admin_id = p.id ORDER BY a.timestamp DESC LIMIT 100');
        res.json(rows);
    } catch (error) { res.status(500).json({ message: 'Failed to fetch admin actions' }); }
});

app.post('/api/admin/players', isAdmin, async (req, res) => {
    const { username, password, balance } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Username and password are required' });
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await dbPool.query('INSERT INTO players (username, password, balance) VALUES (?, ?, ?)', [username, hashedPassword, balance || 0]);
        await dbPool.query('INSERT INTO admin_actions (admin_id, action, target_player_username) VALUES (?, ?, ?)', [req.session.userId, `Created player ${username}`, username]);
        res.status(201).json({ message: 'Player created successfully' });
    } catch (error) { res.status(500).json({ message: 'Error creating player' }); }
});

app.put('/api/admin/players/:id', isAdmin, async (req, res) => {
    const { balance, is_banned, password } = req.body;
    const { id } = req.params;

    try {
        const [playerRows] = await dbPool.query('SELECT username FROM players WHERE id = ?', [id]);
        if (playerRows.length === 0) return res.status(404).json({ message: 'Player not found' });
        const { username } = playerRows[0];
        
        let action = '';
        if (balance !== undefined) {
            await dbPool.query('UPDATE players SET balance = ? WHERE id = ?', [balance, id]);
            action = `Updated balance for ${username} to ${balance}`;
        }
        if (is_banned !== undefined) {
            await dbPool.query('UPDATE players SET is_banned = ? WHERE id = ?', [is_banned, id]);
            action = `${is_banned ? 'Banned' : 'Unbanned'} player ${username}`;
        }
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            await dbPool.query('UPDATE players SET password = ? WHERE id = ?', [hashedPassword, id]);
            action = `Reset password for player ${username}`;
        }
        
        await dbPool.query('INSERT INTO admin_actions (admin_id, action, target_player_username) VALUES (?, ?, ?)', [req.session.userId, action, username]);
        res.json({ message: 'Player updated successfully' });
    } catch (error) { res.status(500).json({ message: 'Error updating player' }); }
});


// Serve the main application for any other GET request
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

