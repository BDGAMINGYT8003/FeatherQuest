-- Users table
CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    balance INTEGER DEFAULT 100,
    bank_balance INTEGER DEFAULT 0,
    title TEXT DEFAULT NULL,
    bio TEXT DEFAULT NULL,
    avatar_url TEXT DEFAULT NULL,
    total_birds_caught INTEGER DEFAULT 0,
    total_money_earned INTEGER DEFAULT 0,
    last_work DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Birds master data
CREATE TABLE IF NOT EXISTS birds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    scientific_name TEXT,
    description TEXT,
    habitat TEXT,
    rarity TEXT NOT NULL CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
    rarity_weight INTEGER NOT NULL,
    base_value INTEGER NOT NULL,
    image_url TEXT,
    fun_fact TEXT,
    wingspan_cm INTEGER,
    weight_g INTEGER,
    conservation_status TEXT
);

-- User's captured birds
CREATE TABLE IF NOT EXISTS user_birds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    bird_id INTEGER NOT NULL,
    custom_name TEXT DEFAULT NULL,
    captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    released_at DATETIME DEFAULT NULL,
    times_observed INTEGER DEFAULT 0,
    bond_level INTEGER DEFAULT 1,
    last_observed DATETIME DEFAULT NULL,
    observation_notes TEXT DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (bird_id) REFERENCES birds(id)
);

-- Items master data
CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('trap', 'lure', 'camera', 'consumable', 'cosmetic')),
    price INTEGER NOT NULL,
    effect TEXT,
    rarity TEXT DEFAULT 'common',
    tradeable BOOLEAN DEFAULT TRUE
);

-- User inventory
CREATE TABLE IF NOT EXISTS user_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    item_id INTEGER NOT NULL,
    quantity INTEGER DEFAULT 1,
    acquired_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (item_id) REFERENCES items(id)
);

-- Transactions log
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('earn', 'spend', 'trade', 'admin')),
    amount INTEGER NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Trades
CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    initiator_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    initiator_offer TEXT, -- JSON string
    target_offer TEXT, -- JSON string
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME DEFAULT NULL,
    FOREIGN KEY (initiator_id) REFERENCES users(user_id),
    FOREIGN KEY (target_id) REFERENCES users(user_id)
);

-- Guilds
CREATE TABLE IF NOT EXISTS guilds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    owner_id TEXT NOT NULL,
    description TEXT,
    bank_balance INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(user_id)
);

-- Guild members
CREATE TABLE IF NOT EXISTS guild_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guild_id) REFERENCES guilds(id),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    UNIQUE(guild_id, user_id)
);

-- Cooldowns
CREATE TABLE IF NOT EXISTS cooldowns (
    user_id TEXT NOT NULL,
    command_name TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    PRIMARY KEY (user_id, command_name)
);

-- Achievements
CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    condition_type TEXT NOT NULL,
    condition_value INTEGER,
    reward_coins INTEGER DEFAULT 0,
    reward_title TEXT DEFAULT NULL
);

-- User achievements
CREATE TABLE IF NOT EXISTS user_achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    achievement_id INTEGER NOT NULL,
    unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (achievement_id) REFERENCES achievements(id),
    UNIQUE(user_id, achievement_id)
);

-- Insert default birds data
INSERT OR IGNORE INTO birds (name, scientific_name, description, habitat, rarity, rarity_weight, base_value, fun_fact, wingspan_cm, weight_g, conservation_status) VALUES
('House Sparrow', 'Passer domesticus', 'A small, common bird found in urban areas worldwide.', 'Urban, suburban', 'common', 1, 10, 'House sparrows can live up to 7 years in the wild.', 24, 30, 'Least Concern'),
('American Robin', 'Turdus migratorius', 'A migratory songbird known for its orange-red breast.', 'Gardens, parks, forests', 'common', 1, 15, 'Robins are often the first birds to sing at dawn.', 31, 77, 'Least Concern'),
('Blue Jay', 'Cyanocitta cristata', 'An intelligent blue bird known for its loud calls.', 'Forests, parks', 'uncommon', 2, 25, 'Blue jays can mimic the calls of hawks.', 34, 100, 'Least Concern'),
('Northern Cardinal', 'Cardinalis cardinalis', 'A vibrant red bird that doesnt migrate.', 'Woodlands, gardens', 'uncommon', 2, 30, 'Cardinals mate for life and can live up to 15 years.', 30, 45, 'Least Concern'),
('Great Horned Owl', 'Bubo virginianus', 'A large owl with distinctive ear tufts.', 'Forests, swamps, parks', 'rare', 3, 75, 'Great horned owls have a grip strength of about 28 pounds.', 122, 1400, 'Least Concern'),
('Bald Eagle', 'Haliaeetus leucocephalus', 'Americas national bird, a powerful raptor.', 'Near water bodies', 'epic', 4, 200, 'Bald eagles can live over 30 years and dive at 100 mph.', 230, 4500, 'Least Concern'),
('Peregrine Falcon', 'Falco peregrinus', 'The fastest bird in the world when diving.', 'Cliffs, skyscrapers', 'epic', 4, 250, 'Peregrine falcons can reach speeds over 240 mph in dives.', 104, 950, 'Least Concern'),
('California Condor', 'Gymnogyps californianus', 'One of the rarest birds in North America.', 'Mountain areas, canyons', 'legendary', 5, 1000, 'California condors can soar for hours without flapping.', 290, 10000, 'Critically Endangered'),
('Ivory-billed Woodpecker', 'Campephilus principalis', 'Possibly extinct, the holy grail of birdwatching.', 'Old-growth forests', 'legendary', 5, 2000, 'Last confirmed sighting was in 1944, but hope remains.', 76, 450, 'Critically Endangered');

-- Insert default items
INSERT OR IGNORE INTO items (name, description, type, price, effect, rarity) VALUES
('Basic Trap', 'A simple trap for catching common birds.', 'trap', 50, 'Increases common bird catch rate by 10%', 'common'),
('Advanced Trap', 'A sophisticated trap for rare birds.', 'trap', 200, 'Increases rare bird catch rate by 15%', 'uncommon'),
('Bird Call Lure', 'Attracts birds with realistic calls.', 'lure', 75, 'Reduces hunt cooldown by 5 minutes', 'common'),
('Premium Camera', 'High-quality camera for bird photography.', 'camera', 300, 'Increases bond gain from observations by 25%', 'rare'),
('Energy Drink', 'Restores energy for more activities.', 'consumable', 25, 'Resets one random cooldown', 'common'),
('Golden Feather Pin', 'A prestigious cosmetic item.', 'cosmetic', 500, 'Shows wealth and status', 'epic');

-- Insert achievements
INSERT OR IGNORE INTO achievements (name, description, condition_type, condition_value, reward_coins, reward_title) VALUES
('First Catch', 'Catch your first bird', 'birds_caught', 1, 50, 'Novice Observer'),
('Rare Hunter', 'Catch 10 rare or higher birds', 'rare_birds_caught', 10, 200, 'Rare Hunter'),
('Millionaire', 'Accumulate 1,000,000 coins total', 'total_earned', 1000000, 1000, 'Millionaire'),
('Social Butterfly', 'Complete 50 trades', 'trades_completed', 50, 300, 'Trader'),
('Observer', 'Observe birds 100 times', 'observations', 100, 150, 'Dedicated Observer'),
('Legendary Seeker', 'Catch a legendary bird', 'legendary_caught', 1, 1000, 'Legend Seeker');
