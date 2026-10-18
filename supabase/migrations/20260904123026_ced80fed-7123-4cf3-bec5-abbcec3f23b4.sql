DELETE FROM public.events WHERE actor_name = 'TestViewer';
ALTER TABLE public.events REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.events;