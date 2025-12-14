import { NextRequest, NextResponse } from 'next/server';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { AUTH_HEADERS } from '@/lib/constants';

const openai = createOpenAI({
  baseURL: process.env.OPENAI_BASE_URL,
  apiKey: process.env.OPENAI_API_KEY,
});

// POST /api/conversations/generate-title - Generate a title for a conversation based on the first message
export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get(AUTH_HEADERS.USER_ID);
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { message } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Generate a concise title using AI
    const result = await generateText({
      model: openai.chat('gpt-4o'),
      prompt: `Generate a concise, descriptive title (maximum 6 words) for a conversation that starts with this message: "${message}". Only return the title, nothing else.`,
    });

    const title = result.text.trim().replace(/^["']|["']$/g, ''); // Remove quotes if present

    return NextResponse.json({ title });
  } catch (error: any) {
    console.error('Error generating title:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
