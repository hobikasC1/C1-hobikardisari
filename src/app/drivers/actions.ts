'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { Driver, DriverClass } from '@/types/database';

export async function getDrivers() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .order('last_name', { ascending: true });

  if (error) throw new Error(error.message);
  return data as Driver[];
}

export async function createDriver(input: {
  first_name: string;
  last_name: string;
  dob: string | null;
  weight: number | null;
  class: DriverClass | null;
  is_licensed?: boolean;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('drivers')
    .insert(input)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath('/drivers');
  return data as Driver;
}

export async function updateDriver(
  id: string,
  input: {
    first_name: string;
    last_name: string;
    dob: string | null;
    weight: number | null;
    class: DriverClass | null;
    is_licensed?: boolean;
  }
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('drivers')
    .update(input)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath('/drivers');
  return data as Driver;
}

export async function deleteDriver(id: string) {
  const supabase = await createClient();

  // First remove from any teams
  await supabase.from('teams').delete().or(`driver1_id.eq.${id},driver2_id.eq.${id}`);
  // Clear substitute references
  await supabase.from('teams').update({ substitute_id: null }).eq('substitute_id', id);

  const { error } = await supabase.from('drivers').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/drivers');
}

export async function deleteAllDrivers() {
  const supabase = await createClient();

  // Delete teams first (FK constraint)
  const { error: teamsError } = await supabase.from('teams').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (teamsError) throw new Error(teamsError.message);

  // Delete event entries
  await supabase.from('event_entries').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const { error } = await supabase.from('drivers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) throw new Error(error.message);
  revalidatePath('/drivers');
}
