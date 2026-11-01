CREATE TABLE IF NOT EXISTS settings (
  guild_id TEXT,
  key TEXT,
  value TEXT,
  parameters JSONB
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT,
  key TEXT,
  value TEXT
);

CREATE TABLE IF NOT EXISTS leveling (
  guild_id TEXT,
  user_id TEXT,
  xp INTEGER
);

CREATE TABLE IF NOT EXISTS moderation (
  guild_id TEXT NOT NULL,
  target_id TEXT,
  type TEXT NOT NULL,
  moderator_id TEXT,
  reason TEXT,
  id INTEGER NOT NULL,
  timestamp TIMESTAMPZ,
  expires_at TIMESTAMPZ
);

CREATE TABLE IF NOT EXISTS news (
  guild_id TEXT,
  title TEXT,
  body TEXT,
  author_id TEXT,
  created_at TIMESTAMPZ,
  updated_at TIMESTAMPZ,
  message_id TEXT,
  image_url TEXT,
  id INTEGER,
  category_id TEXT
);

CREATE TABLE IF NOT EXISTS starboard (
  guild_id TEXT,
  message_id TEXT,
  channel_id TEXT,
  author_id TEXT,
  star_message_id TEXT,
  stars INTEGER,
  timestamp TIMESTAMPZ
);

CREATE TABLE IF NOT EXISTS itk_requestors (
  guild_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  timestamp TIMESTAMPZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS itk_registrations (
    entity_id TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    token_hash TEXT NOT NULL,
    token_date TIMESTAMPZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'itk_requestors_pk') THEN
        ALTER TABLE itk_requestors ADD CONSTRAINT itk_requestors_pk PRIMARY KEY (guild_id, entity_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'settings_pk'
    ) THEN
        ALTER TABLE settings
        ADD CONSTRAINT settings_pk PRIMARY KEY (guild_id, key);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'user_settings_pk'
    ) THEN
        ALTER TABLE user_settings
        ADD CONSTRAINT user_settings_pk PRIMARY KEY (user_id, key);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'leveling_pk'
    ) THEN
        ALTER TABLE leveling
        ADD CONSTRAINT leveling_pk PRIMARY KEY (guild_id, user_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'moderation_pk'
    ) THEN
        ALTER TABLE moderation
        ADD CONSTRAINT moderation_pk PRIMARY KEY (guild_id, id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'news_pk'
    ) THEN
        ALTER TABLE news
        ADD CONSTRAINT news_pk PRIMARY KEY (guild_id, id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'starboard_pk'
    ) THEN
        ALTER TABLE starboard
        ADD CONSTRAINT starboard_pk PRIMARY KEY (guild_id, message_id);
    END IF;
END $$;
