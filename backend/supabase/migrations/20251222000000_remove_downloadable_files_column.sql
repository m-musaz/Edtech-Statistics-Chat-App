-- Migration: Remove downloadable_files column from messages table
-- Reason: Moving downloadable files storage to browser localStorage to reduce DB costs
-- Files are now stored client-side since we only have anonymous sessions

-- Drop the column if it exists
ALTER TABLE public.messages 
DROP COLUMN IF EXISTS downloadable_files;

-- Add comment for documentation
COMMENT ON TABLE public.messages IS 'Messages table - downloadable_files moved to client-side localStorage as of 2024-12-22';
