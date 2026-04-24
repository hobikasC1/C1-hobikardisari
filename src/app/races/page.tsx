'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format, formatDistanceToNow, isFuture, isToday } from 'date-fns';
import { et } from 'date-fns/locale';
import { Calendar, Plus, Pencil, Trash2, MapPin, Clock, ChevronRight, Hash, AlertTriangle, ChevronLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import PageLayout from '@/components/PageLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Event, EventStatus } from '@/types/database';
import { getEvents, getActiveSeasonId, createEvent, updateEvent, deleteEvent } from './actions';

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<EventStatus, string> = {
  draft: 'Mustand',
  in_progress: 'Käimas',
  completed: 'Lõppenud',
  published: 'Avaldatud',
};

const STATUS_VARIANTS: Record<EventStatus, 'secondary' | 'default' | 'outline' | 'destructive'> = {
  draft: 'secondary',
  in_progress: 'default',
  completed: 'outline',
  published: 'outline',
};

const STATUS_OPTIONS: EventStatus[] = ['draft', 'in_progress', 'completed', 'published'];

// ---------------------------------------------------------------------------
// Form types
// ---------------------------------------------------------------------------

interface EventFormData {
  name: string;
  venue: string;
  event_date: string;
  max_karts: number;
  kart_numbers_str: string;
  status: EventStatus;
  sort_order: number;
}

const emptyForm: EventFormData = {
  name: '',
  venue: '',
  event_date: '',
  max_karts: 9,
  kart_numbers_str: '',
  status: 'draft',
  sort_order: 1,
};

const DEFAULT_EVENTS: Partial<EventFormData>[] = [
  { name: '1. etapp – Rapla kardirada', venue: 'Rapla kardirada', sort_order: 1 },
  { name: '2. etapp – Raassilla/Porsche', venue: 'Raassilla/Porsche', sort_order: 2 },
  { name: '3. etapp – Kuningamäe kardirada', venue: 'Kuningamäe kardirada', sort_order: 3 },
  { name: '4. etapp – Käina kardirada', venue: 'Käina kardirada', sort_order: 4 },
  { name: '5. etapp – Unibet Kardikeskus', venue: 'Unibet Kardikeskus', sort_order: 5 },
  { name: '6. etapp – Aravete kardirada', venue: 'Aravete kardirada', sort_order: 6 },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RacesPage() {
  const { toast } = useToast();
  const router = useRouter();

  const [events, setEvents] = useState<Event[]>([]);
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [form, setForm] = useState<EventFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Event | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteDoubleConfirmOpen, setDeleteDoubleConfirmOpen] = useState(false);

  const [seedConfirmOpen, setSeedConfirmOpen] = useState(false);

  // Load data
  const loadData = useCallback(async () => {
    try {
      const [eventsData, sid] = await Promise.all([getEvents(), getActiveSeasonId()]);
      setEvents(eventsData);
      setSeasonId(sid);
    } catch {
      toast({ title: 'Viga', description: 'Etappide laadimine ebaõnnestus.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  // Seed 6 default events
  const handleSeedEvents = async () => {
    if (!seasonId) return;
    setSeedConfirmOpen(false);
    try {
      for (const def of DEFAULT_EVENTS) {
        await createEvent({
          season_id: seasonId,
          name: def.name!,
          venue: def.venue ?? null,
          event_date: null,
          max_karts: 9,
          available_kart_numbers: [],
          status: 'draft',
          sort_order: def.sort_order ?? 1,
        });
      }
      toast({ title: '6 etappi loodud!' });
      await loadData();
    } catch {
      toast({ title: 'Viga', description: 'Etappide loomine ebaõnnestus.', variant: 'destructive' });
    }
  };

  // Dialog open helpers
  const openCreate = () => {
    setEditingEvent(null);
    setForm({ ...emptyForm, sort_order: events.length + 1 });
    setDialogOpen(true);
  };

  const openEdit = (ev: Event) => {
    setEditingEvent(ev);
    setForm({
      name: ev.name,
      venue: ev.venue ?? '',
      event_date: ev.event_date ?? '',
      max_karts: ev.max_karts,
      kart_numbers_str: ev.available_kart_numbers.join(', '),
      status: ev.status,
      sort_order: ev.sort_order,
    });
    setDialogOpen(true);
  };

  // Save
  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Nimi on kohustuslik', variant: 'destructive' });
      return;
    }
    if (!seasonId) {
      toast({ title: 'Aktiivne hooaeg puudub', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const kartNumbers = form.kart_numbers_str
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));

      if (editingEvent) {
        await updateEvent(editingEvent.id, {
          name: form.name.trim(),
          venue: form.venue.trim() || null,
          event_date: form.event_date || null,
          max_karts: form.max_karts,
          available_kart_numbers: kartNumbers,
          status: form.status,
          sort_order: form.sort_order,
        });
        toast({ title: 'Etapp uuendatud!' });
      } else {
        await createEvent({
          season_id: seasonId,
          name: form.name.trim(),
          venue: form.venue.trim() || null,
          event_date: form.event_date || null,
          max_karts: form.max_karts,
          available_kart_numbers: kartNumbers,
          status: form.status,
          sort_order: form.sort_order,
        });
        toast({ title: 'Etapp loodud!' });
      }
      setDialogOpen(false);
      await loadData();
    } catch (err) {
      toast({ title: 'Viga', description: String(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Delete flow
  const startDelete = (ev: Event) => {
    setDeleteTarget(ev);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteFirst = () => {
    setDeleteConfirmOpen(false);
    setDeleteDoubleConfirmOpen(true);
  };

  const confirmDeleteFinal = async () => {
    if (!deleteTarget) return;
    setDeleteDoubleConfirmOpen(false);
    try {
      await deleteEvent(deleteTarget.id);
      toast({ title: 'Etapp kustutatud!' });
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      toast({ title: 'Viga', description: String(err), variant: 'destructive' });
    }
  };

  // Next upcoming event
  const nextEvent = events.find(
    (e) => e.event_date && (isFuture(new Date(e.event_date)) || isToday(new Date(e.event_date)))
  );

  // Loading
  if (loading) {
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Võistluskalender 2026</h1>
            <p className="text-muted-foreground mt-1">Halda hooaja etappe</p>
          </div>
        </div>
        <div className="flex gap-2">
          {events.length === 0 && (
            <Button variant="outline" onClick={() => setSeedConfirmOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Lisa 6 etappi
            </Button>
          )}
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Lisa etapp
          </Button>
        </div>
      </div>

      {/* Next event countdown */}
      {nextEvent && nextEvent.event_date && (
        <Card className="mb-6 border-primary/30 bg-primary/5">
          <CardContent className="flex items-center gap-4 py-4">
            <Clock className="h-6 w-6 text-primary" />
            <div>
              <p className="font-semibold text-lg">{nextEvent.name}</p>
              <p className="text-muted-foreground">
                {format(new Date(nextEvent.event_date), 'd. MMMM yyyy', { locale: et })}
                {' — '}
                {formatDistanceToNow(new Date(nextEvent.event_date), { addSuffix: true, locale: et })}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Events list */}
      {events.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Calendar className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg">Etappe pole veel lisatud.</p>
            <p className="text-sm mt-1">Vajuta &quot;Lisa 6 etappi&quot; et luua hooaja kalender automaatselt.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {events.map((ev) => {
            const dateObj = ev.event_date ? new Date(ev.event_date) : null;
            const isUpcoming = dateObj && isFuture(dateObj);
            const isNow = dateObj && isToday(dateObj);

            return (
              <Card
                key={ev.id}
                className={`transition-all ${
                  isNow ? 'border-primary shadow-md' : isUpcoming ? 'border-primary/20' : ''
                }`}
              >
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                    {ev.sort_order}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-lg truncate">{ev.name}</h3>
                      <Badge variant={STATUS_VARIANTS[ev.status]}>
                        {STATUS_LABELS[ev.status]}
                      </Badge>
                      {isNow && <Badge variant="default">Täna!</Badge>}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      {ev.venue && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {ev.venue}
                        </span>
                      )}
                      {dateObj && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(dateObj, 'd. MMMM yyyy', { locale: et })}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Hash className="h-3.5 w-3.5" />
                        Max {ev.max_karts} karti
                      </span>
                      {ev.available_kart_numbers.length > 0 && (
                        <span className="text-xs">
                          Kardid: {ev.available_kart_numbers.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(ev)} title="Muuda">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => startDelete(ev)}
                      title="Kustuta"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/races/${ev.id}`)}
                      className="ml-2"
                    >
                      Halda
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingEvent ? 'Muuda etappi' : 'Lisa uus etapp'}</DialogTitle>
            <DialogDescription>
              {editingEvent ? 'Uuenda etapi andmeid.' : 'Sisesta etapi info.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="ev-name">Nimi *</Label>
              <Input
                id="ev-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="nt. 1. etapp – Rapla kardirada"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ev-venue">Koht</Label>
              <Input
                id="ev-venue"
                value={form.venue}
                onChange={(e) => setForm({ ...form, venue: e.target.value })}
                placeholder="Rapla kardirada"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ev-date">Kuupäev</Label>
              <Input
                id="ev-date"
                type="date"
                value={form.event_date}
                onChange={(e) => setForm({ ...form, event_date: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="ev-max-karts">Max karti</Label>
                <Input
                  id="ev-max-karts"
                  type="number"
                  min={1}
                  max={50}
                  value={form.max_karts}
                  onChange={(e) => setForm({ ...form, max_karts: parseInt(e.target.value, 10) || 9 })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="ev-sort">Järjekord</Label>
                <Input
                  id="ev-sort"
                  type="number"
                  min={1}
                  max={20}
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value, 10) || 1 })}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ev-karts">Kardinumbrid (komaga eraldatud)</Label>
              <Input
                id="ev-karts"
                value={form.kart_numbers_str}
                onChange={(e) => setForm({ ...form, kart_numbers_str: e.target.value })}
                placeholder="nt. 1, 2, 3, 4, 5, 6, 7, 8, 9"
              />
              <p className="text-xs text-muted-foreground">
                Jäta tühjaks kui kardinumbreid pole veel teada.
              </p>
            </div>

            <div className="grid gap-2">
              <Label>Staatus</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as EventStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Tühista
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvestamine...' : editingEvent ? 'Salvesta' : 'Loo etapp'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Seed confirm */}
      <AlertDialog open={seedConfirmOpen} onOpenChange={setSeedConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lisa 6 etappi automaatselt?</AlertDialogTitle>
            <AlertDialogDescription>
              Luuakse 2026. hooaja 6 etappi vaikimisi radade nimedega. Saad hiljem kuupäevi ja muid andmeid muuta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Tühista</AlertDialogCancel>
            <AlertDialogAction onClick={handleSeedEvents}>Lisa etapid</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete first confirm */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kustuta etapp?</AlertDialogTitle>
            <AlertDialogDescription>
              Kas oled kindel, et soovid kustutada etapi &quot;{deleteTarget?.name}&quot;?
              Koos etapiga kustutatakse kõik sellega seotud andmed (osalejad, tulemused jne).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Tühista</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteFirst} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Jah, kustuta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete double confirm */}
      <AlertDialog open={deleteDoubleConfirmOpen} onOpenChange={setDeleteDoubleConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Viimane kinnitus
            </AlertDialogTitle>
            <AlertDialogDescription>
              See toiming on pöördumatu. Etapi &quot;{deleteTarget?.name}&quot; kõik andmed kustutatakse jäädavalt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Tühista</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteFinal} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Kustuta jäädavalt
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
}