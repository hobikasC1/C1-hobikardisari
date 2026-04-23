'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Driver, Team, DriverClass, Event as DbEvent } from '@/types/database';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import PageLayout from '@/components/PageLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Users, UserPlus, Edit, Trash2, Shield, Search } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';

import { getDrivers, createDriver, updateDriver, deleteDriver, deleteAllDrivers } from './actions';
import { getTeams, getActiveSeasonId, getEvents, createTeam, updateTeam, deleteTeam } from './team-actions';

// ─── Schemas ────────────────────────────────────────────────

const driverFormSchema = z.object({
  first_name: z.string().min(1, 'Eesnimi on kohustuslik.'),
  last_name: z.string().min(1, 'Perekonnanimi on kohustuslik.'),
  dob: z.string().optional().nullable(),
  weight: z.coerce.number().positive('Kaal peab olema positiivne.').optional().nullable(),
  class: z.enum(['Junior', 'Standard', 'Heavy']).optional().nullable(),
  is_licensed: z.boolean().optional(),
});
type DriverFormValues = z.infer<typeof driverFormSchema>;

const teamFormSchema = z.object({
  name: z.string().min(1, 'Meeskonna nimi on kohustuslik.'),
  driver1_id: z.string().min(1, 'Vali 1. sõitja.'),
  driver2_id: z.string().min(1, 'Vali 2. sõitja.'),
  substitute_id: z.string().optional().nullable(),
  substitute_used_on_event: z.string().optional().nullable(),
}).refine(d => d.driver1_id !== d.driver2_id, {
  message: 'Sõitjad peavad olema erinevad.',
  path: ['driver2_id'],
}).refine(d => !d.substitute_id || (d.substitute_id !== d.driver1_id && d.substitute_id !== d.driver2_id), {
  message: 'Asendussõitja peab olema erinev põhisõitjatest.',
  path: ['substitute_id'],
});
type TeamFormValues = z.infer<typeof teamFormSchema>;

// ─── Helpers ────────────────────────────────────────────────

function calculateAge(dob: string | null): number | null {
  if (!dob) return null;
  const date = new Date(dob);
  if (isNaN(date.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const m = today.getMonth() - date.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < date.getDate())) age--;
  return age;
}

