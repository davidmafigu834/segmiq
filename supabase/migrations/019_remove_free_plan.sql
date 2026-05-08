-- 019_remove_free_plan.sql
-- Remove free tier, add starter. Migrate any existing free accounts to starter.

-- Step 1: Drop the old check constraint first so we can write 'starter'
alter table clients drop constraint if exists clients_plan_check;

-- Step 2: Migrate any existing 'free' or null plan accounts to 'starter'
update clients set plan = 'starter' where plan = 'free' or plan is null;

-- Step 3: Add the new constraint with updated valid values
alter table clients add constraint clients_plan_check
  check (plan in ('starter', 'professional', 'business'));

-- Step 4: Set default to starter
alter table clients alter column plan set default 'starter';
