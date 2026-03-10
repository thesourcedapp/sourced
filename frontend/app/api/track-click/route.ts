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
    console.log('🔵 Received body:', JSON.stringify(body));

    const { itemId, itemType, userId } = body;

    if (!itemId || !itemType || !userId) {
      console.error('❌ Missing fields:', { itemId: !!itemId, itemType: !!itemType, userId: !!userId });
      return NextResponse.json(
        { error: 'Missing required fields', received: { itemId: !!itemId, itemType: !!itemType, userId: !!userId } },
        { status: 400 }
      );
    }

    const tableName = itemType === 'catalog' ? 'catalog_items' : 'feed_post_items';
    console.log('🔧 Calling RPC with:', { tableName, itemId, userId });

    // Call the increment_click_count function
    const { data, error } = await supabase.rpc(
      'increment_click_count',
      {
        table_name: tableName,
        item_id: itemId,
        user_id_param: userId,
      }
    );

    if (error) {
      console.error('❌ RPC Error:', JSON.stringify(error));
      return NextResponse.json(
        {
          error: 'Failed to track click',
          details: error.message,
          code: error.code,
          hint: error.hint,
        },
        { status: 500 }
      );
    }

    console.log('✅ RPC Success:', JSON.stringify(data));

    return NextResponse.json({
      success: true,
      data: data,
    });

  } catch (error) {
    console.error('❌ Catch block error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}