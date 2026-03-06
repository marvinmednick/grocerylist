-- Migration 09: Drop stale open-access policies and fix function search_path.
--
-- PROBLEM 1: Stale policies "Allow auth manage items" and "Allow auth manage list_items"
-- exist in production with USING(true) / WITH CHECK(true). These were not created by any
-- migration in this project — they predate the household migration. Because PostgreSQL ORs
-- all permissive policies, these USING(true) policies override the household-scoped ones,
-- meaning all authenticated users can access all items/list_items regardless of household.
--
-- PROBLEM 2: get_my_household_id() has a mutable search_path, which is a security risk.
-- Fixed by pinning search_path = '' (the function body already uses fully-qualified names).

-- 1. Drop stale open-access policies on items and list_items
DROP POLICY IF EXISTS "Allow auth manage items" ON items;
DROP POLICY IF EXISTS "Allow auth manage list_items" ON list_items;

-- 2. Pin search_path on get_my_household_id to eliminate search_path hijacking risk
CREATE OR REPLACE FUNCTION public.get_my_household_id()
RETURNS UUID AS $$
    SELECT household_id FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = '';
