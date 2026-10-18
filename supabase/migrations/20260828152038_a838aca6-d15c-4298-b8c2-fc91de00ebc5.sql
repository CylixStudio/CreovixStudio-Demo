DROP POLICY "overlays_owner" ON public.overlays;
DROP POLICY "timer_states_owner" ON public.timer_states;
DROP POLICY "timer_states_public_read" ON public.timer_states;
DROP POLICY "events_owner" ON public.events;
DROP POLICY "rules_owner" ON public.rules;

CREATE POLICY "overlays_owner" ON public.overlays FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.subathons s WHERE s.id = overlays.subathon_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.subathons s WHERE s.id = overlays.subathon_id AND s.user_id = auth.uid()));

CREATE POLICY "timer_states_owner" ON public.timer_states FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.subathons s WHERE s.id = timer_states.subathon_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.subathons s WHERE s.id = timer_states.subathon_id AND s.user_id = auth.uid()));

CREATE POLICY "timer_states_public_read" ON public.timer_states FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.overlays o WHERE o.subathon_id = timer_states.subathon_id AND o.is_public));

CREATE POLICY "events_owner" ON public.events FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.subathons s WHERE s.id = events.subathon_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.subathons s WHERE s.id = events.subathon_id AND s.user_id = auth.uid()));

CREATE POLICY "rules_owner" ON public.rules FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.subathons s WHERE s.id = rules.subathon_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.subathons s WHERE s.id = rules.subathon_id AND s.user_id = auth.uid()));

DROP FUNCTION public.owns_subathon(UUID);
DROP FUNCTION public.has_public_overlay(UUID);