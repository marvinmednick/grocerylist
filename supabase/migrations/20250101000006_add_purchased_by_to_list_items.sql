ALTER TABLE list_items
ADD COLUMN IF NOT EXISTS purchased_by UUID REFERENCES profiles(id);
