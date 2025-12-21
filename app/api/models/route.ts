import { NextResponse } from 'next/server';

// GET /api/models - Get available chat models
export async function GET() {
  try {
    const models = [
        { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', provider: 'anthropic' },
        { id: 'gemini-3-pro-preview', name: 'Gemini 3 pro preview', provider: 'gemini' },
        { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro Image Preview', provider: 'gemini' },
        { id: 'gpt-5.2', name: 'GPT-5.2', provider: 'openai' },
        { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai' },
      
    ];

    return NextResponse.json({ models });
  } catch (error: any) {
    console.error('Error fetching models:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
