CREATE POLICY "Allow public delete on documents"
ON public.documents
FOR DELETE
TO public
USING (true);