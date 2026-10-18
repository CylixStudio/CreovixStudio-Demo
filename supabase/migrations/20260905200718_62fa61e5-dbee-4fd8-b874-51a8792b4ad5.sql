DROP POLICY IF EXISTS "Clips: owners can read their own files" ON storage.objects;
DROP POLICY IF EXISTS "Clips: owners can upload their own files" ON storage.objects;
DROP POLICY IF EXISTS "Clips: owners can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Clips: owners can delete their own files" ON storage.objects;

CREATE POLICY "Clips: owners can read their own files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'clips' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Clips: owners can upload their own files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'clips' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Clips: owners can update their own files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'clips' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'clips' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Clips: owners can delete their own files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'clips' AND (storage.foldername(name))[1] = auth.uid()::text);