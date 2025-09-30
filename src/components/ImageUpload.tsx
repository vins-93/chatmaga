import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ImageIcon, X, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface ImageUploadProps {
  onImageSelect: (imageUrl: string, fileName: string) => void;
  disabled?: boolean;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({ onImageSelect, disabled }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    
    try {
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => setPreviewImage(e.target?.result as string);
      reader.readAsDataURL(file);

      // Upload to Supabase Storage
      const fileName = `${user.id}/${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage
        .from('chat-images')
        .upload(fileName, file);

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('chat-images')
        .getPublicUrl(fileName);

      onImageSelect(publicUrl, file.name);
      
      toast({
        title: "Image uploaded",
        description: "Your image has been uploaded successfully",
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
      setPreviewImage(null);
    } finally {
      setIsUploading(false);
    }
  };

  const clearPreview = () => {
    setPreviewImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isUploading}
      />
      
      {previewImage ? (
        <div className="relative">
          <img 
            src={previewImage} 
            alt="Preview" 
            className="w-10 h-10 object-cover rounded-md border"
          />
          <Button
            variant="ghost"
            size="sm"
            className="absolute -top-2 -right-2 w-5 h-5 p-0 bg-destructive text-destructive-foreground rounded-full"
            onClick={clearPreview}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading}
          className="text-muted-foreground hover:text-foreground"
        >
          {isUploading ? (
            <Upload className="w-5 h-5 animate-pulse" />
          ) : (
            <ImageIcon className="w-5 h-5" />
          )}
        </Button>
      )}
    </div>
  );
};