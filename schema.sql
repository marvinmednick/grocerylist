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

-- 3. UNITS
CREATE TABLE units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    abbreviation TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ITEMS (Master Database)
CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    default_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    default_store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
    default_unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
    default_qty TEXT,
    alternate_qtys TEXT[] DEFAULT '{}',
// ...
    quantity TEXT,      -- Snapshot
    unit_id UUID REFERENCES units(id) ON DELETE SET NULL, -- Snapshot unit
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
// ...
INSERT INTO units (name, abbreviation) VALUES 
('Pounds', 'lbs'),
('Ounces', 'oz'),
('Grams', 'g'),
('Kilograms', 'kg'),
('Count', 'x'),
('Packages', 'pkgs'),
('Cans', 'cans'),
('Bags', 'bags'),
('Gallons', 'gal'),
('Quarts', 'qt');


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
