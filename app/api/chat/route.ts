import { createOpenAI } from '@ai-sdk/openai';
import { streamText, convertToCoreMessages } from 'ai';

const openai = createOpenAI({
  // custom settings, e.g.
  baseURL: process.env.OPENAI_BASE_URL,
  apiKey: process.env.OPENAI_API_KEY,
});

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, model } = body;

    // Convert UIMessage[] to CoreMessage[] with proper image handling
    const coreMessages = messages.map((msg: any) => {
      if (msg.parts && Array.isArray(msg.parts)) {
        // Handle messages with parts (text + images)
        const content = msg.parts.map((part: any) => {
          if (part.type === 'text') {
            return { type: 'text', text: part.text };
          } else if (part.type === 'image') {
            return { type: 'image', image: part.image };
          }
          return part;
        });
        
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
    });

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
