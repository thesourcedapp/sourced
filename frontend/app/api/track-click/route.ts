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
        { error: 'Missing fields' },
        { status: 400 }
      );
    }

    // Determine table name
    const tableName = itemType === 'catalog' ? 'catalog_items' : 'feed_post_items';

    // 1. TRACK CLICK (this must always work)
    const { data: clickData, error: clickError } = await supabase.rpc('increment_click_count', {
      p_table_name: tableName,
      p_item_id: itemId,
      p_user_id: userId,
    });

    if (clickError) {
      console.error('Click tracking failed:', clickError);
      return NextResponse.json(
        { error: 'Click tracking failed', details: clickError.message },
        { status: 500 }
      );
    }

    // 2. TRY TO ADD EARNINGS (don't fail if this breaks)
    let earningsAdded = false;
    let earningsCents = 0;

    try {
      // Get item verification status
      const { data: item } = await supabase
        .from(tableName)
        .select('is_verified, is_monetized')
        .eq('id', itemId)
        .single();

      if (item && (item.is_verified || item.is_monetized)) {
        // Get owner ID
        let ownerId = null;
        if (itemType === 'catalog') {
          const { data: catalogData } = await supabase
            .from('catalog_items')
            .select('catalog_id, catalogs!inner(owner_id)')
            .eq('id', itemId)
            .single();
          ownerId = catalogData?.catalogs?.owner_id;
        } else {
          const { data: feedData } = await supabase
            .from('feed_post_items')
            .select('post_id, feed_posts!inner(user_id)')
            .eq('id', itemId)
            .single();
          ownerId = feedData?.feed_posts?.user_id;
        }

        if (ownerId) {
          // Calculate earnings (tiered)
          if (item.is_monetized) {
            earningsCents = Math.floor(Math.random() * 8) + 5; // 5-12 cents
          } else if (item.is_verified) {
            earningsCents = Math.floor(Math.random() * 3) + 1; // 1-3 cents
          }

          // Add earnings
          await supabase.rpc('add_creator_earnings', {
            p_user_id: ownerId,
            p_item_id: itemId,
            p_item_type: itemType,
            p_amount_cents: earningsCents,
            p_description: item.is_monetized ? 'Affiliate click' : 'Verified click',
          });

          earningsAdded = true;
        }
      }
    } catch (err) {
      // Log but don't fail the request
      console.error('Earnings failed (non-critical):', err);
    }

    // Return success with click data
    return NextResponse.json({
      success: true,
      clicks: clickData?.[0] || null,
      earnings_added: earningsAdded,
      earnings_cents: earningsCents,
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Server error', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}