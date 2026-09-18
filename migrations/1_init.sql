CREATE TABLE IF NOT EXISTS settings (
  "guildID" TEXT,
  "key" TEXT,
  "value" TEXT
);

CREATE TABLE IF NOT EXISTS user_settings (
  "userID" TEXT,
  "key" TEXT,
  "value" TEXT
);

CREATE TABLE IF NOT EXISTS leveling (
  "guild" TEXT,
  "userID" TEXT,
  "xp" INTEGER
);

CREATE TABLE IF NOT EXISTS moderation (
  "guild" TEXT,
  "userID" TEXT,
  "type" TEXT,
  "moderator" TEXT,
  "reason" TEXT,
  "id" INTEGER,
  "timestamp" TIMESTAMP,
  "expiresAt" TIMESTAMP
);

CREATE TABLE IF NOT EXISTS news (
  "guildID" TEXT,
  "title" TEXT,
  "body" TEXT,
  "author" TEXT,
  "authorPFP" TEXT,
  "createdAt" TIMESTAMP,
  "updatedAt" TIMESTAMP,
  "messageID" TEXT,
  "imageURL" TEXT,
  "id" INTEGER
);

CREATE TABLE IF NOT EXISTS starboard (
  "guild" TEXT,
  "message" TEXT,
  "channel" TEXT,
  "author" TEXT,
  "star_message" TEXT,
  "stars" INTEGER,
  "content" TEXT,
  "timestamp" TIMESTAMP
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'settings_pk') THEN
        ALTER TABLE settings ADD CONSTRAINT settings_pk PRIMARY KEY ("guildID", "key");
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_settings_pk') THEN
        ALTER TABLE user_settings ADD CONSTRAINT user_settings_pk PRIMARY KEY ("userID", "key");
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leveling_pk') THEN
        ALTER TABLE leveling ADD CONSTRAINT leveling_pk PRIMARY KEY ("guild", "userID");
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moderation_pk') THEN
        ALTER TABLE moderation ADD CONSTRAINT moderation_pk PRIMARY KEY ("guild", "id");
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'news_pk') THEN
        ALTER TABLE news ADD CONSTRAINT news_pk PRIMARY KEY ("guildID", "id");
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'starboard_pk') THEN
        ALTER TABLE starboard ADD CONSTRAINT starboard_pk PRIMARY KEY ("guild", "message");
    END IF;
END $$;
