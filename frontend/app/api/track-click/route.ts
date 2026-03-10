import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { itemId, itemType, userId } = await request.json();

    if (!itemId || !itemType) {
      return NextResponse.json(
        { error: 'Missing itemId or itemType' },
        { status: 400 }
      );
    }

    const tableName = itemType === 'catalog' ? 'catalog_items' : 'feed_post_items';

    const { data, error } = await supabase.rpc('increment_click_count', {
      table_name: tableName,
      item_id: itemId,
      user_id: userId || null
    });

    if (error) {
      console.error('Error tracking click:', error);
      return NextResponse.json(
        { error: 'Failed to track click' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      total_clicks: data.total_clicks,
      unique_clicks: data.unique_clicks,
      is_new_unique: data.is_new_unique
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}