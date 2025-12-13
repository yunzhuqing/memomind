-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    usage TEXT,
    s3_key VARCHAR(500),
    created_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);

-- Create index on created_time for sorting
CREATE INDEX IF NOT EXISTS idx_conversations_created_time ON conversations(created_time DESC);
