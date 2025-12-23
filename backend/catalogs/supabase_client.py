import os
from supabase import create_client, Client
from backend.config import NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY

SUPABASE_URL= NEXT_PUBLIC_SUPABASE_URL
SUPABASE_KEY=NEXT_PUBLIC_SUPABASE_ANON_KEY

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
