-- Migration: Add admin_settings_id foreign key to threads table
-- This links threads to admin_settings to distinguish between control and plan experiments

-- Step 1: Add the column as nullable first (to handle existing rows)
ALTER TABLE public.threads
ADD COLUMN admin_settings_id bigint;

-- Step 2: Update all existing threads to use control (admin_settings id = 1)
UPDATE public.threads
SET admin_settings_id = 1
WHERE admin_settings_id IS NULL;

-- Step 3: Add NOT NULL constraint now that all rows have a value
ALTER TABLE public.threads
ALTER COLUMN admin_settings_id SET NOT NULL;

-- Step 4: Set default value for future inserts
ALTER TABLE public.threads
ALTER COLUMN admin_settings_id SET DEFAULT 1;

-- Step 5: Add foreign key constraint to admin_settings
ALTER TABLE public.threads
ADD CONSTRAINT threads_admin_settings_id_fkey
FOREIGN KEY (admin_settings_id) REFERENCES public.admin_settings(id);

-- Step 6: Create index for faster filtering by admin_settings_id
CREATE INDEX idx_threads_admin_settings_id ON public.threads(admin_settings_id);

-- Step 7: Create composite index for common query pattern (user_id + admin_settings_id)
CREATE INDEX idx_threads_user_admin_settings ON public.threads(user_id, admin_settings_id);
