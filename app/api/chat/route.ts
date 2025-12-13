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

    // Use convertToCoreMessages to properly convert UIMessage[] to CoreMessage[]
    const coreMessages = convertToCoreMessages(messages);

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
