import { createOpenAI } from '@ai-sdk/openai';
import { streamText, convertToCoreMessages } from 'ai';

const openai = createOpenAI({
  // custom settings, e.g.
  baseURL: process.env.OPENAI_BASE_URL,
  apiKey: process.env.OPENAI_API_KEY,
});

export const maxDuration = 30;

// Helper function to convert URL to base64
async function urlToBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    
    // Get content type from response headers
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error('Error converting URL to base64:', error);
    throw error;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, model } = body;

    // Convert UIMessage[] to CoreMessage[] with proper image handling
    const coreMessages = await Promise.all(messages.map(async (msg: any) => {
      if (msg.parts && Array.isArray(msg.parts)) {
        // Handle messages with parts (text + images)
        const content = await Promise.all(msg.parts.map(async (part: any) => {
          if (part.type === 'text') {
            return { type: 'text', text: part.text };
          } else if (part.type === 'image') {
            // Convert URL to base64 if it's a URL
            const imageData = part.image.startsWith('http') 
              ? await urlToBase64(part.image)
              : part.image;
            return { type: 'image', image: imageData };
          }
          return part;
        }));
        
        return {
          role: msg.role,
          content: content
        };
      } else if (msg.content) {
        // Handle simple text messages
        return {
          role: msg.role,
          content: msg.content
        };
      }
      return msg;
    }));

    const result = streamText({
      model: openai.chat(model || 'gpt-4o'),
      messages: coreMessages,
    });

    return result.toUIMessageStreamResponse();
  } catch (error: any) {
    console.error('Chat API Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error', details: error }), { status: 500 });
  }
}
