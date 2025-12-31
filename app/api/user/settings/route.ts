import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/lib/database';
import { validateUserAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await validateUserAuth(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await Database.getUserSettings(parseInt(user.id));
    
    // Return default settings if none exist
    if (!settings) {
      return NextResponse.json({
        userId: parseInt(user.id),
        language: 'en',
        defaultModel: 'gpt-4o'
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching user settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user settings' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await validateUserAuth(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    const { language, defaultModel } = data;

    if (!language && !defaultModel) {
      return NextResponse.json(
        { error: 'No settings provided to update' },
        { status: 400 }
      );
    }

    const settings = await Database.updateUserSettings(parseInt(user.id), {
      ...(language && { language }),
      ...(defaultModel && { defaultModel }),
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error updating user settings:', error);
    return NextResponse.json(
      { error: 'Failed to update user settings' },
      { status: 500 }
    );
  }
}
