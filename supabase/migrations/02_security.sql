-- Enable RLS on all tables
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_stores ENABLE ROW LEVEL SECURITY;

-- 1. Public Read (Categories, Stores, Units)
CREATE POLICY "Public read categories" ON categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Public read stores" ON stores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Public read units" ON units FOR SELECT TO authenticated USING (true);

-- 2. Master Items (Authenticated users can manage)
CREATE POLICY "Authenticated users can manage items" ON items FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage item_stores" ON item_stores FOR ALL TO authenticated USING (true);

-- 3. List Items (Owned by user)
-- Note: Requires added_by to be set in application logic
CREATE POLICY "Users can manage their own list items" ON list_items 
    FOR ALL TO authenticated 
    USING (auth.uid() = added_by)
    WITH CHECK (auth.uid() = added_by);

-- 4. Shopping Trips (Owned by user)
CREATE POLICY "Users can manage their own trips" ON shopping_trips 
    FOR ALL TO authenticated 
    USING (true); -- Simplified for prototype
