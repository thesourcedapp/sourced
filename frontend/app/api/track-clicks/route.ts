import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role for admin access
);

export async function POST(request: NextRequest) {
  try {
    const { itemId, itemType } = await request.json();

    if (!itemId || !itemType) {
      return NextResponse.json(
        { error: 'Missing itemId or itemType' },
        { status: 400 }
      );
    }

    const tableName = itemType === 'catalog' ? 'catalog_items' : 'feed_post_items';

    // Increment click count and update last clicked timestamp
    const { error } = await supabase
      .from(tableName)
      .update({
        click_count: supabase.raw('click_count + 1'),
        last_clicked_at: new Date().toISOString()
      })
      .eq('id', itemId);

    if (error) {
      console.error('Error tracking click:', error);
      return NextResponse.json(
        { error: 'Failed to track click' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}