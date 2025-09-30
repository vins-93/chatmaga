-- Create storage bucket for chat images
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-images', 'chat-images', true);

-- Create policy for chat images - users can upload their own images
CREATE POLICY "Users can upload chat images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'chat-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create policy for chat images - images are publicly viewable
CREATE POLICY "Chat images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'chat-images');

-- Create policy for users to update their own chat images
CREATE POLICY "Users can update their own chat images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'chat-images' AND auth.uid()::text = (storage.foldername(name))[1]);