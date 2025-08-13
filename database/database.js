const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const db = new Database('birdhunter.db');

function initializeDatabase() {
    try {
        // Read and execute schema
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        // Split by semicolon and execute each statement
        const statements = schema.split(';').filter(stmt => stmt.trim());
        
        statements.forEach(statement => {
            if (statement.trim()) {
                db.exec(statement + ';');
            }
        });
        
        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Error initializing database:', error);
        throw error;
    }
}

// User operations
const userOps = {
    create: db.prepare(`
        INSERT OR IGNORE INTO users (user_id, username, balance, bank_balance)
        VALUES (?, ?, ?, ?)
    `),
    
    get: db.prepare('SELECT * FROM users WHERE user_id = ?'),
    
    updateBalance: db.prepare(`
        UPDATE users 
        SET balance = ?, bank_balance = ?, last_work = ?, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
    `),
    
    updateProfile: db.prepare(`
        UPDATE users 
        SET username = ?, title = ?, bio = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
    `)
};

// Bird operations
const birdOps = {
    create: db.prepare(`
        INSERT INTO user_birds (user_id, bird_id, custom_name, captured_at, times_observed, bond_level)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, 0, 1)
    `),
    
    getUserBirds: db.prepare(`
        SELECT ub.*, b.* FROM user_birds ub
        JOIN birds b ON ub.bird_id = b.id
        WHERE ub.user_id = ? AND ub.released_at IS NULL
        ORDER BY ub.captured_at DESC
    `),
    
    getBird: db.prepare(`
        SELECT ub.*, b.* FROM user_birds ub
        JOIN birds b ON ub.bird_id = b.id
        WHERE ub.id = ? AND ub.user_id = ?
    `),
    
    updateObservation: db.prepare(`
        UPDATE user_birds 
        SET times_observed = times_observed + 1, 
            bond_level = bond_level + ?,
            last_observed = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
    `),
    
    release: db.prepare(`
        UPDATE user_birds 
        SET released_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
    `),
    
    getAllBirds: db.prepare('SELECT * FROM birds ORDER BY rarity_weight ASC')
};

// Transaction operations
const transactionOps = {
    create: db.prepare(`
        INSERT INTO transactions (user_id, type, amount, description)
        VALUES (?, ?, ?, ?)
    `),
    
    getUserTransactions: db.prepare(`
        SELECT * FROM transactions 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT ?
    `)
};

// Trade operations
const tradeOps = {
    create: db.prepare(`
        INSERT INTO trades (initiator_id, target_id, initiator_offer, target_offer, status)
        VALUES (?, ?, ?, ?, 'pending')
    `),
    
    get: db.prepare('SELECT * FROM trades WHERE id = ?'),
    
    updateStatus: db.prepare(`
        UPDATE trades 
        SET status = ?, completed_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `),
    
    getUserTrades: db.prepare(`
        SELECT * FROM trades 
        WHERE (initiator_id = ? OR target_id = ?) AND status = 'pending'
        ORDER BY created_at DESC
    `)
};

// Guild operations
const guildOps = {
    create: db.prepare(`
        INSERT INTO guilds (name, owner_id, description)
        VALUES (?, ?, ?)
    `),
    
    get: db.prepare('SELECT * FROM guilds WHERE id = ?'),
    
    getByOwner: db.prepare('SELECT * FROM guilds WHERE owner_id = ?'),
    
    addMember: db.prepare(`
        INSERT OR IGNORE INTO guild_members (guild_id, user_id, role)
        VALUES (?, ?, 'member')
    `),
    
    removeMember: db.prepare(`
        DELETE FROM guild_members 
        WHERE guild_id = ? AND user_id = ?
    `),
    
    getMembers: db.prepare(`
        SELECT gm.*, u.username FROM guild_members gm
        JOIN users u ON gm.user_id = u.user_id
        WHERE gm.guild_id = ?
    `)
};

// Cooldown operations
const cooldownOps = {
    set: db.prepare(`
        INSERT OR REPLACE INTO cooldowns (user_id, command_name, expires_at)
        VALUES (?, ?, ?)
    `),
    
    get: db.prepare(`
        SELECT * FROM cooldowns 
        WHERE user_id = ? AND command_name = ? AND expires_at > CURRENT_TIMESTAMP
    `),
    
    cleanup: db.prepare(`
        DELETE FROM cooldowns 
        WHERE expires_at <= CURRENT_TIMESTAMP
    `)
};

module.exports = {
    db,
    initializeDatabase,
    userOps,
    birdOps,
    transactionOps,
    tradeOps,
    guildOps,
    cooldownOps
};
