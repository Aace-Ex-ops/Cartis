CREATE TABLE banks (
    bank_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    whatsapp_number VARCHAR(15) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    oauth_provider VARCHAR(20) NOT NULL,
    user_type VARCHAR(20) DEFAULT 'consumer' CHECK (user_type IN ('consumer', 'seller')),
    business_name TEXT,
    wallet_balance NUMERIC(12,2) DEFAULT 0.00,
    monthly_tab_limit NUMERIC(12,2) DEFAULT 600.00,
    annual_deferred_limit NUMERIC(12,2) DEFAULT 2500.00,
    financial_health_score INT DEFAULT 750,
    coach_adherence_score NUMERIC(5,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    monthly_income NUMERIC(12,2),
    monthly_spend NUMERIC(12,2),
    investment_pct NUMERIC(5,2),
    housing_cost NUMERIC(12,2),
    dependents INT DEFAULT 0,
    debt_emis NUMERIC(12,2),
    monthly_tax NUMERIC(12,2),
    ai_model TEXT DEFAULT '@cf/meta/llama-4-scout-17b-16e-instruct'
);

CREATE TABLE sessions (
    token_hash VARCHAR(64) PRIMARY KEY,
    user_id UUID REFERENCES users(user_id),
    last_rotation TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE bank_accounts (
    account_id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(user_id),
    bank_id UUID REFERENCES banks(bank_id),
    mobile_number VARCHAR(15) NOT NULL,
    account_type VARCHAR(30),
    balance NUMERIC(12,2),
    data_as_of TIMESTAMPTZ,
    last_sync_at TIMESTAMPTZ,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE products (
    product_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(500) NOT NULL,
    gtin VARCHAR(50),
    site_url TEXT NOT NULL,
    site_name VARCHAR(100) NOT NULL,
    price NUMERIC(12,2) NOT NULL,
    category VARCHAR(100),
    specs JSONB DEFAULT '{}',
    hash VARCHAR(64) UNIQUE,
    first_seen TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE analysis_log (
    analysis_id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(user_id),
    product_id UUID REFERENCES products(product_id),
    verdict VARCHAR(10) NOT NULL CHECK (verdict IN ('good', 'warning', 'bad')),
    explanation TEXT,
    suggested_price NUMERIC(12,2),
    suggested_url TEXT,
    user_action VARCHAR(20),
    coach_dag_steps JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE price_index (
    price_id UUID PRIMARY KEY,
    product_id UUID REFERENCES products(product_id),
    site_name VARCHAR(100) NOT NULL,
    price NUMERIC(12,2) NOT NULL,
    url TEXT NOT NULL,
    checked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ledger_entries (
    entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id),
    account_type VARCHAR(30) NOT NULL,
    transaction_type VARCHAR(20) NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    reference_id UUID,
    reference_type VARCHAR(30),
    idempotency_key VARCHAR(64) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE transactions (
    transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id),
    amount NUMERIC(12,2) NOT NULL,
    payment_method VARCHAR(30) NOT NULL,
    polar_checkout_id VARCHAR(255),
    status VARCHAR(30) DEFAULT 'COMPLETED',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE budget_alerts (
    alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id),
    alert_type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('extension', 'dashboard', 'email')),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE seller_finances (
    entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id),
    entry_type VARCHAR(20) NOT NULL CHECK (entry_type IN ('revenue', 'expense', 'cogs', 'salary', 'rent', 'other')),
    amount NUMERIC(12,2) NOT NULL,
    category VARCHAR(100),
    description TEXT,
    transaction_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE seller_inventory (
    item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id),
    sku VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    reorder_level INT NOT NULL DEFAULT 0,
    unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE financial_health_scores (
    score_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id),
    score INT NOT NULL CHECK (score BETWEEN 300 AND 850),
    factors JSONB NOT NULL,
    calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE budget_suggestions (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(user_id),
    suggested_limit NUMERIC(12,2) NOT NULL,
    reasoning TEXT NOT NULL,
    spent NUMERIC(12,2),
    wallet_balance NUMERIC(12,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX budget_suggestions_user_idx ON budget_suggestions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS coach_insights (
    user_id UUID REFERENCES users(user_id),
    role TEXT NOT NULL CHECK (role IN ('consumer', 'seller')),
    insights JSONB NOT NULL,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, role)
);

CREATE TABLE IF NOT EXISTS chat_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id),
    mode TEXT NOT NULL CHECK (mode IN ('consumer', 'seller')),
    title TEXT NOT NULL DEFAULT 'New chat',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS chat_sessions_user_idx ON chat_sessions(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS chat_messages (
    id BIGSERIAL PRIMARY KEY,
    session_id UUID REFERENCES chat_sessions(session_id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS chat_messages_session_idx ON chat_messages(session_id, id);
