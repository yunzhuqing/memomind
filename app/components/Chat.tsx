'use client';

import { useChat } from '@ai-sdk/react';
import { useState, useRef, useEffect } from 'react';
import type { UIMessage } from 'ai';
import toast from 'react-hot-toast';

const MODELS = [
  { id: 'gpt-4o', name: 'GPT-4o' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
];

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
  const [input, setInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { messages, sendMessage, status, setMessages } = useChat();
  
  const isLoading = status === 'submitted' || status === 'streaming';

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
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

  const createNewConversation = async () => {
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
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast.error('Failed to create conversation');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    // Create new conversation if none exists
    if (!currentConversationId) {
      await createNewConversation();
    }
    
    const text = input;
    setInput('');
    
    await sendMessage({
      text,
    }, {
      body: { model }
    });
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

        <div className="p-4 border-t border-gray-200">
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 flex items-center gap-3 bg-white">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-700"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
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
                  
                  if (m.parts && Array.isArray(m.parts) && m.parts.length > 0) {
                    messageText = m.parts
                      .filter((part: any) => part.type === 'text')
                      .map((part: any) => part.text || '')
                      .join('');
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
                          <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap break-words">
                            {messageText || (isLoading && m.role === 'assistant' ? '...' : '')}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 pt-4 pb-4">
          <div className="max-w-3xl mx-auto px-4">
            <form onSubmit={handleSubmit} className="relative">
              <textarea
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Send a message..."
                rows={1}
                className="w-full resize-none rounded-2xl border border-gray-300 bg-white px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm text-gray-900 placeholder-gray-400"
                style={{ minHeight: '52px', maxHeight: '200px' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 200) + 'px';
                }}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
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
