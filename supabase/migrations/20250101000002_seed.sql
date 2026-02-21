-- CATEGORIES
INSERT INTO categories (name, sort_order) VALUES 
('Produce', 10),
('Dairy', 20),
('Meat', 30),
('Bakery', 40),
('Frozen', 50),
('Pantry', 60),
('Household', 70),
('Other', 99)
ON CONFLICT (name) DO NOTHING;

-- STORES
INSERT INTO stores (name, color_code) VALUES 
('Costco', '#005596'),
('Whole Foods', '#00674b'),
('Safeway', '#e31837'),
('Trader Joe''s', '#bc2026')
ON CONFLICT (name) DO NOTHING;

-- UNITS
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
('Quarts', 'qt')
ON CONFLICT (name) DO NOTHING;
