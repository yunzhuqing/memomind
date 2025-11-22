-- Add new fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user',
ADD COLUMN IF NOT EXISTS team_id INTEGER,
ADD COLUMN IF NOT EXISTS address TEXT;

-- Create index on role for faster admin queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Create index on team_id for team-based queries
CREATE INDEX IF NOT EXISTS idx_users_team_id ON users(team_id);

-- Update existing users to have 'user' role if NULL
UPDATE users SET role = 'user' WHERE role IS NULL;
