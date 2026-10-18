-- Smart broadcast events schedule overlay widget.

ALTER TYPE public.widget_type ADD VALUE IF NOT EXISTS 'STREAM_EVENTS_SCHEDULE';

NOTIFY pgrst, 'reload schema';
