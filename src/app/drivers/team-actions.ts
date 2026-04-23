'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { Team } from '@/types/database';

export async function getTeams() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return data as Team[];
}

export async function getActiveSeasonId(): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('seasons')
    .select('id')
    .eq('is_active', true)
    .single();

  if (error || !data) throw new Error('No active season found');
  return data.id;
}

export async function getEvents() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) throw new Error(error.message);
  return data;
}

export async function createTeam(input: {
  name: string;
  season_id: string;
  driver1_id: string;
  driver2_id: string;
  substitute_id: string | null;
  substitute_used_on_event: string | null;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('teams')
    .insert(input)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath('/drivers');
  return data as Team;
}

export async function updateTeam(
  id: string,
  input: {
    name: string;
    driver1_id: string;
    driver2_id: string;
    substitute_id: string | null;
    substitute_used_on_event: string | null;
  }
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('teams')
    .update(input)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath('/drivers');
  return data as Team;
}

export async function deleteTeam(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('teams').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/drivers');
}
