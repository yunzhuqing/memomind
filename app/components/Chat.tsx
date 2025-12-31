'use client';

import { useChat } from '@ai-sdk/react';
import { useState, useRef, useEffect } from 'react';
import type { UIMessage } from 'ai';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';

interface Model {
  id: string;
  name: string;
  provider: string;
}

interface Conversation {
  id: number;
  name: string;
  userId: number;
  usage?: string;
  s3Key?: string;
  createdTime: string;
  updatedTime: string;
}

export default function ChatComponent() {
  const [model, setModel] = useState('gpt-4o');
  const [models, setModels] = useState<Model[]>([]);
  const [input, setInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<Array<{ url: string; file: File }>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { messages, sendMessage, status, setMessages } = useChat();
  
  const isLoading = status === 'submitted' || status === 'streaming';

  // Load models and conversations on mount
  useEffect(() => {
    loadModels();
    loadConversations();
    loadUserSettings();
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Save messages when they change (debounced)
  useEffect(() => {
    if (currentConversationId && messages.length > 0) {
      const timer = setTimeout(() => {
        saveConversationMessages(currentConversationId, messages);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [messages, currentConversationId]);

  const loadModels = async () => {
    try {
      const response = await fetch('/api/models');
      if (response.ok) {
        const data = await response.json();
        setModels(data.models || []);
      }
    } catch (error) {
      console.error('Error loading models:', error);
      // Fallback to default models if API fails
      setModels([
        { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
      ]);
    }
  };

  const loadUserSettings = async () => {
    try {
      const response = await fetch('/api/user/settings');
      if (response.ok) {
        const settings = await response.json();
        if (settings.defaultModel) {
          setModel(settings.defaultModel);
        }
      }
    } catch (error) {
      console.error('Error loading user settings:', error);
    }
  };

  const updateDefaultModel = async (newModel: string) => {
    try {
      await fetch('/api/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultModel: newModel }),
      });
    } catch (error) {
      console.error('Error updating default model:', error);
    }
  };

  const loadConversations = async () => {
    try {
      const response = await fetch('/api/conversations');
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const createNewConversation = async (): Promise<number | null> => {
    try {
      setLoading(true);
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Conversation' }),
      });

      if (response.ok) {
        const newConv = await response.json();
        setConversations([newConv, ...conversations]);
        setCurrentConversationId(newConv.id);
        setMessages([]);
        toast.success('New conversation created');
        return newConv.id;
      }
      return null;
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast.error('Failed to create conversation');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const loadConversation = async (conversationId: number) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/conversations/${conversationId}/messages`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
        setCurrentConversationId(conversationId);
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
      toast.error('Failed to load conversation');
    } finally {
      setLoading(false);
    }
  };

  const saveConversationMessages = async (conversationId: number, msgs: UIMessage[]) => {
    try {
      await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: msgs }),
      });
    } catch (error) {
      console.error('Error saving messages:', error);
    }
  };

  const deleteConversation = async (conversationId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this conversation?')) {
      return;
    }

    try {
      const response = await fetch(`/api/conversations?id=${conversationId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setConversations(conversations.filter(c => c.id !== conversationId));
        if (currentConversationId === conversationId) {
          setCurrentConversationId(null);
          setMessages([]);
        }
        toast.success('Conversation deleted');
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast.error('Failed to delete conversation');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const updateConversationTitle = async (conversationId: number, firstMessage: string) => {
    try {
      const response = await fetch('/api/conversations/generate-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: firstMessage }),
      });

      if (response.ok) {
        const { title } = await response.json();
        
        // Update conversation name in database
        const updateResponse = await fetch(`/api/conversations/${conversationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: title }),
        });

        if (updateResponse.ok) {
          // Update local state
          setConversations(conversations.map(c => 
            c.id === conversationId ? { ...c, name: title } : c
          ));
        }
      }
    } catch (error) {
      console.error('Error updating conversation title:', error);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newImages: Array<{ url: string; file: File }> = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        newImages.push({ url, file });
      }
    }

    setUploadedImages([...uploadedImages, ...newImages]);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    const newImages = [...uploadedImages];
    URL.revokeObjectURL(newImages[index].url);
    newImages.splice(index, 1);
    setUploadedImages(newImages);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && uploadedImages.length === 0) || isLoading) return;
    
    const text = input;
    const isFirstMessage = messages.length === 0;
    
    // Create new conversation if none exists and get the ID directly
    let convId = currentConversationId;
    if (!convId) {
      const newConvId = await createNewConversation();
      if (!newConvId) {
        toast.error('Failed to create conversation');
        return;
      }
      convId = newConvId;
    }
    
    setInput('');

    // Upload images to S3 and get URLs
    const imageUrls: string[] = [];
    const imageDataForAI: Array<{ type: 'image'; image: string }> = [];
    
    for (const img of uploadedImages) {
      try {
        const formData = new FormData();
        formData.append('file', img.file);
        
        const response = await fetch(`/api/conversations/${convId}/upload-image`, {
          method: 'POST',
          body: formData,
        });
        
        if (response.ok) {
          const data = await response.json();
          imageUrls.push(data.s3Key);
          // Use presigned URL from S3
          imageDataForAI.push({
            type: 'image',
            image: data.url, // Use presigned URL instead of base64
          });
        }
      } catch (error) {
        console.error('Error uploading image:', error);
        toast.error('Failed to upload image');
      }
    }

    // Clear uploaded images
    uploadedImages.forEach(img => URL.revokeObjectURL(img.url));
    setUploadedImages([]);

    // Build message content parts
    const contentParts: any[] = [];
    
    // Add text part if present
    if (text.trim()) {
      contentParts.push({
        type: 'text',
        text: text
      });
    }
    
    // Add image parts
    for (const imgData of imageDataForAI) {
      contentParts.push(imgData);
    }
    
    // Create message object
    const userMessage: any = {
      role: 'user',
      parts: contentParts
    };
    
    // Add image URLs to data for storage
    if (imageUrls.length > 0) {
      userMessage.data = { imageUrls };
    }
    
    await sendMessage(userMessage, {
      body: { 
        model,
        conversationId: convId
      }
    });

    // Generate and update title after first message
    if (isFirstMessage && convId) {
      // Wait a bit for the conversation to be created
      setTimeout(() => {
        if (convId) {
          updateConversationTitle(convId, text || 'Image analysis');
        }
      }, 1000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex h-full bg-white">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 bg-gray-50 border-r border-gray-200 flex flex-col overflow-hidden`}>
        <div className="p-4 border-b border-gray-200">
          <button 
            onClick={createNewConversation}
            disabled={loading}
            className="w-full px-4 py-2 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 text-gray-700 disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Chat
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2">
          <div className="space-y-1">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => loadConversation(conv.id)}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 rounded-lg transition-colors group flex items-center justify-between text-gray-700 ${
                  currentConversationId === conv.id ? 'bg-gray-100' : ''
                }`}
              >
                <div className="flex-1 truncate">
                  <div className="truncate font-medium">{conv.name}</div>
                  <div className="text-xs text-gray-500">{formatDate(conv.updatedTime)}</div>
                </div>
                <button 
                  onClick={(e) => deleteConversation(conv.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between bg-white border-b border-gray-200">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-700"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 hidden sm:inline">Model:</span>
            <select
              value={model}
              onChange={(e) => {
                const newModel = e.target.value;
                setModel(newModel);
                updateDefaultModel(newModel);
              }}
              className="bg-gray-50 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
            >
              {models.map((m: Model) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto bg-white">
          <div className="max-w-3xl mx-auto px-4 py-6">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center">
                <div className="mb-8">
                  <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <h2 className="text-3xl font-semibold text-gray-700 mb-2">How can I help you today?</h2>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((m: UIMessage) => {
                  // Extract text content from UIMessage
                  let messageText = '';
                  const imageParts: any[] = [];
                  
                  if (m.parts && Array.isArray(m.parts) && m.parts.length > 0) {
                    messageText = m.parts
                      .filter((part: any) => part.type === 'text')
                      .map((part: any) => part.text || '')
                      .join('');
                    
                    // Extract image parts
                    imageParts.push(...m.parts.filter((part: any) => part.type === 'image'));
                  }
                  
                  if (!messageText && (m as any).content) {
                    messageText = (m as any).content;
                  }

                  return (
                    <div key={m.id} className="group">
                      <div className={`flex gap-4 ${m.role === 'user' ? 'bg-white' : 'bg-gray-50'} -mx-4 px-4 py-6`}>
                        {/* Avatar */}
                        <div className="flex-shrink-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold ${
                            m.role === 'user' ? 'bg-purple-600' : 'bg-green-600'
                          }`}>
                            {m.role === 'user' ? 'U' : 'AI'}
                          </div>
                        </div>
                        
                        {/* Message Content */}
                        <div className="flex-1 space-y-2 overflow-hidden">
                          <div className="font-semibold text-gray-800">
                            {m.role === 'user' ? 'You' : 'Assistant'}
                          </div>
                          
                          {/* Display images if present */}
                          {imageParts.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">
                              {imageParts.map((imgPart: any, idx: number) => (
                                <img 
                                  key={idx}
                                  src={imgPart.image} 
                                  alt={`Image ${idx + 1}`}
                                  className="max-w-[200px] max-h-[200px] rounded-lg border border-gray-300 object-contain hover:max-w-full hover:max-h-[500px] transition-all duration-300 cursor-zoom-in"
                                />
                              ))}
                            </div>
                          )}
                          
                          <div className="prose prose-sm max-w-none text-gray-700">
                            {m.role === 'user' ? (
                              <div className="whitespace-pre-wrap break-words">{messageText}</div>
                            ) : (
                              <ReactMarkdown
                                components={{
                                  code: ({ node, inline, className, children, ...props }: any) => {
                                    return inline ? (
                                      <code className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono" {...props}>
                                        {children}
                                      </code>
                                    ) : (
                                      <code className="block bg-gray-100 p-3 rounded-lg overflow-x-auto text-sm font-mono" {...props}>
                                        {children}
                                      </code>
                                    );
                                  },
                                  pre: ({ children }: any) => <div className="my-2">{children}</div>,
                                  p: ({ children }: any) => <p className="mb-2 last:mb-0">{children}</p>,
                                  ul: ({ children }: any) => <ul className="list-disc list-inside mb-2">{children}</ul>,
                                  ol: ({ children }: any) => <ol className="list-decimal list-inside mb-2">{children}</ol>,
                                  li: ({ children }: any) => <li className="mb-1">{children}</li>,
                                  h1: ({ children }: any) => <h1 className="text-2xl font-bold mb-2 mt-4">{children}</h1>,
                                  h2: ({ children }: any) => <h2 className="text-xl font-bold mb-2 mt-3">{children}</h2>,
                                  h3: ({ children }: any) => <h3 className="text-lg font-bold mb-2 mt-2">{children}</h3>,
                                  blockquote: ({ children }: any) => (
                                    <blockquote className="border-l-4 border-gray-300 pl-4 italic my-2">{children}</blockquote>
                                  ),
                                  a: ({ children, href }: any) => (
                                    <a href={href} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                                      {children}
                                    </a>
                                  ),
                                  img: ({ src, alt }: any) => (
                                    <img 
                                      src={src} 
                                      alt={alt} 
                                      className="max-w-[200px] max-h-[200px] rounded-lg border border-gray-300 object-contain hover:max-w-full hover:max-h-[500px] transition-all duration-300 cursor-zoom-in" 
                                    />
                                  ),
                                }}
                              >
                                {messageText || (isLoading ? '...' : '')}
                              </ReactMarkdown>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {/* Loading indicator */}
                {isLoading && (
                  <div className="group">
                    <div className="flex gap-4 bg-gray-50 -mx-4 px-4 py-6">
                      {/* Avatar */}
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold bg-green-600">
                          AI
                        </div>
                      </div>
                      
                      {/* Loading Content */}
                      <div className="flex-1 space-y-2 overflow-hidden">
                        <div className="font-semibold text-gray-800">Assistant</div>
                        <div className="flex items-center gap-2">
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                          <span className="text-sm text-gray-500">Thinking...</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 pt-4 pb-4">
          <div className="max-w-3xl mx-auto px-4">
            {/* Image Preview */}
            {uploadedImages.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {uploadedImages.map((img, index) => (
                  <div key={index} className="relative group">
                    <img 
                      src={img.url} 
                      alt={`Upload ${index + 1}`} 
                      className="h-20 w-20 object-cover rounded-lg border border-gray-300"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="relative">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
              <textarea
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Send a message..."
                rows={1}
                className="w-full resize-none rounded-2xl border border-gray-300 bg-white px-4 py-3 pl-12 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm text-gray-900 placeholder-gray-400"
                style={{ minHeight: '52px', maxHeight: '200px' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 200) + 'px';
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute left-2 bottom-2 p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-all"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
              <button
                type="submit"
                disabled={(!input.trim() && uploadedImages.length === 0) || isLoading}
                className="absolute right-2 bottom-2 p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              </button>
            </form>
            <p className="text-xs text-center text-gray-500 mt-2">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
