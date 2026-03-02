-- Allow users to read all profiles in their household.
-- The original "Users can read own profile" policy was too restrictive:
-- it prevented the shopping list from looking up other members' colors
-- (needed for the purchased_by checkbox rendering in F2).
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;

CREATE POLICY "Household members can read profiles" ON profiles
    FOR SELECT TO authenticated
    USING (household_id = get_my_household_id());
