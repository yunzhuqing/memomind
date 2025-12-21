
import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

// Mock OpenAI
const openai = createOpenAI({
  apiKey: 'test',
});

async function test() {
  try {
    const result = streamText({
      model: openai.chat('gpt-4o'),
      messages: [{ role: 'user', content: 'hi' }],
    });
    
    const response = result.toUIMessageStreamResponse();
    console.log('Headers:', response.headers);
    
    const reader = response.body?.getReader();
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        console.log('Chunk:', new TextDecoder().decode(value));
      }
    }
  } catch (e) {
    console.error(e);
  }
}

test();
