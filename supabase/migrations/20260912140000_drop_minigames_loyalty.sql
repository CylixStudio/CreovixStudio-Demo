-- Remove chat minigames and loyalty tables added in 20260911133000_schedule_minigames_loyalty.sql.
-- Schedule tables (stream_schedule_settings, stream_schedule_slots) stay.

DROP TABLE IF EXISTS public.chat_minigame_rounds;
DROP TABLE IF EXISTS public.chat_minigames;
DROP TABLE IF EXISTS public.loyalty_redemptions;
DROP TABLE IF EXISTS public.loyalty_balances;
DROP TABLE IF EXISTS public.loyalty_rewards;
DROP TABLE IF EXISTS public.loyalty_settings;