function formatDob(dob: string | null): string {
  if (!dob) return 'N/A';
  const d = new Date(dob);
  if (isNaN(d.getTime())) return dob;
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

// ─── Page ───────────────────────────────────────────────────

export default function DriversAndTeamsPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [events, setEvents] = useState<DbEvent[]>([]);
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isDriverFormOpen, setIsDriverFormOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [isTeamFormOpen, setIsTeamFormOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

  const [driver1Search, setDriver1Search] = useState('');
  const [driver2Search, setDriver2Search] = useState('');
  const [substituteSearch, setSubstituteSearch] = useState('');

  const { toast } = useToast();

  const driverMap = useMemo(() => new Map(drivers.map(d => [d.id, `${d.first_name} ${d.last_name}`])), [drivers]);

  // ─── Data loading ───────────────────────────────────────

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [driversData, teamsData, sid, eventsData] = await Promise.all([
        getDrivers(),
        getTeams(),
        getActiveSeasonId(),
        getEvents(),
      ]);
      setDrivers(driversData);
      setTeams(teamsData);
      setSeasonId(sid);
      setEvents(eventsData);
    } catch (err) {
      console.error(err);
      toast({ title: 'Viga', description: 'Andmete laadimine ebaõnnestus.', variant: 'destructive' });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Driver form ────────────────────────────────────────

  const driverForm = useForm<DriverFormValues>({
    resolver: zodResolver(driverFormSchema),
    defaultValues: { first_name: '', last_name: '', dob: null, weight: null, class: null, is_licensed: false },
  });

  useEffect(() => {
    if (editingDriver) {
      driverForm.reset({
        first_name: editingDriver.first_name,
        last_name: editingDriver.last_name,
        dob: editingDriver.dob,
        weight: editingDriver.weight,
        class: editingDriver.class,
        is_licensed: editingDriver.is_licensed,
      });
    } else {
      driverForm.reset({ first_name: '', last_name: '', dob: null, weight: null, class: null, is_licensed: false });
    }
  }, [editingDriver, driverForm]);

  useEffect(() => {
    if (!isDriverFormOpen) setEditingDriver(null);
  }, [isDriverFormOpen]);

  async function onDriverSubmit(data: DriverFormValues) {
    try {
      const payload = {
        first_name: data.first_name.trim(),
        last_name: data.last_name.trim(),
        dob: data.dob || null,
        weight: data.weight ?? null,
        class: (data.class as DriverClass) || null,
        is_licensed: data.is_licensed ?? false,
      };

      if (editingDriver) {
        await updateDriver(editingDriver.id, payload);
        toast({ title: 'Sõitja andmed muudetud' });
      } else {
        await createDriver(payload);
        toast({ title: 'Sõitja lisatud' });
      }
      setIsDriverFormOpen(false);
      await loadData();
    } catch (err: any) {
      toast({ title: 'Viga', description: err.message || 'Salvestamine ebaõnnestus.', variant: 'destructive' });
    }
  }

  async function handleDeleteDriver(driverId: string) {
    try {
      await deleteDriver(driverId);
      toast({ title: 'Sõitja kustutatud' });
      setIsDriverFormOpen(false);
      await loadData();
    } catch (err: any) {
      toast({ title: 'Viga', description: err.message || 'Kustutamine ebaõnnestus.', variant: 'destructive' });
    }
  }

  async function handleClearAllDrivers() {
    try {
      await deleteAllDrivers();
      toast({ title: 'Kõik andmed kustutatud' });
      await loadData();
    } catch (err: any) {
      toast({ title: 'Viga', description: err.message || 'Kustutamine ebaõnnestus.', variant: 'destructive' });
    }
  }

  // ─── Team form ──────────────────────────────────────────

  const teamForm = useForm<TeamFormValues>({
    resolver: zodResolver(teamFormSchema),
    defaultValues: { name: '', driver1_id: '', driver2_id: '', substitute_id: null, substitute_used_on_event: null },
  });

  useEffect(() => {
    if (editingTeam) {
      teamForm.reset({
        name: editingTeam.name,
        driver1_id: editingTeam.driver1_id,
        driver2_id: editingTeam.driver2_id,
        substitute_id: editingTeam.substitute_id,
        substitute_used_on_event: editingTeam.substitute_used_on_event,
      });
    } else {
      teamForm.reset({ name: '', driver1_id: '', driver2_id: '', substitute_id: null, substitute_used_on_event: null });
    }
  }, [editingTeam, teamForm]);

  useEffect(() => {
    if (!isTeamFormOpen) {
      setEditingTeam(null);
      setDriver1Search('');
      setDriver2Search('');
      setSubstituteSearch('');
    }
  }, [isTeamFormOpen]);

  async function onTeamSubmit(data: TeamFormValues) {
    if (!seasonId) {
      toast({ title: 'Viga', description: 'Aktiivset hooaega ei leitud.', variant: 'destructive' });
      return;
    }
    try {
      if (editingTeam) {
        await updateTeam(editingTeam.id, {
          name: data.name.trim(),
          driver1_id: data.driver1_id,
          driver2_id: data.driver2_id,
          substitute_id: data.substitute_id || null,
          substitute_used_on_event: data.substitute_used_on_event || null,
        });
        toast({ title: 'Meeskond muudetud' });
      } else {
        await createTeam({
          name: data.name.trim(),
          season_id: seasonId,
          driver1_id: data.driver1_id,
          driver2_id: data.driver2_id,
          substitute_id: data.substitute_id || null,
          substitute_used_on_event: data.substitute_used_on_event || null,
        });
        toast({ title: 'Meeskond lisatud' });
      }
      setIsTeamFormOpen(false);
      await loadData();
    } catch (err: any) {
      toast({ title: 'Viga', description: err.message || 'Salvestamine ebaõnnestus.', variant: 'destructive' });
    }
  }

  async function handleDeleteTeam(teamId: string) {
    try {
      await deleteTeam(teamId);
      toast({ title: 'Meeskond kustutatud' });
      await loadData();
    } catch (err: any) {
      toast({ title: 'Viga', description: err.message || 'Kustutamine ebaõnnestus.', variant: 'destructive' });
    }
  }

  // ─── Filtered driver lists for team form ────────────────

  const filteredDrivers1 = useMemo(() => {
    const q = driver1Search.toLowerCase();
    return drivers.filter(d => `${d.first_name} ${d.last_name}`.toLowerCase().includes(q));
  }, [drivers, driver1Search]);

  const filteredDrivers2 = useMemo(() => {
    const q = driver2Search.toLowerCase();
    return drivers.filter(d => `${d.first_name} ${d.last_name}`.toLowerCase().includes(q));
  }, [drivers, driver2Search]);

  const filteredSubstitutes = useMemo(() => {
    const q = substituteSearch.toLowerCase();
    return drivers.filter(d => `${d.first_name} ${d.last_name}`.toLowerCase().includes(q));
  }, [drivers, substituteSearch]);

  // ─── Render ─────────────────────────────────────────────

  if (isLoading) {
    return (
      <PageLayout backHref="/">
        <div className="flex justify-center items-center py-20"><LoadingSpinner size={48} /></div>
      </PageLayout>
    );
  }

  return (
    <PageLayout backHref="/">
      <Tabs defaultValue="drivers" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="drivers">Sõitjad</TabsTrigger>
          <TabsTrigger value="teams">Meeskonnad</TabsTrigger>
        </TabsList>

        {/* ═══════════ DRIVERS TAB ═══════════ */}
        <TabsContent value="drivers">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-6 w-6 text-primary" />
                  <CardTitle>Sõitjate nimekiri</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  {/* Delete all */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm"><Trash2 className="mr-2 h-4 w-4" /> Kustuta kõik</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Kas oled täiesti kindel?</AlertDialogTitle>
                        <AlertDialogDescription>See kustutab KÕIK sõitjad ja meeskonnad jäädavalt.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Tühista</AlertDialogCancel>
                        <AlertDialogAction onClick={handleClearAllDrivers}>Jah, kustuta kõik</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  {/* Add driver dialog */}
                  <Dialog open={isDriverFormOpen} onOpenChange={setIsDriverFormOpen}>
                    <DialogTrigger asChild>
                      <Button onClick={() => setEditingDriver(null)}><UserPlus className="mr-2 h-4 w-4" /> Lisa sõitja</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg">
                      <DialogHeader>
                        <DialogTitle>{editingDriver ? 'Muuda sõitjat' : 'Lisa uus sõitja'}</DialogTitle>
                        <DialogDescription>{editingDriver ? 'Muuda andmeid ja salvesta.' : 'Täida väljad uue sõitja lisamiseks.'}</DialogDescription>
                      </DialogHeader>
                      <Form {...driverForm}>
                        <form onSubmit={driverForm.handleSubmit(onDriverSubmit)} className="space-y-4 py-4">
                          <div className="grid grid-cols-2 gap-4">
                            <FormField control={driverForm.control} name="first_name" render={({ field }) => (
                              <FormItem><FormLabel>Eesnimi</FormLabel><FormControl><Input placeholder="Evert" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={driverForm.control} name="last_name" render={({ field }) => (
                              <FormItem><FormLabel>Perekonnanimi</FormLabel><FormControl><Input placeholder="Sild" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                          </div>
                          <FormField control={driverForm.control} name="dob" render={({ field }) => (
                            <FormItem><FormLabel>Sünnikuupäev</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <div className="grid grid-cols-2 gap-4">
                            <FormField control={driverForm.control} name="weight" render={({ field }) => (
                              <FormItem><FormLabel>Kaal (kg)</FormLabel><FormControl><Input type="number" placeholder="85" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={driverForm.control} name="class" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Klass</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                                  <FormControl><SelectTrigger><SelectValue placeholder="Vali klass" /></SelectTrigger></FormControl>
                                  <SelectContent>
                                    <SelectItem value="Junior">Junior (kuni 65 kg)</SelectItem>
                                    <SelectItem value="Standard">Standard (65–85 kg)</SelectItem>
                                    <SelectItem value="Heavy">Heavy (90–105 kg)</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )} />
                          </div>
                          <FormField control={driverForm.control} name="is_licensed" render={({ field }) => (
                            <FormItem className="flex flex-row items-center gap-2">
                              <FormControl>
                                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                              <FormLabel className="!mt-0">Võistluslitsentsiga sõitja (ei saa punkte)</FormLabel>
                            </FormItem>
                          )} />
                          <DialogFooter className="justify-between">
                            {editingDriver ? (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button type="button" variant="destructive"><Trash2 className="mr-2 h-4 w-4" /> Kustuta</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Kustuta sõitja?</AlertDialogTitle>
                                    <AlertDialogDescription>Sõitja eemaldatakse jäädavalt koos meeskondadega.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Tühista</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteDriver(editingDriver.id)}>Kustuta</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            ) : <div />}
                            <div className="flex gap-2">
                              <DialogClose asChild><Button type="button" variant="outline">Tühista</Button></DialogClose>
                              <Button type="submit">{editingDriver ? 'Salvesta muudatused' : 'Salvesta'}</Button>
                            </div>
                          </DialogFooter>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              <CardDescription>Kõik registreeritud sõitjad ({drivers.length})</CardDescription>
            </CardHeader>
            <CardContent>
              {drivers.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">#</TableHead>
                      <TableHead>Nimi</TableHead>
                      <TableHead>Klass</TableHead>
                      <TableHead>Vanus</TableHead>
                      <TableHead>Sünnikuupäev</TableHead>
                      <TableHead>Kaal</TableHead>
                      <TableHead>Litsents</TableHead>
                      <TableHead className="text-right">Tegevused</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drivers.map((driver, i) => (
                      <TableRow key={driver.id}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell className="font-medium">{driver.first_name} {driver.last_name}</TableCell>
                        <TableCell>{driver.class || 'N/A'}</TableCell>
                        <TableCell>{calculateAge(driver.dob) ?? 'N/A'}</TableCell>
                        <TableCell>{formatDob(driver.dob)}</TableCell>
                        <TableCell>{driver.weight ? `${driver.weight} kg` : 'N/A'}</TableCell>
                        <TableCell>{driver.is_licensed ? '✓' : ''}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" title="Muuda" onClick={() => { setEditingDriver(driver); setIsDriverFormOpen(true); }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-10">Sõitjaid ei leitud. Lisa uus sõitja.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════ TEAMS TAB ═══════════ */}
        <TabsContent value="teams">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-6 w-6 text-primary" />
                  <CardTitle>Meeskondade nimekiri</CardTitle>
                </div>
                <Dialog open={isTeamFormOpen} onOpenChange={setIsTeamFormOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => setEditingTeam(null)}><UserPlus className="mr-2 h-4 w-4" /> Lisa meeskond</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-3xl">
                    <DialogHeader>
                      <DialogTitle>{editingTeam ? 'Muuda meeskonda' : 'Lisa uus meeskond'}</DialogTitle>
                      <DialogDescription>{editingTeam ? 'Muuda andmeid ja salvesta.' : 'Täida väljad uue meeskonna loomiseks.'}</DialogDescription>
                    </DialogHeader>
                    <Form {...teamForm}>
                      <form onSubmit={teamForm.handleSubmit(onTeamSubmit)} className="space-y-4 py-4">
                        <FormField control={teamForm.control} name="name" render={({ field }) => (
                          <FormItem><FormLabel>Meeskonna nimi</FormLabel><FormControl><Input placeholder="Tiim Corner" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Driver 1 */}
                          <FormField control={teamForm.control} name="driver1_id" render={({ field }) => (
                            <FormItem>
                              <FormLabel>1. sõitja</FormLabel>
                              <div className="relative">
                                <Input placeholder="Otsi..." value={driver1Search} onChange={e => setDriver1Search(e.target.value)} className="mb-2 pl-8" />
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                              </div>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Vali sõitja" /></SelectTrigger></FormControl>
                                <SelectContent>
                                  {filteredDrivers1.map(d => <SelectItem key={d.id} value={d.id}>{d.first_name} {d.last_name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )} />
                          {/* Driver 2 */}
                          <FormField control={teamForm.control} name="driver2_id" render={({ field }) => (
                            <FormItem>
                              <FormLabel>2. sõitja</FormLabel>
                              <div className="relative">
                                <Input placeholder="Otsi..." value={driver2Search} onChange={e => setDriver2Search(e.target.value)} className="mb-2 pl-8" />
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                              </div>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Vali sõitja" /></SelectTrigger></FormControl>
                                <SelectContent>
                                  {filteredDrivers2.map(d => <SelectItem key={d.id} value={d.id}>{d.first_name} {d.last_name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )} />
                          {/* Substitute */}
                          <FormField control={teamForm.control} name="substitute_id" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Asendussõitja</FormLabel>
                              <div className="relative">
                                <Input placeholder="Otsi..." value={substituteSearch} onChange={e => setSubstituteSearch(e.target.value)} className="mb-2 pl-8" />
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                              </div>
                              <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Valikuline" /></SelectTrigger></FormControl>
                                <SelectContent>
                                  {filteredSubstitutes.map(d => <SelectItem key={d.id} value={d.id}>{d.first_name} {d.last_name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                        <FormField control={teamForm.control} name="substitute_used_on_event" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Asendust kasutati etapil</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value ?? undefined} disabled={!teamForm.watch('substitute_id')}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Vali etapp" /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value=" ">Pole kasutatud</SelectItem>
                                {events.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <DialogFooter>
                          <DialogClose asChild><Button type="button" variant="outline">Tühista</Button></DialogClose>
                          <Button type="submit">{editingTeam ? 'Salvesta muudatused' : 'Salvesta meeskond'}</Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
              <CardDescription>Hooajal osalevad meeskonnad. 2 põhisõitjat + 1 asendus.</CardDescription>
            </CardHeader>
            <CardContent>
              {teams.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">#</TableHead>
                      <TableHead>Meeskond</TableHead>
                      <TableHead>Sõitja 1</TableHead>
                      <TableHead>Sõitja 2</TableHead>
                      <TableHead>Asendus</TableHead>
                      <TableHead className="text-right">Tegevused</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teams.map((team, i) => (
                      <TableRow key={team.id}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell className="font-medium">{team.name}</TableCell>
                        <TableCell>{driverMap.get(team.driver1_id) || 'N/A'}</TableCell>
                        <TableCell>{driverMap.get(team.driver2_id) || 'N/A'}</TableCell>
                        <TableCell>{team.substitute_id ? driverMap.get(team.substitute_id) || 'N/A' : '—'}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="ghost" size="icon" title="Muuda" onClick={() => { setEditingTeam(team); setIsTeamFormOpen(true); }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" title="Kustuta"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Kustuta meeskond?</AlertDialogTitle>
                                <AlertDialogDescription>Meeskond kustutatakse jäädavalt.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Tühista</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteTeam(team.id)}>Kustuta</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-10">Meeskondi ei leitud. Lisa uus meeskond.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
}
