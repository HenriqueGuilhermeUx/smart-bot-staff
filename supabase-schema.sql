-- ============================================
-- SMART BOT STAFF - Schema SQL for Supabase
-- ============================================
-- Execute these commands in the Supabase SQL Editor
-- https://supabase.com/dashboard -> SQL Editor -> New Query
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLE 1: staff_users
-- ============================================
-- Stores information about Staff users
-- Links to Supabase Auth users via user_id
-- ============================================

CREATE TABLE IF NOT EXISTS staff_users (
    id SERIAL PRIMARY KEY,
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone_number TEXT,
    assistant_id TEXT,
    thread_id TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_staff_users_user_id ON staff_users(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_users_phone ON staff_users(phone_number);
CREATE INDEX IF NOT EXISTS idx_staff_users_email ON staff_users(email);
CREATE INDEX IF NOT EXISTS idx_staff_users_status ON staff_users(status);

-- ============================================
-- TABLE 2: staff_history
-- ============================================
-- Stores complete conversation history
-- ============================================

CREATE TABLE IF NOT EXISTS staff_history (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    thread_id TEXT NOT NULL,
    user_message TEXT NOT NULL,
    bot_reply TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for history queries
CREATE INDEX IF NOT EXISTS idx_staff_history_user_id ON staff_history(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_history_phone ON staff_history(phone_number);
CREATE INDEX IF NOT EXISTS idx_staff_history_thread ON staff_history(thread_id);
CREATE INDEX IF NOT EXISTS idx_staff_history_created ON staff_history(created_at DESC);

-- ============================================
-- TABLE 3: staff_reminders (Optional)
-- ============================================
-- Stores scheduled reminders for users
-- ============================================

CREATE TABLE IF NOT EXISTS staff_reminders (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    reminder_date TIMESTAMP WITH TIME ZONE NOT NULL,
    reminder_type TEXT DEFAULT 'one-time' CHECK (reminder_type IN ('one-time', 'recurring', 'yearly')),
    is_completed BOOLEAN DEFAULT FALSE,
    is_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_reminders_user ON staff_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_reminders_date ON staff_reminders(reminder_date);
CREATE INDEX IF NOT EXISTS idx_staff_reminders_pending ON staff_reminders(reminder_date, is_sent) WHERE is_sent = FALSE;

-- ============================================
-- TABLE 4: staff_messages
-- ============================================
-- Stores chat messages between user and Staff
-- ============================================

CREATE TABLE IF NOT EXISTS staff_messages (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_messages_user_id ON staff_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_messages_created ON staff_messages(created_at DESC);

-- ============================================
-- TABLE 5: staff_categories (Optional)
-- ============================================
-- Stores user categories for organizing data
-- ============================================

CREATE TABLE IF NOT EXISTS staff_categories (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category_type TEXT NOT NULL CHECK (category_type IN ('vehicle', 'document', 'finance', 'health', 'family', 'work', 'event', 'other')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_categories_user ON staff_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_categories_type ON staff_categories(category_type);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
-- Enable RLS for security
-- ============================================

ALTER TABLE staff_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_categories ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see and manage their own data
CREATE POLICY "Users can manage own staff data" ON staff_users
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own history" ON staff_history
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own history" ON staff_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all history" ON staff_history
    FOR ALL USING (true);

CREATE POLICY "Users can manage own reminders" ON staff_reminders
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own messages" ON staff_messages
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own categories" ON staff_categories
    FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- FUNCTION: Update updated_at timestamp
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for staff_users
CREATE TRIGGER update_staff_users_updated_at
    BEFORE UPDATE ON staff_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FUNCTION: Auto-create staff_user on signup
-- ============================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.staff_users (user_id, name, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', ''),
        NEW.email
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create staff_user when a new user signs up
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- ENABLE REALTIME FOR STAFF_HISTORY
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE staff_history;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check tables were created:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- View table columns:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'staff_users';

-- Check if trigger was created:
-- SELECT trigger_name FROM information_schema.triggers WHERE trigger_schema = 'public';