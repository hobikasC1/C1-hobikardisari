'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format, formatDistanceToNow, isFuture, isToday } from 'date-fns';
import { et } from 'date-fns/locale';
import { Calendar, Users, Medal, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import PageLayout from '@/components/PageLayout';
import type { Event } from '@/types/database';
import { getEvents } from './races/actions';

export default function HomePage() {
  const [nextEvent, setNextEvent] = useState<Event | null>(null);

  useEffect(() => {
    getEvents().then((events) => {
      const upcoming = events.find(
        (e) => e.event_date && (isFuture(new Date(e.event_date)) || isToday(new Date(e.event_date)))
      );
      setNextEvent(upcoming ?? null);
    }).catch(() => {});
  }, []);

  return (
    <PageLayout>
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Tere tulemast!</h1>
        <p className="mt-4 text-lg text-muted-foreground">Halda oma kardivõistlusi ühest kohast.</p>
      </div>

      {/* Next event countdown */}
      {nextEvent && nextEvent.event_date && (
        <Card className="mb-8 max-w-2xl mx-auto border-primary/30 bg-primary/5">
          <CardContent className="flex items-center gap-4 py-5">
            <Clock className="h-7 w-7 text-primary flex-shrink-0" />
            <div>
              <p className="font-semibold text-lg">Järgmine etapp: {nextEvent.name}</p>
              <p className="text-muted-foreground">
                {format(new Date(nextEvent.event_date), 'd. MMMM yyyy', { locale: et })}
                {' — '}
                {formatDistanceToNow(new Date(nextEvent.event_date), { addSuffix: true, locale: et })}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        <Link href="/races" className="group">
          <Card className="h-full hover:border-primary hover:shadow-lg transition-all duration-300">
            <CardHeader className="items-center">
              <div className="p-4 bg-primary/10 rounded-full">
                <Calendar className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="mt-4 text-2xl">Võistluskalender</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center">
                Halda etappe, lisa osalejaid, sisesta aegu ja vaata tulemusi reaalajas.
              </CardDescription>
            </CardContent>
          </Card>
        </Link>

        <Link href="/drivers" className="group">
          <Card className="h-full hover:border-primary hover:shadow-lg transition-all duration-300">
            <CardHeader className="items-center">
              <div className="p-4 bg-primary/10 rounded-full">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="mt-4 text-2xl">Sõitjad/meeskonnad</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center">
                Halda sõitjaid ja meeskondi, vaata nende nimekirju ja andmeid.
              </CardDescription>
            </CardContent>
          </Card>
        </Link>

        <Link href="/standings" className="group">
          <Card className="h-full hover:border-primary hover:shadow-lg transition-all duration-300">
            <CardHeader className="items-center">
              <div className="p-4 bg-primary/10 rounded-full">
                <Medal className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="mt-4 text-2xl">Punktitabel</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center">
                Jälgi hooaja üldist punktiseisu ja sõitjate edetabelit.
              </CardDescription>
            </CardContent>
          </Card>
        </Link>
      </div>
    </PageLayout>
  );
}
