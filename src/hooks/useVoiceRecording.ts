import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWebSpeech } from './useWebSpeech';

export interface VoiceRecordingHook {
  isRecording: boolean;
  isProcessing: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string | null>;
  error: string | null;
}

export const useVoiceRecording = (): VoiceRecordingHook => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  
  const webSpeech = useWebSpeech();

  const startRecording = useCallback(async () => {
    setError(null);
    
    // Try Web Speech API first (no API calls needed)
    if (webSpeech.isSupported) {
      console.log('Using Web Speech API for voice recognition');
      webSpeech.startListening();
      setIsRecording(true);
      return;
    }
    
    // Fallback to MediaRecorder + Whisper API
    try {
      console.log('Using MediaRecorder + Whisper API fallback');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });

      mediaRecorder.current = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
          ? 'audio/webm;codecs=opus' 
          : 'audio/webm'
      });

      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
        }
      };

      mediaRecorder.current.start(1000);
      setIsRecording(true);
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Failed to start recording. Please check microphone permissions.');
    }
  }, [webSpeech]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    if (!isRecording) return null;
    
    // Handle Web Speech API
    if (webSpeech.isListening) {
      webSpeech.stopListening();
      setIsRecording(false);
      
      // Wait longer for the final transcript to be available
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (webSpeech.transcript && webSpeech.transcript.trim()) {
        console.log('Web Speech transcript:', webSpeech.transcript);
        return webSpeech.transcript.trim();
      }
      
      if (webSpeech.error) {
        setError(`Web Speech API error: ${webSpeech.error}`);
        return null;
      }
      
      // If no transcript but no error, it might be empty speech
      setError('No speech detected. Please try again.');
      return null;
    }
    
    // Handle MediaRecorder fallback
    if (!mediaRecorder.current) return null;

    return new Promise((resolve) => {
      if (!mediaRecorder.current) return resolve(null);

      mediaRecorder.current.onstop = async () => {
        setIsRecording(false);
        setIsProcessing(true);

        try {
          const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
          
          // Convert blob to base64
          const reader = new FileReader();
          reader.onloadend = async () => {
            try {
              const base64Audio = (reader.result as string).split(',')[1];
              
              // Send to Supabase Edge Function for transcription
              const { data, error } = await supabase.functions.invoke('voice-to-text', {
                body: { audio: base64Audio },
              });

              if (error) throw error;

              setIsProcessing(false);
              resolve(data.text || null);
            } catch (err) {
              console.error('Error processing audio:', err);
              setError('API quota exceeded. Please try the built-in voice recognition.');
              setIsProcessing(false);
              resolve(null);
            }
          };
          reader.readAsDataURL(audioBlob);
        } catch (err) {
          console.error('Error creating audio blob:', err);
          setError('Failed to process recording.');
          setIsProcessing(false);
          resolve(null);
        }

        // Stop all tracks
        const tracks = mediaRecorder.current?.stream?.getTracks() || [];
        tracks.forEach(track => track.stop());
      };

      mediaRecorder.current.stop();
    });
  }, [isRecording, webSpeech]);

  return {
    isRecording: isRecording || webSpeech.isListening,
    isProcessing,
    startRecording,
    stopRecording,
    error: error || webSpeech.error,
  };
};