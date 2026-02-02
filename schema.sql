-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. STORES
CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    color_code TEXT DEFAULT '#000000',
    icon TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CATEGORIES
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ITEMS (Master Database)
CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    default_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    default_store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
    default_qty TEXT,
    alternate_qtys TEXT[] DEFAULT '{}',
    search_tokens TSVECTOR,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create a GIN index for search tokens
CREATE INDEX items_search_idx ON items USING GIN (search_tokens);

-- 4. SHOPPING TRIPS (Future Proofing)
CREATE TABLE shopping_trips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    primary_store_id UUID REFERENCES stores(id),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'retroactive')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. LIST ITEMS (The Active Shopping List)
CREATE TABLE list_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID REFERENCES items(id) ON DELETE SET NULL,
    name TEXT NOT NULL, -- Snapshot
    quantity TEXT,      -- Snapshot
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
    trip_id UUID REFERENCES shopping_trips(id) ON DELETE SET NULL,
    is_purchased BOOLEAN DEFAULT FALSE,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    purchased_at TIMESTAMPTZ,
    added_by UUID, -- Link to auth.users.id
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ITEM_STORES (Many-to-Many relationship for "Known Stores" for an item)
CREATE TABLE item_stores (
    item_id UUID REFERENCES items(id) ON DELETE CASCADE,
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    is_preferred BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (item_id, store_id)
);

-- SEED DATA (Optional, but helpful for starting)
INSERT INTO categories (name, sort_order) VALUES 
('Produce', 10),
('Dairy', 20),
('Meat', 30),
('Bakery', 40),
('Frozen', 50),
('Pantry', 60),
('Household', 70),
('Other', 99);

INSERT INTO stores (name, color_code) VALUES 
('Costco', '#005596'),
('Whole Foods', '#00674b'),
('Safeway', '#e31837'),
('Trader Joe''s', '#bc2026');
