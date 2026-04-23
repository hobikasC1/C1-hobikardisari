'use server';

import { createClient } from '@/lib/supabase/server';
import type { Event, EventInsert } from '@/types/database';

export async function getEvents(): Promise<Event[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getActiveSeasonId(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('seasons')
    .select('id')
    .eq('is_active', true)
    .single();

  if (error) return null;
  return data?.id ?? null;
}

export async function createEvent(input: EventInsert): Promise<Event> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('events')
    .insert(input)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateEvent(
  id: string,
  input: Partial<Omit<EventInsert, 'season_id'>>
): Promise<Event> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('events')
    .update(input)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteEvent(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}
