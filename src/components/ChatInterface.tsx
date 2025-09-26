import React, { useState } from 'react';
import { Send, Mic, Square, Plus, LogOut, Loader2, Image as ImageIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { useVoiceRecording } from '@/hooks/useVoiceRecording';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { ImageUpload } from '@/components/ImageUpload';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  imageUrl?: string;
  imageName?: string;
}

const ChatInterface = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [selectedImage, setSelectedImage] = useState<{ url: string; name: string } | null>(null);
  const { isRecording, isProcessing, startRecording, stopRecording, error } = useVoiceRecording();

  const handleSendMessage = async () => {
    if (!inputValue.trim() && !selectedImage) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: 'user',
      timestamp: new Date(),
      imageUrl: selectedImage?.url,
      imageName: selectedImage?.name,
    };

    setMessages(prev => [...prev, newMessage]);
    const messageText = inputValue;
    const currentImage = selectedImage;
    setInputValue('');
    setSelectedImage(null);

    try {
      let response;
      
      if (currentImage) {
        // Handle image analysis
        response = await supabase.functions.invoke('image-analysis', {
          body: { 
            imageUrl: currentImage.url,
            message: messageText || 'What do you see in this image?'
          },
        });
      } else {
        // Handle regular chat
        response = await supabase.functions.invoke('chat-openai', {
          body: { message: messageText },
        });
      }

      const { data, error } = response;
      if (error) throw error;

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: currentImage ? data.analysis : data.message,
        sender: 'assistant',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiResponse]);
    } catch (error) {
      console.error('Error getting AI response:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "Sorry, I'm having trouble connecting to the AI service right now. Please try again later.",
        sender: 'assistant',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleVoiceInput = async () => {
    if (isRecording) {
      const transcribedText = await stopRecording();
      if (transcribedText) {
        setInputValue(transcribedText);
        toast({
          title: "Voice recorded",
          description: "Text has been transcribed successfully",
        });
      } else if (error) {
        toast({
          title: "Voice recording failed",
          description: error,
          variant: "destructive",
        });
      }
    } else {
      await startRecording();
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setSelectedImage(null);
  };

  const handleImageSelect = (imageUrl: string, fileName: string) => {
    setSelectedImage({ url: imageUrl, name: fileName });
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="glass border-b border-border/50 p-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center space-x-4">
            <img 
              src="/assets/chartmaga-logo.png" 
              alt="ChartMaga Logo" 
              className="w-8 h-8 object-contain rounded-lg"
            />
            <h1 className="text-2xl font-bold gradient-text">ChartMaga</h1>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" onClick={startNewChat}>
              <Plus className="w-4 h-4" />
              New Chat
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center space-x-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-xs">
                      {user?.email?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden md:inline text-sm">{user?.email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
        {messages.length === 0 ? (
          /* Welcome Screen */
          <div className="flex-1 flex items-center justify-center p-8">
            <Card className="glass p-8 text-center max-w-2xl w-full animate-fade-in">
              <div className="space-y-6">
                <div className="space-y-2">
                  <h2 className="text-3xl font-semibold">
                    What Can <span className="gradient-text">ChartMaga</span> Help You With Today?
                  </h2>
                  <p className="text-muted-foreground">
                    Your intelligent AI assistant, ready to help with any task
                  </p>
                </div>

                  <div className="space-y-4">
                    {selectedImage && (
                      <div className="mb-4">
                        <div className="flex items-center space-x-2 bg-muted/50 p-2 rounded-md">
                          <img 
                            src={selectedImage.url} 
                            alt={selectedImage.name} 
                            className="w-12 h-12 object-cover rounded border"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{selectedImage.name}</p>
                            <p className="text-xs text-muted-foreground">Ready to analyze</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedImage(null)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="flex gap-2">
                        <ImageUpload 
                          onImageSelect={handleImageSelect} 
                          disabled={isProcessing}
                        />
                        <Input
                          placeholder={selectedImage ? "Ask about this image..." : "Ask anything you want..."}
                          value={inputValue}
                          onChange={(e) => setInputValue(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                          className="flex-1 bg-muted/50 border-border/50 focus:border-primary"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleVoiceInput}
                          variant={isRecording ? "destructive" : "outline"}
                          size="icon"
                          className={`shrink-0 ${isRecording ? 'animate-pulse-glow' : ''}`}
                          disabled={isProcessing}
                          title={isRecording ? "Stop recording" : "Start voice input"}
                        >
                          {isProcessing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : isRecording ? (
                            <Square className="w-4 h-4" />
                          ) : (
                            <Mic className="w-4 h-4" />
                          )}
                        </Button>
                        <Button 
                          onClick={handleSendMessage}
                          className="shrink-0 bg-gradient-primary hover:opacity-90"
                          disabled={!inputValue.trim() && !selectedImage}
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                  </div>
              </div>
            </Card>
          </div>
        ) : (
          /* Chat Messages */
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
              >
                <Card className={`max-w-[80%] p-4 ${
                  message.sender === 'user' 
                    ? 'bg-gradient-primary text-primary-foreground' 
                    : 'glass'
                }`}>
                  {message.imageUrl && (
                    <div className="mb-3">
                      <img 
                        src={message.imageUrl} 
                        alt={message.imageName || 'User uploaded image'} 
                        className="max-w-full h-auto rounded-md border max-h-48 object-cover"
                      />
                      {message.imageName && (
                        <p className={`text-xs mt-1 ${
                          message.sender === 'user' 
                            ? 'text-primary-foreground/70' 
                            : 'text-muted-foreground'
                        }`}>{message.imageName}</p>
                      )}
                    </div>
                  )}
                  {message.content && <p className="whitespace-pre-wrap">{message.content}</p>}
                  <p className={`text-xs mt-2 ${
                    message.sender === 'user' 
                      ? 'text-primary-foreground/70' 
                      : 'text-muted-foreground'
                  }`}>
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </Card>
              </div>
            ))}
          </div>
        )}

        {/* Input Area */}
        {messages.length > 0 && (
          <div className="border-t border-border/50 p-4">
            {selectedImage && (
              <div className="mb-4">
                <div className="flex items-center space-x-2 bg-muted/50 p-2 rounded-md">
                  <img 
                    src={selectedImage.url} 
                    alt={selectedImage.name} 
                    className="w-12 h-12 object-cover rounded border"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{selectedImage.name}</p>
                    <p className="text-xs text-muted-foreground">Ready to analyze</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedImage(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <ImageUpload 
                onImageSelect={handleImageSelect} 
                disabled={isProcessing}
              />
              <Input
                placeholder={selectedImage ? "Ask about this image..." : "Type your message..."}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                className="flex-1 bg-muted/50 border-border/50 focus:border-primary"
              />
              <Button
                onClick={handleVoiceInput}
                variant={isRecording ? "destructive" : "outline"}
                size="icon"
                className={isRecording ? 'animate-pulse-glow' : ''}
                disabled={isProcessing}
                title={isRecording ? "Stop recording" : "Start voice input"}
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isRecording ? (
                  <Square className="w-4 h-4" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </Button>
              <Button 
                onClick={handleSendMessage}
                className="bg-gradient-primary hover:opacity-90"
                disabled={!inputValue.trim() && !selectedImage}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;