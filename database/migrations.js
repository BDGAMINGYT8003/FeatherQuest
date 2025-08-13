function runMigrations(db) {
    // Create users table
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            balance INTEGER DEFAULT 1000,
            bank_balance INTEGER DEFAULT 0,
            bio TEXT,
            title TEXT,
            avatar_url TEXT,
            total_hunts INTEGER DEFAULT 0,
            total_observations INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_work DATETIME,
            last_hunt DATETIME,
            premium_until DATETIME
        )
    `);

    // Create user_birds table
    db.exec(`
        CREATE TABLE IF NOT EXISTS user_birds (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            bird_id TEXT NOT NULL,
            rarity TEXT NOT NULL,
            location TEXT,
            caught_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            observations INTEGER DEFAULT 0,
            notes TEXT,
            is_favorite BOOLEAN DEFAULT FALSE,
            FOREIGN KEY (user_id) REFERENCES users (user_id)
        )
    `);

    // Create user_items table
    db.exec(`
        CREATE TABLE IF NOT EXISTS user_items (
            user_id TEXT NOT NULL,
            item_id TEXT NOT NULL,
            quantity INTEGER DEFAULT 0,
            PRIMARY KEY (user_id, item_id),
            FOREIGN KEY (user_id) REFERENCES users (user_id)
        )
    `);

    // Create guilds table
    db.exec(`
        CREATE TABLE IF NOT EXISTS guilds (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            owner_id TEXT NOT NULL,
            description TEXT,
            bank_balance INTEGER DEFAULT 0,
            member_count INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (owner_id) REFERENCES users (user_id)
        )
    `);

    // Create guild_members table
    db.exec(`
        CREATE TABLE IF NOT EXISTS guild_members (
            guild_id INTEGER NOT NULL,
            user_id TEXT NOT NULL,
            role TEXT DEFAULT 'member',
            joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (guild_id, user_id),
            FOREIGN KEY (guild_id) REFERENCES guilds (id),
            FOREIGN KEY (user_id) REFERENCES users (user_id)
        )
    `);

    // Create trades table
    db.exec(`
        CREATE TABLE IF NOT EXISTS trades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            initiator_id TEXT NOT NULL,
            target_id TEXT NOT NULL,
            initiator_offer TEXT NOT NULL, -- JSON string
            target_offer TEXT NOT NULL,    -- JSON string
            status TEXT DEFAULT 'pending', -- pending, accepted, rejected, cancelled
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (initiator_id) REFERENCES users (user_id),
            FOREIGN KEY (target_id) REFERENCES users (user_id)
        )
    `);

    // Create cooldowns table
    db.exec(`
        CREATE TABLE IF NOT EXISTS cooldowns (
            user_id TEXT NOT NULL,
            command TEXT NOT NULL,
            expires_at DATETIME NOT NULL,
            PRIMARY KEY (user_id, command),
            FOREIGN KEY (user_id) REFERENCES users (user_id)
        )
    `);

    // Create user_achievements table
    db.exec(`
        CREATE TABLE IF NOT EXISTS user_achievements (
            user_id TEXT NOT NULL,
            achievement_id TEXT NOT NULL,
            unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, achievement_id),
            FOREIGN KEY (user_id) REFERENCES users (user_id)
        )
    `);

    // Create user_quests table
    db.exec(`
        CREATE TABLE IF NOT EXISTS user_quests (
            user_id TEXT NOT NULL,
            quest_id TEXT NOT NULL,
            progress INTEGER DEFAULT 0,
            target INTEGER NOT NULL,
            status TEXT DEFAULT 'active', -- active, completed, failed
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME,
            PRIMARY KEY (user_id, quest_id),
            FOREIGN KEY (user_id) REFERENCES users (user_id)
        )
    `);

    // Create statistics table for leaderboards
    db.exec(`
        CREATE TABLE IF NOT EXISTS statistics (
            user_id TEXT NOT NULL,
            stat_type TEXT NOT NULL,
            value INTEGER DEFAULT 0,
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, stat_type),
            FOREIGN KEY (user_id) REFERENCES users (user_id)
        )
    `);

    // Create indexes for better performance
    db.exec('CREATE INDEX IF NOT EXISTS idx_user_birds_user_id ON user_birds (user_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_user_birds_rarity ON user_birds (rarity)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_trades_status ON trades (status)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_cooldowns_expires ON cooldowns (expires_at)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_guild_members_guild_id ON guild_members (guild_id)');

    console.log('Database migrations completed successfully!');
}

module.exports = { runMigrations };
