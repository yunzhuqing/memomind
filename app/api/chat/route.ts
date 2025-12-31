import { createOpenAI } from '@ai-sdk/openai';
import { streamText, convertToCoreMessages, createUIMessageStreamResponse } from 'ai';
import { s3Client, BUCKET_NAME } from '@/lib/s3';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import Database, { getDataSource } from '@/lib/database';
import { generateThumbnail } from '@/lib/thumbnailGenerator';
import { Directory } from '@/lib/entities/Directory';

const openai = createOpenAI({
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
    const { messages, model, conversationId } = body;

    // Check if using gemini-3-pro-image-preview model
    const isImageModel = model === 'gemini-3-pro-image-preview';

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
          } else if (part.type === 'step-start') {
            // Skip step-start parts from assistant messages
            return null;
          }
          return part;
        }));
        
        // Filter out null values (step-start parts)
        const filteredContent = content.filter(c => c !== null);
        
        return {
          role: msg.role,
          content: filteredContent.length > 0 ? filteredContent : [{ type: 'text', text: '' }]
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

    // For image models, use /v1/images/edits endpoint
    if (isImageModel) {
      // Check if conversationId exists
      if (!conversationId) {
        return new Response(JSON.stringify({ 
          error: 'Conversation ID is required for image models. Please create a conversation first.' 
        }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get userId from request headers
      const userId = req.headers.get('x-user-id') || '1';
      
      // Extract text and images from all messages to provide context
      let prompt = '';
      const imageUrls: string[] = [];
      
      for (const msg of coreMessages) {
        const roleLabel = msg.role === 'user' ? 'User' : 'Model';
        
        if (Array.isArray(msg.content)) {
          const textParts = msg.content.filter((part: any) => part.type === 'text');
          const imageParts = msg.content.filter((part: any) => part.type === 'image');
          
          if (textParts.length > 0) {
            const text = textParts.map((p: any) => p.text).join('\n');
            prompt += `${roleLabel}: ${text}\n`;

            // Extract image URLs from markdown image links in text
            // Pattern: ![alt](/api/files/download?fileId=123&...)
            const markdownImageRegex = /!\[.*?\]\(\/api\/files\/download\?fileId=(\d+)[^)]*\)/g;
            let match;
            while ((match = markdownImageRegex.exec(text)) !== null) {
              const fileId = parseInt(match[1]);
              try {
                // Get file from database
                const file = await Database.findFileById(fileId, parseInt(userId));
                if (file && file.filePath) {
                  // Get signed URL for S3
                  const command = new GetObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: file.filePath,
                  });
                  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
                  imageUrls.push(signedUrl);
                }
              } catch (error) {
                console.error(`Error resolving image URL for fileId ${fileId}:`, error);
              }
            }
          }
          
          // Collect all explicitly attached image URLs
          for (const imgPart of imageParts) {
            if (imgPart.image) {
              imageUrls.push(imgPart.image);
            }
          }
        } else if (typeof msg.content === 'string') {
          prompt += `${roleLabel}: ${msg.content}\n`;
          
          // Extract image URLs from markdown image links in text content string
          const markdownImageRegex = /!\[.*?\]\(\/api\/files\/download\?fileId=(\d+)[^)]*\)/g;
          let match;
          while ((match = markdownImageRegex.exec(msg.content)) !== null) {
            const fileId = parseInt(match[1]);
            try {
              // Get file from database
              const file = await Database.findFileById(fileId, parseInt(userId));
              if (file && file.filePath) {
                // Get signed URL for S3
                const command = new GetObjectCommand({
                  Bucket: BUCKET_NAME,
                  Key: file.filePath,
                });
                const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
                imageUrls.push(signedUrl);
              }
            } catch (error) {
              console.error(`Error resolving image URL for fileId ${fileId}:`, error);
            }
          }
        }
      }

      if (!prompt) {
        throw new Error('No prompt found in messages');
      }

      // Call the /v1/images/edits endpoint (OPENAI_BASE_URL already includes /v1)
      const imageEditResponse = await fetch(`${process.env.OPENAI_BASE_URL}/images/edits`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          image: imageUrls,
          prompt: prompt,
          n: 1,
          response_format: 'b64_json',
        }),
      });

      if (!imageEditResponse.ok) {
        const errorData = await imageEditResponse.json();
        throw new Error(`Image edit API error: ${JSON.stringify(errorData)}`);
      }

      const imageEditData = await imageEditResponse.json();
      
      // Process the response
      if (imageEditData.data && imageEditData.data.length > 0) {
        const b64Json = imageEditData.data[0].b64_json;
        const outputFormat = imageEditData.output_format || 'png';
        
        // Convert base64 to buffer
        const imageBuffer = Buffer.from(b64Json, 'base64');
        
        // Generate S3 key with conversationId (conversationId is guaranteed to exist at this point)
        const timestamp = Date.now();
        const filename = `generated-image-${timestamp}.${outputFormat}`;
        const s3Key = `users/${userId}/conversations/${conversationId}/${filename}`;
        
        // Upload to S3
        await s3Client.send(new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: s3Key,
          Body: imageBuffer,
          ContentType: `image/${outputFormat}`,
        }));
        
        // Generate thumbnail
        let thumbnailKey = null;
        try {
          const thumbnailResult = await generateThumbnail(
            imageBuffer,
            filename,
            'image',
            s3Key,
            userId.toString()
          );
          if (thumbnailResult) {
            thumbnailKey = thumbnailResult.thumbnailKey;
          }
        } catch (error) {
          console.error('Failed to generate thumbnail for AI image:', error);
        }

        // Ensure conversation directory exists
        const dataSource = await getDataSource();
        const directoryRepo = dataSource.getRepository(Directory);
        const conversationPath = `/conversations/${conversationId}`;
        
        const existingDir = await directoryRepo.findOne({
          where: { userId: parseInt(userId), path: conversationPath },
        });

        if (!existingDir) {
          // Ensure parent conversations directory exists
          const conversationsPath = '/conversations';
          const parentDir = await directoryRepo.findOne({
            where: { userId: parseInt(userId), path: conversationsPath },
          });

          if (!parentDir) {
            const directory = directoryRepo.create({
              userId: parseInt(userId),
              name: 'conversations',
              path: conversationsPath,
              parentPath: '/',
            });
            await directoryRepo.save(directory);
          }

          // Create conversation directory
          const directory = directoryRepo.create({
            userId: parseInt(userId),
            name: conversationId.toString(),
            path: conversationPath,
            parentPath: conversationsPath,
          });
          await directoryRepo.save(directory);
        }

        // Save file metadata to database
        const savedFile = await Database.createFile({
          userId: parseInt(userId),
          filename,
          originalFilename: filename,
          filePath: s3Key,
          fileType: 'image',
          fileSize: imageBuffer.length,
          mimeType: `image/${outputFormat}`,
          directoryPath: conversationPath,
          thumbnailKey: thumbnailKey || undefined,
        });

        // Use internal download URL instead of S3 presigned URL
        // This ensures the image is accessed through the application's authentication and logic
        const imageUrl = `/api/files/download?fileId=${savedFile.id}&userId=${userId}`;
        
        // Return image URL using stream compatible with ai sdk (UI Message Stream Protocol)
        // We use a manual stream here instead of streamText to control the output format
        const stream = new ReadableStream({
          start(controller) {
            const text = `![Generated Image](${imageUrl})`;
            const textId = `t-${Date.now()}`;

            controller.enqueue({ type: 'text-start', id: textId });
            controller.enqueue({ type: 'text-delta', id: textId, delta: text });
            controller.enqueue({ type: 'text-end', id: textId });
            controller.enqueue({ type: 'finish', finishReason: 'stop' });
            
            controller.close();
          },
        });

        return createUIMessageStreamResponse({ stream });
      } else {
        throw new Error('No image data returned from API');
      }
    } else {
      // Standard text model
      const result = streamText({
        model: openai.chat(model || 'gpt-4o'),
        messages: coreMessages,
      });

      return result.toUIMessageStreamResponse();
    }
  } catch (error: any) {
    console.error('Chat API Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error', details: error }), { status: 500 });
  }
}
