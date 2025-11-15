-- Add thumbnail_key column to files table
ALTER TABLE files ADD COLUMN IF NOT EXISTS thumbnail_key VARCHAR(500);

-- Create index for thumbnail_key
CREATE INDEX IF NOT EXISTS idx_files_thumbnail_key ON files(thumbnail_key);
