ALTER TABLE shopping_trips
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id);
