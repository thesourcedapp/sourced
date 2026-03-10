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

    console.log('📥 Track click request:', { itemId, itemType, userId });

    if (!itemId || !itemType) {
      console.error('❌ Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: itemId and itemType' },
        { status: 400 }
      );
    }

    // Call increment_click_count with all 3 params (userId can be null)
    console.log('🔧 Calling increment_click_count...');
    const { data: clickData, error: clickError } = await supabase.rpc(
      'increment_click_count',
      {
        table_name: itemType === 'catalog' ? 'catalog_items' : 'feed_post_items',
        item_id: itemId,
        user_id_param: userId || null,
      }
    );

    if (clickError) {
      console.error('❌ Click tracking error:', clickError);
      return NextResponse.json(
        { error: 'Failed to track click', details: clickError.message },
        { status: 500 }
      );
    }

    console.log('✅ Click tracked:', clickData);

    // Return success immediately - don't worry about earnings yet
    return NextResponse.json({
      success: true,
      total_clicks: clickData?.[0]?.total_clicks || 0,
      unique_clicks: clickData?.[0]?.unique_clicks || 0,
      is_new_unique: clickData?.[0]?.is_new_unique || false,
    });

  } catch (error) {
    console.error('❌ Track click error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}