
'use client';

// ============================================================
// Standings page — Supabase-backed, replaces localStorage version
// ============================================================

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageLayout from '@/components/PageLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trophy, Users, RefreshCw, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { getSeasonStandings, type SeasonStandingsData, type DriverStandingRow, type TeamStandingRow } from './actions';
import type { Event } from '@/types/database';

// ---- Helpers --------------------------------------------------

function eventShort(_event: Event, index: number): string {
  return `E${index + 1}`;
}

function RankCell({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-lg">🥇</span>;
  if (rank === 2) return <span className="text-lg">🥈</span>;
  if (rank === 3) return <span className="text-lg">🥉</span>;
  return <span className="text-muted-foreground">{rank}</span>;
}

// ---- Driver standings table -----------------------------------

function DriverStandingsTable({ rows, events }: { rows: DriverStandingRow[]; events: Event[] }) {
  if (rows.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <Trophy className="mx-auto h-10 w-10 mb-3 opacity-30" />
        <p>Tulemusi pole veel sisestatud.</p>
        <p className="text-sm mt-1">Punktid arvutatakse lõppenud ja avaldatud etappide pealt.</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 text-center">#</TableHead>
            <TableHead>Nimi</TableHead>
            {events.map((e, i) => (
              <TableHead key={e.id} className="text-center w-14" title={e.name}>
                {eventShort(e, i)}
              </TableHead>
            ))}
            <TableHead className="text-center font-bold w-16">Kokku</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={row.driverId} className={i < 3 ? 'font-medium' : ''}>
              <TableCell className="text-center"><RankCell rank={i + 1} /></TableCell>
              <TableCell>{row.driverName}</TableCell>
              {events.map((e) => {
                const pts = row.pointsByEvent[e.id];
                const isScored = e.status === 'completed' || e.status === 'published';
                return (
                  <TableCell key={e.id} className="text-center text-sm">
                    {pts != null ? (
                      <span className="font-medium">{pts}</span>
                    ) : isScored ? (
                      <span className="text-muted-foreground">0</span>
                    ) : (
                      <span className="text-muted-foreground/50">–</span>
                    )}
                  </TableCell>
                );
              })}
              <TableCell className="text-center font-bold text-primary">{row.totalPoints}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ---- Team standings table -------------------------------------

function TeamStandingsTable({ rows, events }: { rows: TeamStandingRow[]; events: Event[] }) {
  if (rows.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <Users className="mx-auto h-10 w-10 mb-3 opacity-30" />
        <p>Meeskondi pole registreeritud.</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 text-center">#</TableHead>
            <TableHead>Meeskond</TableHead>
            {events.map((e, i) => (
              <TableHead key={e.id} className="text-center w-14" title={e.name}>
                {eventShort(e, i)}
              </TableHead>
            ))}
            <TableHead className="text-center font-bold w-16">Kokku</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={row.teamId} className={i < 3 ? 'font-medium' : ''}>
              <TableCell className="text-center"><RankCell rank={i + 1} /></TableCell>
              <TableCell>{row.teamName}</TableCell>
              {events.map((e) => {
                const pts = row.pointsByEvent[e.id];
                const isScored = e.status === 'completed' || e.status === 'published';
                return (
                  <TableCell key={e.id} className="text-center text-sm">
                    {pts != null ? (
                      <span className="font-medium">{pts}</span>
                    ) : isScored ? (
                      <span className="text-muted-foreground">0</span>
                    ) : (
                      <span className="text-muted-foreground/50">–</span>
                    )}
                  </TableCell>
                );
              })}
              <TableCell className="text-center font-bold text-primary">{row.totalPoints}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ---- Page component -------------------------------------------

export default function StandingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = useState<SeasonStandingsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getSeasonStandings();
      setData(result);
    } catch (err) {
      toast({ title: 'Viga', description: String(err), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  return (
    <PageLayout>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Trophy className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Punktitabel 2026</h1>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Uuenda
        </Button>
      </div>

      {loading || !data ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <>
          {/* Event legend */}
          <div className="flex flex-wrap gap-2 mb-4">
            {data.events.map((e, i) => (
              <Badge
                key={e.id}
                variant={e.status === 'published' ? 'default' : e.status === 'completed' ? 'secondary' : 'outline'}
                className="text-xs"
              >
                E{i + 1} — {e.name}
              </Badge>
            ))}
          </div>

          <Card>
            <CardContent className="pt-4">
              <Tabs defaultValue="standard">
                <TabsList className="mb-4">
                  <TabsTrigger value="junior">Junior ({data.juniorStandings.length})</TabsTrigger>
                  <TabsTrigger value="standard">Standard ({data.standardStandings.length})</TabsTrigger>
                  <TabsTrigger value="heavy">Heavy ({data.heavyStandings.length})</TabsTrigger>
                  <TabsTrigger value="teams">
                    <Users className="mr-1 h-3.5 w-3.5" />
                    Tiimid ({data.teamStandings.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="junior">
                  <DriverStandingsTable rows={data.juniorStandings} events={data.events} />
                </TabsContent>
                <TabsContent value="standard">
                  <DriverStandingsTable rows={data.standardStandings} events={data.events} />
                </TabsContent>
                <TabsContent value="heavy">
                  <DriverStandingsTable rows={data.heavyStandings} events={data.events} />
                </TabsContent>
                <TabsContent value="teams">
                  <TeamStandingsTable rows={data.teamStandings} events={data.events} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground mt-4 text-center">
            Punktid arvutatakse lõppenud ja avaldatud etappide põhjal.
            Eelsõidu punktid: 1.=13, 2.=11, 3.–12.=10–1. ·
            Finaali punktid klassi arvestuses: 1.=35, 2.=31, 3.=28… ·
            Kiireim ring: üldine=3p, grupi=1p.
          </p>
        </>
      )}
    </PageLayout>
  );
}
