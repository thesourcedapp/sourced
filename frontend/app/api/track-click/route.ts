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
    const body = await request.json();
    const { itemId, itemType, userId } = body;

    // Validate inputs
    if (!itemId || !itemType || !userId) {
      return NextResponse.json(
        { error: 'Missing fields', received: { itemId, itemType, userId } },
        { status: 400 }
      );
    }

    // Determine table name
    const tableName = itemType === 'catalog' ? 'catalog_items' : 'feed_post_items';

    // Call the function
    const { data, error } = await supabase.rpc('increment_click_count', {
      p_table_name: tableName,
      p_item_id: itemId,
      p_user_id: userId,
    });

    if (error) {
      console.error('Supabase RPC Error:', error);
      return NextResponse.json(
        {
          error: 'Database error',
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        },
        { status: 500 }
      );
    }

    // Success
    return NextResponse.json({
      success: true,
      clicks: data && data.length > 0 ? data[0] : null,
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      {
        error: 'Server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}