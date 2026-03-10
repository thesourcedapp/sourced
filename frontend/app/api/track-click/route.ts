import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function POST(request: NextRequest) {
  try {
    const { itemId, itemType, userId } = await request.json();

    if (!itemId || !itemType || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Call the original increment_click_count function
    const { data, error } = await supabase.rpc(
      'increment_click_count',
      {
        table_name: itemType === 'catalog' ? 'catalog_items' : 'feed_post_items',
        item_id: itemId,
        user_id_param: userId,
      }
    );

    if (error) {
      console.error('Error tracking click:', error);
      return NextResponse.json(
        { error: 'Failed to track click' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data,
    });

  } catch (error) {
    console.error('Track click error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}