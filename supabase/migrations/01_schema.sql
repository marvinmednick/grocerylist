-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. STORES
CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    color_code TEXT DEFAULT '#000000',
    icon TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CATEGORIES
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. UNITS
CREATE TABLE units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    abbreviation TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ITEMS (Master Database)
CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    default_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    default_store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
    default_unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
    default_qty TEXT,
    alternate_qtys TEXT[] DEFAULT '{}',
    search_tokens TSVECTOR,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX items_search_idx ON items USING GIN (search_tokens);

-- 6. SHOPPING TRIPS
CREATE TABLE shopping_trips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    primary_store_id UUID REFERENCES stores(id),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'retroactive')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. LIST ITEMS (The Active Shopping List)
CREATE TABLE list_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID REFERENCES items(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    quantity TEXT,
    unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
    trip_id UUID REFERENCES shopping_trips(id) ON DELETE SET NULL,
    is_purchased BOOLEAN DEFAULT FALSE,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    purchased_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    added_by UUID, -- Link to auth.users.id
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. ITEM_STORES (Many-to-Many)
CREATE TABLE item_stores (
    item_id UUID REFERENCES items(id) ON DELETE CASCADE,
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    is_preferred BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (item_id, store_id)
);
