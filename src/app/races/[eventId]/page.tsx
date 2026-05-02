'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import PageLayout from '@/components/PageLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  Users, Shuffle, Timer, Flag, Trophy, Trash2, ArrowRight, ArrowLeft,
  Upload, Check, X, AlertTriangle, Pencil, Move, ChevronLeft, ImagePlus,
  Download, Settings, UserPlus,
} from 'lucide-react';
import {
  exportQualiResults,
  exportHeatResults,
  exportFinalResults,
  exportAllResults,
} from '@/lib/pdf-export';

import type { Driver, DriverClass, SessionType, Event as DbEvent } from '@/types/database';
import {
  getEventFullData,
  addParticipantsToEvent,
  removeParticipantFromEvent,
  toggleExcludeFromPoints,
  createSessions,
  clearSessionsByType,
  saveSessionResults,
  deleteSessionResult,
  moveParticipantBetweenSessions,
  updateParticipantKart,
  updateEventStatus,
  updateKartSettings,
  type EventFullData,
} from './actions';
import { getDrivers, createDriver } from '@/app/drivers/actions';
import { extractResultsFromImage, type OcrResultRow } from '@/lib/ocr';
import {
  recommendGroupCount,
  generateQualiGroups,
  generateHeatGroups,
  generateFinalGroups,
  buildPreviousKartsMap,
  rankDriversByBestLap,
  rankDriversByPosition,
  parseLapTime,
  millisToTimeStr,
} from './race-utils';

// ============================================================
// Step definitions
// ============================================================

type Step = 'participants' | 'kart_settings' | 'quali_setup' | 'quali_results' | 'heat_setup' | 'heat_results' | 'final_setup' | 'final_results' | 'overview';

const STEPS: Step[] = ['participants', 'kart_settings', 'quali_setup', 'quali_results', 'heat_setup', 'heat_results', 'final_setup', 'final_results', 'overview'];

const STEP_LABELS: Record<Step, string> = {
  participants: '1. Osalejad',
  kart_settings: '2. Kardid',
  quali_setup: '3. Kvali grupid',
  quali_results: '4. Kvali tulemused',
  heat_setup: '5. Eelsõidud',
  heat_results: '6. Eelsõitude tulem.',
  final_setup: '7. Finaalid',
  final_results: '8. Finaali tulem.',
  overview: '9. Kokkuvõte',
};

// ============================================================
// Helper to get driver name
// ============================================================

function driverName(driver: Driver): string {
  return `${driver.first_name} ${driver.last_name}`;
}

function classLabel(c: DriverClass): string {
  return c;
}

// ============================================================
// Main component
// ============================================================

