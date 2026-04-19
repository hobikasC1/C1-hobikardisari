'use client';

import Link from 'next/link';
import { Calendar, Users, Medal } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import PageLayout from '@/components/PageLayout';

export default function HomePage() {
  return (
    <PageLayout>
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Tere tulemast!</h1>
        <p className="mt-4 text-lg text-muted-foreground">Halda oma kardivõistlusi ühest kohast.</p>
      </div>
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
