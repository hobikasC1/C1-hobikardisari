
'use client';

import React, { useState, useEffect } from 'react';
import PageLayout from '@/components/PageLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trophy } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import standingsData from '@/lib/2025_standings_data.json';

interface Standing {
  participantId: string;
  participantName: string;
  participantClass: string;
  totalPoints: number;
  pointsByEvent: Record<string, number>;
}

export default function Standings2025Page() {
  const [isLoading, setIsLoading] = useState(true);
  const [standings, setStandings] = useState<Standing[]>([]);

  useEffect(() => {
    // Type assertion to make TypeScript happy with the imported JSON
    const typedStandings = standingsData as Standing[];
    setStandings(typedStandings);
    setIsLoading(false);
  }, []);

  const eventNames = standings.length > 0 ? Object.keys(standings[0].pointsByEvent) : [];

  return (
    <PageLayout backHref="/standings">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trophy className="h-6 w-6 text-primary" />
            <CardTitle>2025. Aasta Üldarvestus</CardTitle>
          </div>
          <CardDescription>
            Hooaja 2025 ametlik lõplik punktitabel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
             <div className="flex justify-center items-center py-10">
                <LoadingSpinner size={32} />
             </div>
          ) : standings.length > 0 ? (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Koht</TableHead>
                        <TableHead>Sõitja</TableHead>
                        <TableHead>Klass</TableHead>
                        {eventNames.map(event => <TableHead key={event} className="text-center">{event}</TableHead>)}
                        <TableHead className="text-right font-bold">Kokku</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {standings.map((s, index) => (
                        <TableRow key={s.participantId}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell>{s.participantName}</TableCell>
                            <TableCell>{s.participantClass || 'Harrastaja'}</TableCell>
                             {eventNames.map(event => (
                                <TableCell key={event} className="text-center">{s.pointsByEvent[event] ?? '-'}</TableCell>
                            ))}
                            <TableCell className="text-right font-bold">{s.totalPoints}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-10">
              2025. aasta üldarvestuse andmed puuduvad.
            </p>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  );
}