export default function EventPage() {
  const params = useParams();
  const eventId = params.eventId as string;
  const router = useRouter();
  const { toast } = useToast();

  // Data
  const [data, setData] = useState<EventFullData | null>(null);
  const [allDrivers, setAllDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('participants');

  // Load
  const loadData = useCallback(async () => {
    try {
      const [eventData, drivers] = await Promise.all([
        getEventFullData(eventId),
        getDrivers(),
      ]);
      setData(eventData);
      setAllDrivers(drivers);
    } catch (err) {
      toast({ title: 'Viga', description: 'Andmete laadimine ebaõnnestus.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [eventId, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  // Derived data helpers
  const event = data?.event;
  const entries = data?.entries ?? [];
  const sessions = data?.sessions ?? [];

  const sessionsByType = useMemo(() => {
    const map: Record<string, typeof sessions> = {};
    for (const s of sessions) {
      if (!map[s.type]) map[s.type] = [];
      map[s.type].push(s);
    }
    return map;
  }, [sessions]);

  const qualiSessions = [...(sessionsByType['quali_1'] ?? []), ...(sessionsByType['quali_2'] ?? [])];
  const heatSessions = sessionsByType['heat'] ?? [];
  const finalSessions = sessionsByType['final'] ?? [];

  const entryDriverIds = new Set(entries.map((e) => e.driver_id));
  const availableKarts = event?.available_kart_numbers ?? [];

  // ============================================================
  // Step navigation
  // ============================================================

  const stepIdx = STEPS.indexOf(step);
  const goNext = () => { if (stepIdx < STEPS.length - 1) setStep(STEPS[stepIdx + 1]); };
  const goPrev = () => { if (stepIdx > 0) setStep(STEPS[stepIdx - 1]); };

  // Loading
  if (loading || !data || !event) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/races')}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{event.name}</h1>
          <p className="text-sm text-muted-foreground">
            {entries.length} osalejat · {availableKarts.length > 0 ? `Kardid: ${availableKarts.join(', ')}` : `Max ${event.max_karts} karti`}
          </p>
        </div>
      </div>

      {/* Step tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-2">
        {STEPS.map((s, i) => (
          <Button
            key={s}
            variant={step === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStep(s)}
            className="whitespace-nowrap text-xs"
          >
            {STEP_LABELS[s]}
          </Button>
        ))}
      </div>

      {/* Step content */}
      {step === 'participants' && (
        <StepParticipants
          eventId={eventId}
          entries={entries}
          allDrivers={allDrivers}
          onRefresh={loadData}
        />
      )}
      {step === 'kart_settings' && (
        <StepKartSettings
          eventId={eventId}
          event={event}
          onRefresh={loadData}
        />
      )}
      {step === 'quali_setup' && (
        <StepGroupSetup
          eventId={eventId}
          entries={entries}
          sessions={qualiSessions}
          sessionType="quali_1"
          availableKarts={availableKarts}
          allSessions={sessions}
          title="Kvalifikatsiooni grupid"
          description="Q1 ja Q2 — samad grupid, erinevad kardid. Parim ring kahest sessioonist läheb kirja."
          onRefresh={loadData}
          maxKarts={event?.max_karts ?? 9}
        />
      )}
      {step === 'quali_results' && (
        <StepResults
          eventId={eventId}
          event={event}
          sessions={qualiSessions}
          entries={entries}
          title="Kvalifikatsiooni tulemused"
          description="Sisesta Q1 ja Q2 tulemused. Parim ring kahest sessioonist määrab edasise pingerea."
          onRefresh={loadData}
        />
      )}
      {step === 'heat_setup' && (
        <StepHeatSetup
          eventId={eventId}
          entries={entries}
          qualiSessions={qualiSessions}
          heatSessions={heatSessions}
          availableKarts={availableKarts}
          allSessions={sessions}
          onRefresh={loadData}
          maxKarts={event?.max_karts ?? 9}
        />
      )}
      {step === 'heat_results' && (
        <StepResults
          eventId={eventId}
          event={event}
          sessions={heatSessions}
          entries={entries}
          title="Eelsõitude tulemused"
          description="Sisesta eelsõitude tulemused igale grupile."
          onRefresh={loadData}
        />
      )}
      {step === 'final_setup' && (
        <StepFinalSetup
          eventId={eventId}
          entries={entries}
          heatSessions={heatSessions}
          finalSessions={finalSessions}
          availableKarts={availableKarts}
          allSessions={sessions}
          onRefresh={loadData}
          maxKarts={event?.max_karts ?? 9}
        />
      )}
      {step === 'final_results' && (
        <StepResults
          eventId={eventId}
          event={event}
          sessions={finalSessions}
          entries={entries}
          title="Finaali tulemused"
          description="Sisesta finaali tulemused igale grupile."
          onRefresh={loadData}
        />
      )}
      {step === 'overview' && (
        <StepOverview
          eventId={eventId}
          event={event}
          entries={entries}
          sessions={sessions}
          onRefresh={loadData}
        />
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <Button variant="outline" onClick={goPrev} disabled={stepIdx === 0}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Eelmine
        </Button>
        <Button onClick={goNext} disabled={stepIdx === STEPS.length - 1}>
          Järgmine <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </PageLayout>
  );
}

// ============================================================
// STEP 2: Kart Settings
// ============================================================

function StepKartSettings({
  eventId,
  event,
  onRefresh,
}: {
  eventId: string;
  event: DbEvent;
  onRefresh: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [maxKarts, setMaxKarts] = useState(event.max_karts);
  const [kartNumbersStr, setKartNumbersStr] = useState(
    event.available_kart_numbers.length > 0
      ? event.available_kart_numbers.join(', ')
      : ''
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const parsed = kartNumbersStr
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));
      await updateKartSettings(eventId, maxKarts, parsed);
      toast({ title: 'Kardi seaded salvestatud!' });
      await onRefresh();
    } catch (err) {
      toast({ title: 'Viga', description: String(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Kardi seaded
        </CardTitle>
        <CardDescription>
          Määra maksimaalne kardiarv ja konkreetsed kardinumbrid. Saad neid muuta ka sõidu käigus (nt kaardi vahetus).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2 max-w-xs">
          <Label htmlFor="max-karts">Max karti</Label>
          <Input
            id="max-karts"
            type="number"
            min={1}
            max={50}
            value={maxKarts}
            onChange={(e) => setMaxKarts(Number(e.target.value))}
          />
        </div>
        <div className="space-y-2 max-w-sm">
          <Label htmlFor="kart-numbers">Kardinumbrid (komaga eraldatud)</Label>
          <Input
            id="kart-numbers"
            value={kartNumbersStr}
            onChange={(e) => setKartNumbersStr(e.target.value)}
            placeholder="nt. 1, 2, 3, 4, 5, 6, 7, 8, 9"
          />
          <p className="text-xs text-muted-foreground">Jäta tühjaks kui kardinumbreid pole veel</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Salvestan...' : 'Salvesta'}
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================================
// STEP 1: Participants
// ============================================================

const newDriverSchema = z.object({
  first_name: z.string().min(1, 'Eesnimi on kohustuslik.'),
  last_name: z.string().min(1, 'Perekonnanimi on kohustuslik.'),
  dob: z.string().optional().nullable(),
  weight: z.coerce.number().positive('Kaal peab olema positiivne.').optional().nullable(),
  class: z.enum(['Junior', 'Standard', 'Heavy']).optional().nullable(),
  is_licensed: z.boolean().optional(),
});
type NewDriverValues = z.infer<typeof newDriverSchema>;

function StepParticipants({
  eventId, entries, allDrivers, onRefresh,
}: {
  eventId: string;
  entries: EventFullData['entries'];
  allDrivers: Driver[];
  onRefresh: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteConfirm2, setDeleteConfirm2] = useState(false);
  const [isCreateDriverOpen, setIsCreateDriverOpen] = useState(false);
  const [creatingDriver, setCreatingDriver] = useState(false);

  const newDriverForm = useForm<NewDriverValues>({
    resolver: zodResolver(newDriverSchema),
    defaultValues: { first_name: '', last_name: '', dob: null, weight: null, class: null, is_licensed: false },
  });

  const handleCreateDriver = async (data: NewDriverValues) => {
    setCreatingDriver(true);
    try {
      const created = await createDriver({
        first_name: data.first_name,
        last_name: data.last_name,
        dob: data.dob ?? null,
        weight: data.weight ?? null,
        class: data.class ?? null,
        is_licensed: data.is_licensed ?? false,
      });
      await addParticipantsToEvent(eventId, [{
        driver_id: created.id,
        class: created.class ?? 'Standard',
        team_id: null,
      }]);
      toast({ title: `${created.first_name} ${created.last_name} loodud ja lisatud!` });
      setIsCreateDriverOpen(false);
      newDriverForm.reset();
      await onRefresh();
    } catch (err) {
      toast({ title: 'Viga', description: String(err), variant: 'destructive' });
    } finally {
      setCreatingDriver(false);
    }
  };

  const entryDriverIds = new Set(entries.map((e) => e.driver_id));
  const unregistered = allDrivers.filter(
    (d) => !entryDriverIds.has(d.id) && `${d.first_name} ${d.last_name}`.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddAll = async () => {
    setAdding(true);
    try {
      const toAdd = allDrivers
        .filter((d) => !entryDriverIds.has(d.id))
        .map((d) => ({
          driver_id: d.id,
          class: d.class ?? ('Standard' as DriverClass),
          team_id: null,
        }));
      if (toAdd.length === 0) return;
      await addParticipantsToEvent(eventId, toAdd);
      toast({ title: `${toAdd.length} osalejat lisatud!` });
      await onRefresh();
    } catch (err) {
      toast({ title: 'Viga', description: String(err), variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  };

  const handleAdd = async (driver: Driver) => {
    try {
      await addParticipantsToEvent(eventId, [{
        driver_id: driver.id,
        class: driver.class ?? 'Standard',
        team_id: null,
      }]);
      toast({ title: `${driverName(driver)} lisatud!` });
      await onRefresh();
    } catch (err) {
      toast({ title: 'Viga', description: String(err), variant: 'destructive' });
    }
  };

  const startDelete = (entryId: string, name: string) => {
    setDeleteTarget({ id: entryId, name });
  };

  const confirmDelete1 = () => {
    setDeleteConfirm2(true);
  };

  const confirmDelete2 = async () => {
    if (!deleteTarget) return;
    setDeleteConfirm2(false);
    try {
      await removeParticipantFromEvent(eventId, deleteTarget.id);
      toast({ title: 'Osaleja eemaldatud!' });
      setDeleteTarget(null);
      await onRefresh();
    } catch (err) {
      toast({ title: 'Viga', description: String(err), variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Registered participants */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Registreeritud osalejad ({entries.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Nimi</TableHead>
                  <TableHead>Klass</TableHead>
                  <TableHead>Kaal</TableHead>
                  <TableHead>Litsents</TableHead>
                  <TableHead>Punktideta</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry, i) => (
                  <TableRow key={entry.id}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell className="font-medium">{driverName(entry.driver)}</TableCell>
                    <TableCell><Badge variant="outline">{entry.class}</Badge></TableCell>
                    <TableCell>{entry.driver.weight ? `${entry.driver.weight} kg` : '–'}</TableCell>
                    <TableCell>{entry.driver.is_licensed ? '✓' : '–'}</TableCell>
                    <TableCell>
                      <Checkbox
                        checked={entry.is_excluded_from_points}
                        onCheckedChange={async (checked) => {
                          await toggleExcludeFromPoints(eventId, entry.id, !!checked);
                          await onRefresh();
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => startDelete(entry.id, driverName(entry.driver))}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Osalejaid pole veel lisatud. Lisa sõitjaid allolevast nimekirjast.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Add drivers */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lisa osalejaid</CardTitle>
            <div className="flex gap-2">
              <Button onClick={() => setIsCreateDriverOpen(true)} variant="outline" size="sm">
                <UserPlus className="mr-1 h-4 w-4" /> Lisa uus sõitja
              </Button>
              <Button onClick={handleAddAll} disabled={adding || unregistered.length === 0} variant="outline" size="sm">
                Lisa kõik ({allDrivers.filter((d) => !entryDriverIds.has(d.id)).length})
              </Button>
            </div>
          </div>
          <Input
            placeholder="Otsi sõitjat..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mt-2"
          />
        </CardHeader>
        <CardContent>
          {unregistered.length > 0 ? (
            <div className="grid gap-2 max-h-80 overflow-y-auto">
              {unregistered.map((d) => (
                <div key={d.id} className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50">
                  <div>
                    <span className="font-medium">{driverName(d)}</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      {d.class ?? '–'} · {d.weight ? `${d.weight} kg` : '–'}
                    </span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleAdd(d)}>Lisa</Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              {search ? 'Otsingule vastavaid sõitjaid ei leitud.' : 'Kõik sõitjad on juba lisatud.'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Create new driver dialog */}
      <Dialog open={isCreateDriverOpen} onOpenChange={(open) => { setIsCreateDriverOpen(open); if (!open) newDriverForm.reset(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Lisa uus sõitja</DialogTitle>
            <DialogDescription>Sõitja luuakse globaalselt ja lisatakse kohe sellele etapile.</DialogDescription>
          </DialogHeader>
          <Form {...newDriverForm}>
            <form onSubmit={newDriverForm.handleSubmit(handleCreateDriver)} className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={newDriverForm.control} name="first_name" render={({ field }) => (
                  <FormItem><FormLabel>Eesnimi</FormLabel><FormControl><Input placeholder="Evert" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={newDriverForm.control} name="last_name" render={({ field }) => (
                  <FormItem><FormLabel>Perekonnanimi</FormLabel><FormControl><Input placeholder="Sild" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={newDriverForm.control} name="dob" render={({ field }) => (
                  <FormItem><FormLabel>Sünnipäev</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={newDriverForm.control} name="weight" render={({ field }) => (
                  <FormItem><FormLabel>Kaal (kg)</FormLabel><FormControl><Input type="number" placeholder="75" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={newDriverForm.control} name="class" render={({ field }) => (
                  <FormItem><FormLabel>Klass</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Vali klass" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Junior">Junior</SelectItem>
                        <SelectItem value="Standard">Standard</SelectItem>
                        <SelectItem value="Heavy">Heavy</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={newDriverForm.control} name="is_licensed" render={({ field }) => (
                  <FormItem className="flex flex-col justify-end pb-1">
                    <div className="flex items-center gap-2">
                      <FormControl><Checkbox checked={field.value ?? false} onCheckedChange={field.onChange} /></FormControl>
                      <FormLabel className="cursor-pointer">Litsentseeritud</FormLabel>
                    </div>
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setIsCreateDriverOpen(false); newDriverForm.reset(); }}>Tühista</Button>
                <Button type="submit" disabled={creatingDriver}>{creatingDriver ? 'Loon...' : 'Loo ja lisa'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm 1 */}
      <AlertDialog open={!!deleteTarget && !deleteConfirm2} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eemalda osaleja?</AlertDialogTitle>
            <AlertDialogDescription>
              Kas soovid eemaldada osaleja &quot;{deleteTarget?.name}&quot; sellelt etapilt?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Tühista</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete1} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Jah, eemalda
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm 2 */}
      <AlertDialog open={deleteConfirm2} onOpenChange={setDeleteConfirm2}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Viimane kinnitus
            </AlertDialogTitle>
            <AlertDialogDescription>
              See kustutab ka osaleja tulemused sellel etapil. Toiming on pöördumatu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeleteConfirm2(false); setDeleteTarget(null); }}>Tühista</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete2} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Kustuta jäädavalt
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================
// STEP 2/4/6: Group Setup (reusable for quali, heats, finals)
// ============================================================

function StepGroupSetup({
  eventId, entries, sessions, sessionType, availableKarts, allSessions,
  title, description, onRefresh, maxKarts,
}: {
  eventId: string;
  entries: EventFullData['entries'];
  sessions: EventFullData['sessions'];
  sessionType: SessionType;
  availableKarts: number[];
  allSessions: EventFullData['sessions'];
  title: string;
  description: string;
  maxKarts: number;
  onRefresh: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [groupCount, setGroupCount] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);

  // Existing sessions for this type
  const q1Sessions = sessions.filter((s) => s.type === 'quali_1');
  const q2Sessions = sessions.filter((s) => s.type === 'quali_2');
  const hasGroups = q1Sessions.length > 0 || sessions.length > 0;

  // Auto-recommend group count
  const recommended = useMemo(
    () => recommendGroupCount(entries.length, availableKarts.length || 9),
    [entries.length, availableKarts.length]
  );

  useEffect(() => { setGroupCount(recommended); }, [recommended]);

  const handleGenerate = async () => {
    if (entries.length === 0) {
      toast({ title: 'Lisa kõigepealt osalejad!', variant: 'destructive' });
      return;
    }
    if (availableKarts.length === 0) {
      toast({ title: 'Sisesta kõigepealt kardinumbrid etapi seadetes!', variant: 'destructive' });
      return;
    }

    setGenerating(true);
    try {
      const driverIds = entries.map((e) => e.driver_id);
      const previousKarts = buildPreviousKartsMap(allSessions);

      // Generate Q1 groups
      const q1Groups = generateQualiGroups(driverIds, groupCount, maxKarts, availableKarts, previousKarts);

      await createSessions(eventId, 'quali_1', q1Groups);

      // Generate Q2 with same groups but different karts
      // Build updated previous karts including Q1
      const q1KartMap = new Map<string, Set<number>>();
      for (const g of q1Groups) {
        for (const p of g.participants) {
          if (p.kartNumber !== null) {
            if (!q1KartMap.has(p.driverId)) q1KartMap.set(p.driverId, new Set());
            q1KartMap.get(p.driverId)!.add(p.kartNumber);
          }
        }
      }
      // Merge with previous
      const q2PreviousKarts = new Map(previousKarts);
      for (const [dId, karts] of q1KartMap) {
        if (!q2PreviousKarts.has(dId)) q2PreviousKarts.set(dId, new Set());
        for (const k of karts) q2PreviousKarts.get(dId)!.add(k);
      }

      const q2Groups = generateQualiGroups(driverIds, groupCount, maxKarts, availableKarts, q2PreviousKarts);
      // Keep same group assignments from Q1, only change karts
      const q2WithSameGroups = q1Groups.map((q1g, i) => ({
        groupName: q1g.groupName,
        participants: q1g.participants.map((p) => {
          const q2Kart = q2Groups.flatMap((g) => g.participants).find((x) => x.driverId === p.driverId);
          return { driverId: p.driverId, kartNumber: q2Kart?.kartNumber ?? null };
        }),
      }));

      await createSessions(eventId, 'quali_2', q2WithSameGroups);

      toast({ title: `${groupCount} gruppi loodud (Q1 + Q2)!` });
      await onRefresh();
    } catch (err) {
      toast({ title: 'Viga', description: String(err), variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handleClear = async () => {
    setClearConfirm(false);
    try {
      await clearSessionsByType(eventId, 'quali_1');
      await clearSessionsByType(eventId, 'quali_2');
      toast({ title: 'Kvali grupid kustutatud!' });
      await onRefresh();
    } catch (err) {
      toast({ title: 'Viga', description: String(err), variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shuffle className="h-5 w-5" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-4">
            <div className="grid gap-2">
              <Label>Gruppide arv (soovitus: {recommended})</Label>
              <Input
                type="number"
                min={1}
                max={16}
                value={groupCount}
                onChange={(e) => setGroupCount(parseInt(e.target.value, 10) || 1)}
                className="w-32"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleGenerate} disabled={generating}>
                <Shuffle className="mr-2 h-4 w-4" />
                {hasGroups ? 'Genereeri uuesti' : 'Genereeri grupid'}
              </Button>
              {hasGroups && (
                <Button variant="destructive" onClick={() => setClearConfirm(true)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Kustuta grupid
                </Button>
              )}
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            {entries.length} osalejat · {availableKarts.length} karti · {groupCount > 0 ? `~${Math.ceil(entries.length / groupCount)} sõitjat grupis` : ''}
          </p>
        </CardContent>
      </Card>

      {/* Show existing groups — Q1 left column, Q2 right column, paired by group letter */}
      {(q1Sessions.length > 0 || q2Sessions.length > 0) && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            {q1Sessions.map((s) => (
              <SessionGroupCards key={s.id} sessions={[s]} label="Q1" entries={entries} eventId={eventId} allSessions={allSessions} onRefresh={onRefresh} />
            ))}
          </div>
          <div className="space-y-4">
            {q2Sessions.map((s) => (
              <SessionGroupCards key={s.id} sessions={[s]} label="Q2" entries={entries} eventId={eventId} allSessions={allSessions} onRefresh={onRefresh} />
            ))}
          </div>
        </div>
      )}

      {/* Clear confirm */}
      <AlertDialog open={clearConfirm} onOpenChange={setClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kustuta kõik kvali grupid?</AlertDialogTitle>
            <AlertDialogDescription>See kustutab ka kõik Q1 ja Q2 tulemused. Toiming on pöördumatu.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Tühista</AlertDialogCancel>
            <AlertDialogAction onClick={handleClear} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Kustuta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================
// STEP 4: Heat Setup (from quali results)
// ============================================================

function StepHeatSetup({
  eventId, entries, qualiSessions, heatSessions, availableKarts, allSessions, onRefresh, maxKarts,
}: {
  eventId: string;
  entries: EventFullData['entries'];
  qualiSessions: EventFullData['sessions'];
  heatSessions: EventFullData['sessions'];
  availableKarts: number[];
  allSessions: EventFullData['sessions'];
  maxKarts: number;
  onRefresh: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [groupCount, setGroupCount] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);

  const recommended = useMemo(
    () => recommendGroupCount(entries.length, availableKarts.length || 9),
    [entries.length, availableKarts.length]
  );

  useEffect(() => { setGroupCount(recommended); }, [recommended]);

  const qualiHasResults = qualiSessions.some((s) => s.results.length > 0);

  const handleGenerate = async () => {
    if (!qualiHasResults) {
      toast({ title: 'Kvali tulemused puuduvad!', variant: 'destructive' });
      return;
    }

    setGenerating(true);
    try {
      // Rank by best lap from quali sessions
      const ranked = rankDriversByBestLap(qualiSessions);
      const previousKarts = buildPreviousKartsMap(allSessions);
      const groups = generateHeatGroups(ranked, groupCount, maxKarts, availableKarts, previousKarts);

      // Clear existing heats
      if (heatSessions.length > 0) {
        await clearSessionsByType(eventId, 'heat');
      }

      await createSessions(eventId, 'heat', groups);
      toast({ title: `${groupCount} eelsõidu gruppi loodud!` });
      await onRefresh();
    } catch (err) {
      toast({ title: 'Viga', description: String(err), variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handleClear = async () => {
    setClearConfirm(false);
    try {
      await clearSessionsByType(eventId, 'heat');
      toast({ title: 'Eelsõidu grupid kustutatud!' });
      await onRefresh();
    } catch (err) {
      toast({ title: 'Viga', description: String(err), variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5" />
            Eelsõitude grupid
          </CardTitle>
          <CardDescription>
            Grupid genereeritakse kvalifikatsiooni tulemuste põhjal (parim ring Q1/Q2-st).
            Parimad sõitjad jaotatakse ühtlaselt gruppide vahel.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!qualiHasResults && (
            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-md">
              <AlertTriangle className="h-5 w-5" />
              <p className="text-sm">Kvali tulemused puuduvad. Sisesta kõigepealt Q1 ja Q2 tulemused.</p>
            </div>
          )}

          <div className="flex items-end gap-4">
            <div className="grid gap-2">
              <Label>Gruppide arv (soovitus: {recommended})</Label>
              <Input
                type="number" min={1} max={16} value={groupCount}
                onChange={(e) => setGroupCount(parseInt(e.target.value, 10) || 1)}
                className="w-32"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleGenerate} disabled={generating || !qualiHasResults}>
                <Shuffle className="mr-2 h-4 w-4" />
                {heatSessions.length > 0 ? 'Genereeri uuesti' : 'Genereeri grupid'}
              </Button>
              {heatSessions.length > 0 && (
                <Button variant="destructive" onClick={() => setClearConfirm(true)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Kustuta
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <SessionGroupCards sessions={heatSessions} label="Eelsõit" entries={entries} eventId={eventId} allSessions={allSessions} onRefresh={onRefresh} />

      <AlertDialog open={clearConfirm} onOpenChange={setClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kustuta eelsõidu grupid?</AlertDialogTitle>
            <AlertDialogDescription>See kustutab ka kõik eelsõitude tulemused.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Tühista</AlertDialogCancel>
            <AlertDialogAction onClick={handleClear} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Kustuta</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================
// STEP 6: Final Setup (from heat results)
// ============================================================

function StepFinalSetup({
  eventId, entries, heatSessions, finalSessions, availableKarts, allSessions, onRefresh, maxKarts,
}: {
  eventId: string;
  entries: EventFullData['entries'];
  heatSessions: EventFullData['sessions'];
  finalSessions: EventFullData['sessions'];
  availableKarts: number[];
  allSessions: EventFullData['sessions'];
  maxKarts: number;
  onRefresh: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [groupCount, setGroupCount] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);

  const recommended = useMemo(
    () => recommendGroupCount(entries.length, availableKarts.length || 9),
    [entries.length, availableKarts.length]
  );

  useEffect(() => { setGroupCount(recommended); }, [recommended]);

  const heatHasResults = heatSessions.some((s) => s.results.length > 0);

  const handleGenerate = async () => {
    if (!heatHasResults) {
      toast({ title: 'Eelsõitude tulemused puuduvad!', variant: 'destructive' });
      return;
    }

    setGenerating(true);
    try {
      const ranked = rankDriversByPosition(heatSessions);
      const previousKarts = buildPreviousKartsMap(allSessions);
      const groups = generateFinalGroups(ranked, groupCount, maxKarts, availableKarts, previousKarts);

      if (finalSessions.length > 0) {
        await clearSessionsByType(eventId, 'final');
      }

      await createSessions(eventId, 'final', groups);
      toast({ title: `${groupCount} finaalgruppi loodud!` });
      await onRefresh();
    } catch (err) {
      toast({ title: 'Viga', description: String(err), variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handleClear = async () => {
    setClearConfirm(false);
    try {
      await clearSessionsByType(eventId, 'final');
      toast({ title: 'Finaalid kustutatud!' });
      await onRefresh();
    } catch (err) {
      toast({ title: 'Viga', description: String(err), variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Finaali grupid
          </CardTitle>
          <CardDescription>
            Grupid genereeritakse eelsõitude tulemuste põhjal. Parimad sõitjad lähevad Finaali A.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!heatHasResults && (
            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-md">
              <AlertTriangle className="h-5 w-5" />
              <p className="text-sm">Eelsõitude tulemused puuduvad.</p>
            </div>
          )}

          <div className="flex items-end gap-4">
            <div className="grid gap-2">
              <Label>Gruppide arv (soovitus: {recommended})</Label>
              <Input
                type="number" min={1} max={16} value={groupCount}
                onChange={(e) => setGroupCount(parseInt(e.target.value, 10) || 1)}
                className="w-32"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleGenerate} disabled={generating || !heatHasResults}>
                <Shuffle className="mr-2 h-4 w-4" />
                {finalSessions.length > 0 ? 'Genereeri uuesti' : 'Genereeri grupid'}
              </Button>
              {finalSessions.length > 0 && (
                <Button variant="destructive" onClick={() => setClearConfirm(true)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Kustuta
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <SessionGroupCards sessions={finalSessions} label="Finaal" entries={entries} eventId={eventId} allSessions={allSessions} onRefresh={onRefresh} />

      <AlertDialog open={clearConfirm} onOpenChange={setClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kustuta finaalid?</AlertDialogTitle>
            <AlertDialogDescription>See kustutab ka kõik finaali tulemused.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Tühista</AlertDialogCancel>
            <AlertDialogAction onClick={handleClear} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Kustuta</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================
// Session Group Cards (shared display component)
// ============================================================

function SessionGroupCards({
  sessions, label, entries, eventId, allSessions, onRefresh,
}: {
  sessions: EventFullData['sessions'];
  label: string;
  entries: EventFullData['entries'];
  eventId: string;
  allSessions: EventFullData['sessions'];
  onRefresh: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [moveParticipant, setMoveParticipant] = useState<{ id: string; name: string; currentSessionId: string } | null>(null);
  const [moveTarget, setMoveTarget] = useState('');

  const handleMove = async () => {
    if (!moveParticipant || !moveTarget) return;
    try {
      await moveParticipantBetweenSessions(eventId, moveParticipant.id, moveTarget);
      toast({ title: 'Sõitja teisaldatud!' });
      setMoveParticipant(null);
      await onRefresh();
    } catch (err) {
      toast({ title: 'Viga', description: String(err), variant: 'destructive' });
    }
  };

  if (sessions.length === 0) return null;

  return (
    <>
      <div className={`grid gap-4${sessions.length > 1 ? ' md:grid-cols-2' : ''}`}>
        {sessions.map((session) => (
          <Card key={session.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">
                {label} {session.group_name}
              </CardTitle>
              <CardDescription>{session.participants.length} sõitjat</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">Start</TableHead>
                    <TableHead className="w-16">Kart</TableHead>
                    <TableHead>Sõitja</TableHead>
                    <TableHead className="w-16">Klass</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {session.participants
                    .slice()
                    .sort((a, b) => (a.grid_position ?? 999) - (b.grid_position ?? 999))
                    .map((p) => {
                    const entry = entries.find((e) => e.driver_id === p.driver_id);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="text-center font-mono text-sm">{p.grid_position ?? '–'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{p.kart_number ?? '–'}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{driverName(p.driver)}</TableCell>
                        <TableCell><Badge variant="outline">{entry?.class ?? '–'}</Badge></TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setMoveParticipant({
                              id: p.id,
                              name: driverName(p.driver),
                              currentSessionId: session.id,
                            })}
                            title="Teisalda gruppi"
                          >
                            <Move className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Move dialog */}
      <Dialog open={!!moveParticipant} onOpenChange={() => setMoveParticipant(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Teisalda sõitja</DialogTitle>
            <DialogDescription>
              Teisalda &quot;{moveParticipant?.name}&quot; teise gruppi.
            </DialogDescription>
          </DialogHeader>
          <Select value={moveTarget} onValueChange={setMoveTarget}>
            <SelectTrigger><SelectValue placeholder="Vali grupp" /></SelectTrigger>
            <SelectContent>
              {sessions
                .filter((s) => s.id !== moveParticipant?.currentSessionId)
                .map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {label} {s.group_name} ({s.participants.length} sõitjat)
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveParticipant(null)}>Tühista</Button>
            <Button onClick={handleMove} disabled={!moveTarget}>Teisalda</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================
// STEP 3/5/7: Results Entry (reusable, with OCR)
// ============================================================

function StepResults({
  eventId, event, sessions, entries, title, description, onRefresh,
}: {
  eventId: string;
  event: DbEvent;
  sessions: EventFullData['sessions'];
  entries: EventFullData['entries'];
  title: string;
  description: string;
  onRefresh: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Set first session as active by default
  useEffect(() => {
    if (sessions.length > 0 && !activeSessionId) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions, activeSessionId]);

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const isQuali = sessions.length > 0 && (sessions[0].type === 'quali_1' || sessions[0].type === 'quali_2');

  if (sessions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Timer className="mx-auto h-10 w-10 mb-3 opacity-50" />
          <p>Gruppe pole veel loodud. Mine eelmisesse sammu ja genereeri grupid.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Timer className="h-5 w-5" />
                {title}
              </CardTitle>
              <CardDescription className="mt-1">{description}</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => {
                const sessionType = sessions[0]?.type;
                if (sessionType === 'quali_1' || sessionType === 'quali_2') {
                  exportQualiResults(event.name, event.event_date ?? null, sessions, entries);
                } else if (sessionType === 'heat') {
                  exportHeatResults(event.name, event.event_date ?? null, sessions, entries);
                } else if (sessionType === 'final') {
                  exportFinalResults(event.name, event.event_date ?? null, sessions, entries);
                }
              }}
            >
              <Download className="h-4 w-4 mr-1" />
              Laadi alla PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Session tabs */}
          <div className="flex flex-wrap gap-2 mb-4">
            {sessions.map((s) => (
              <Button
                key={s.id}
                variant={activeSessionId === s.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveSessionId(s.id)}
              >
                {s.type === 'quali_1' ? 'Q1' : s.type === 'quali_2' ? 'Q2' : s.type === 'heat' ? 'Eelsõit' : 'Finaal'}{' '}
                {s.group_name}
                {s.results.length > 0 && <Check className="ml-1 h-3 w-3" />}
              </Button>
            ))}
            {isQuali && (
              <Button
                variant={activeSessionId === 'summary' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveSessionId('summary')}
              >
                <Trophy className="mr-1 h-3 w-3" /> Kokkuvõte
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {activeSessionId === 'summary' && isQuali ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Kvalifikatsiooni kokkuvõte
            </CardTitle>
            <CardDescription>Parim ring Q1 ja Q2 sessioonidest. Kiireimast aeglaseimani.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Koht</TableHead>
                  <TableHead>Sõitja</TableHead>
                  <TableHead>Klass</TableHead>
                  <TableHead>Parim aeg</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rankDriversByBestLap(sessions).map((r) => {
                  const entry = entries.find((e) => e.driver_id === r.driverId);
                  return (
                    <TableRow key={r.driverId}>
                      <TableCell className="font-bold">{r.position ?? '–'}</TableCell>
                      <TableCell className="font-medium">
                        {entry ? driverName(entry.driver) : r.driverId}
                      </TableCell>
                      <TableCell><Badge variant="outline">{entry?.class ?? '–'}</Badge></TableCell>
                      <TableCell className="font-mono">
                        {r.bestLap != null ? millisToTimeStr(r.bestLap) : '–'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : activeSession ? (
        <SessionResultsEditor
          eventId={eventId}
          session={activeSession}
          entries={entries}
          onRefresh={onRefresh}
        />
      ) : null}
    </div>
  );
}

// ============================================================
// Session Results Editor (with OCR import)
// ============================================================

function SessionResultsEditor({
  eventId, session, entries, onRefresh,
}: {
  eventId: string;
  session: EventFullData['sessions'][number];
  entries: EventFullData['entries'];
  onRefresh: () => Promise<void>;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Build initial results from existing data or participants
  const initResults = useCallback(() => {
    if (session.results.length > 0) {
      return session.results
        .slice()
        .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
        .map((r) => ({
          driverId: r.driver_id,
          position: r.position?.toString() ?? '',
          totalTime: r.total_time ?? '',
          fastestLap: r.fastest_lap ?? '',
          penaltyNote: r.penalty_note ?? '',
        }));
    }
    return session.participants.map((p, i) => ({
      driverId: p.driver_id,
      position: '',
      totalTime: '',
      fastestLap: '',
      penaltyNote: '',
    }));
  }, [session]);

  const [results, setResults] = useState(initResults);
  const [saving, setSaving] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrPreview, setOcrPreview] = useState<OcrResultRow[] | null>(null);

  // Reset when session changes
  useEffect(() => { setResults(initResults()); }, [initResults]);

  const isQualiSession = session.type === 'quali_1' || session.type === 'quali_2';

  // Map kart number → driver for this session
  const kartToDriver = useMemo(() => {
    const map = new Map<number, { driverId: string; driverName: string }>();
    for (const p of session.participants) {
      if (p.kart_number != null) {
        map.set(p.kart_number, { driverId: p.driver_id, driverName: driverName(p.driver) });
      }
    }
    return map;
  }, [session]);

  // Get driver name helper
  const getDriverName = (driverId: string) => {
    const entry = entries.find((e) => e.driver_id === driverId);
    return entry ? driverName(entry.driver) : driverId;
  };

  const getKartNumber = (driverId: string) => {
    const p = session.participants.find((x) => x.driver_id === driverId);
    return p?.kart_number ?? null;
  };

  // Update a result field
  const updateResult = (idx: number, field: string, value: string) => {
    setResults((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  // Save results
  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSessionResults(
        eventId,
        session.id,
        results.map((r) => ({
          driverId: r.driverId,
          position: r.position ? parseInt(r.position, 10) : null,
          totalTime: r.totalTime || null,
          fastestLap: r.fastestLap || null,
          penaltyNote: r.penaltyNote || null,
        }))
      );
      toast({ title: 'Tulemused salvestatud!' });
      await onRefresh();
    } catch (err) {
      toast({ title: 'Viga', description: String(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // OCR import
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      const mimeType = file.type || 'image/jpeg';
      const extracted = await extractResultsFromImage(base64, mimeType);
      setOcrPreview(extracted);
    } catch (err) {
      toast({ title: 'OCR viga', description: String(err), variant: 'destructive' });
    } finally {
      setOcrLoading(false);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Apply OCR results
  const applyOcr = () => {
    if (!ocrPreview) return;

    const newResults = [...results];
    for (const ocr of ocrPreview) {
      const driver = kartToDriver.get(ocr.kartNumber);
      if (driver) {
        const idx = newResults.findIndex((r) => r.driverId === driver.driverId);
        if (idx !== -1) {
          newResults[idx] = {
            ...newResults[idx],
            position: ocr.position.toString(),
            totalTime: ocr.totalTime,
            fastestLap: ocr.bestTime,
          };
        }
      }
    }

    // Sort by position
    newResults.sort((a, b) => {
      const pa = a.position ? parseInt(a.position) : 999;
      const pb = b.position ? parseInt(b.position) : 999;
      return pa - pb;
    });

    setResults(newResults);
    setOcrPreview(null);
    toast({ title: 'Tulemused imporditud! Kontrolli ja salvesta.' });
  };

  return (
    <div className="space-y-4">
      {/* OCR import section */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={ocrLoading}
            >
              <ImagePlus className="mr-2 h-4 w-4" />
              {ocrLoading ? 'Töötlen pilti...' : 'Impordi pilt'}
            </Button>
            <p className="text-sm text-muted-foreground">
              Laadi üles LapSnapperi tulemuste pilt — süsteem tuvastab tulemused automaatselt.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* OCR Preview */}
      {ocrPreview && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Tuvastatud tulemused — kontrolli enne kinnitamist
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Koht</TableHead>
                  <TableHead className="w-16">Kart</TableHead>
                  <TableHead>Sõitja</TableHead>
                  {!isQualiSession && <TableHead>Koguaeg</TableHead>}
                  <TableHead>Parim ring</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ocrPreview.map((row, i) => {
                  const driver = kartToDriver.get(row.kartNumber);
                  return (
                    <TableRow key={i} className={!driver ? 'bg-amber-50 dark:bg-amber-950/30' : ''}>
                      <TableCell>{row.position}</TableCell>
                      <TableCell><Badge variant="secondary">{row.kartNumber}</Badge></TableCell>
                      <TableCell>
                        {driver ? (
                          <span className="font-medium">{driver.driverName}</span>
                        ) : (
                          <span className="text-amber-600">Tundmatu kart #{row.kartNumber}</span>
                        )}
                      </TableCell>
                      {!isQualiSession && <TableCell>{row.totalTime}</TableCell>}
                      <TableCell>{row.bestTime}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="flex gap-2 mt-4">
              <Button onClick={applyOcr}>
                <Check className="mr-2 h-4 w-4" /> Kinnita ja täida
              </Button>
              <Button variant="outline" onClick={() => setOcrPreview(null)}>
                <X className="mr-2 h-4 w-4" /> Tühista
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual results entry */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {session.type === 'quali_1' ? 'Q1' : session.type === 'quali_2' ? 'Q2' : session.type === 'heat' ? 'Eelsõit' : 'Finaal'}{' '}
              {session.group_name} — tulemused
            </CardTitle>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvestamine...' : 'Salvesta tulemused'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Koht</TableHead>
                <TableHead className="w-16">Kart</TableHead>
                <TableHead>Sõitja</TableHead>
                <TableHead>Klass</TableHead>
                {!isQualiSession && <TableHead>Koguaeg</TableHead>}
                <TableHead>Parim ring</TableHead>
                <TableHead>Karistus/märkused</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((r, i) => {
                const entry = entries.find((e) => e.driver_id === r.driverId);
                return (
                  <TableRow key={r.driverId}>
                    <TableCell>
                      <Input
                        className="w-14 h-8 text-center"
                        value={r.position}
                        onChange={(e) => updateResult(i, 'position', e.target.value)}
                        placeholder="#"
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{getKartNumber(r.driverId) ?? '–'}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{getDriverName(r.driverId)}</TableCell>
                    <TableCell><Badge variant="outline">{entry?.class ?? '–'}</Badge></TableCell>
                    {!isQualiSession && (
                      <TableCell>
                        <Input
                          className="w-28 h-8"
                          value={r.totalTime}
                          onChange={(e) => updateResult(i, 'totalTime', e.target.value)}
                          placeholder="06:52.363"
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <Input
                        className="w-28 h-8"
                        value={r.fastestLap}
                        onChange={(e) => updateResult(i, 'fastestLap', e.target.value)}
                        placeholder="00:57.371"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="w-40 h-8"
                        value={r.penaltyNote}
                        onChange={(e) => updateResult(i, 'penaltyNote', e.target.value)}
                        placeholder="Karistus..."
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// STEP 8: Overview
// ============================================================

function StepOverview({
  eventId, event, entries, sessions, onRefresh,
}: {
  eventId: string;
  event: DbEvent;
  entries: EventFullData['entries'];
  sessions: EventFullData['sessions'];
  onRefresh: () => Promise<void>;
}) {
  const { toast } = useToast();

  const finalSessions = sessions.filter((s) => s.type === 'final');
  const heatSessions = sessions.filter((s) => s.type === 'heat');
  const qualiSessions = sessions.filter((s) => s.type === 'quali_1' || s.type === 'quali_2');

  const totalResults = sessions.reduce((sum, s) => sum + s.results.length, 0);

  const handleStatusChange = async (status: DbEvent['status']) => {
    try {
      await updateEventStatus(eventId, status);
      toast({ title: `Staatus muudetud: ${status}` });
      await onRefresh();
    } catch (err) {
      toast({ title: 'Viga', description: String(err), variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Etapi kokkuvõte
          </CardTitle>
          <CardDescription>{event.name}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-md bg-muted/50">
              <p className="text-2xl font-bold">{entries.length}</p>
              <p className="text-sm text-muted-foreground">Osalejat</p>
            </div>
            <div className="text-center p-3 rounded-md bg-muted/50">
              <p className="text-2xl font-bold">{qualiSessions.length}</p>
              <p className="text-sm text-muted-foreground">Kvali sessiooni</p>
            </div>
            <div className="text-center p-3 rounded-md bg-muted/50">
              <p className="text-2xl font-bold">{heatSessions.length}</p>
              <p className="text-sm text-muted-foreground">Eelsõitu</p>
            </div>
            <div className="text-center p-3 rounded-md bg-muted/50">
              <p className="text-2xl font-bold">{finalSessions.length}</p>
              <p className="text-sm text-muted-foreground">Finaali</p>
            </div>
          </div>

          <Separator />

          <div className="flex items-center gap-4">
            <Label>Etapi staatus:</Label>
            <Select value={event.status} onValueChange={(v) => handleStatusChange(v as DbEvent['status'])}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Mustand</SelectItem>
                <SelectItem value="in_progress">Käimas</SelectItem>
                <SelectItem value="completed">Lõppenud</SelectItem>
                <SelectItem value="published">Avaldatud</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* PDF export buttons */}
          <div className="space-y-2">
            <Label>Laadi alla PDF:</Label>
            <div className="flex flex-wrap gap-2">
              {qualiSessions.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportQualiResults(event.name, event.event_date ?? null, qualiSessions, entries)}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Kvalifikatsioon
                </Button>
              )}
              {heatSessions.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportHeatResults(event.name, event.event_date ?? null, heatSessions, entries)}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Eelsõidud
                </Button>
              )}
              {finalSessions.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportFinalResults(event.name, event.event_date ?? null, finalSessions, entries)}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Finaalid
                </Button>
              )}
              {(qualiSessions.length + heatSessions.length + finalSessions.length) > 0 && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => exportAllResults(event.name, event.event_date ?? null, sessions, entries)}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Kõik tulemused
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Final results summary by class */}
      {finalSessions.length > 0 && finalSessions.some((s) => s.results.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Finaali tulemused</CardTitle>
          </CardHeader>
          <CardContent>
            {finalSessions.map((session) => (
              <div key={session.id} className="mb-6 last:mb-0">
                <h3 className="font-semibold mb-2">Finaal {session.group_name}</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Koht</TableHead>
                      <TableHead>Sõitja</TableHead>
                      <TableHead>Klass</TableHead>
                      <TableHead>Koguaeg</TableHead>
                      <TableHead>Parim ring</TableHead>
                      <TableHead>Märkused</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {session.results
                      .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
                      .map((r) => {
                        const entry = entries.find((e) => e.driver_id === r.driver_id);
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="font-bold">{r.position ?? '–'}</TableCell>
                            <TableCell className="font-medium">{driverName(r.driver)}</TableCell>
                            <TableCell><Badge variant="outline">{entry?.class ?? '–'}</Badge></TableCell>
                            <TableCell>{r.total_time ?? '–'}</TableCell>
                            <TableCell>{r.fastest_lap ?? '–'}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{r.penalty_note ?? ''}</TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
