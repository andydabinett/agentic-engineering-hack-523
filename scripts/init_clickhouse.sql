CREATE DATABASE IF NOT EXISTS javier;

-- Team listings table stub (owned by ingestion; referenced by correspondence)
CREATE TABLE IF NOT EXISTS javier.listings (
    listing_id String,
    title String,
    price UInt32,
    neighborhood String,
    url String,
    updated_at DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(updated_at)
ORDER BY listing_id;

CREATE TABLE IF NOT EXISTS javier.correspondence_threads (
    thread_id UUID,
    listing_id String,
    lister_phone String,
    lister_name Nullable(String),
    user_id String,
    status Enum8(
        'initiated' = 1,
        'outreach_sent' = 2,
        'awaiting_lister_reply' = 3,
        'negotiating_time' = 4,
        'viewing_proposed' = 5,
        'viewing_confirmed' = 6,
        'calendar_event_created' = 7,
        'completed' = 8,
        'failed' = 9,
        'needs_user_input' = 10
    ),
    proposed_viewing_at Nullable(DateTime),
    calendar_event_id Nullable(String),
    listing_summary Nullable(String),
    error_message Nullable(String),
    created_at DateTime,
    updated_at DateTime
) ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (thread_id, updated_at);

CREATE TABLE IF NOT EXISTS javier.correspondence_messages (
    message_id UUID,
    thread_id UUID,
    direction Enum8('outbound' = 1, 'inbound' = 2),
    body String,
    twilio_sid Nullable(String),
    sent_at DateTime
) ENGINE = MergeTree()
ORDER BY (thread_id, sent_at);

CREATE TABLE IF NOT EXISTS javier.user_calendar_tokens (
    user_id String,
    refresh_token String,
    updated_at DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(updated_at)
ORDER BY user_id;
