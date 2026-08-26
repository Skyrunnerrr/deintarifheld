import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../../lib/supabase/server.js';

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  } catch {
    /* fail closed — still clear client redirect */
  }
  return NextResponse.json({ ok: true, code: 'SIGNED_OUT' });
}
