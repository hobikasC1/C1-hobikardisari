'use client';

import PageLayout from '@/components/PageLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shapes, Weight, Users, Star, Sparkles } from 'lucide-react';

export default function ClassesPage() {
  return (
    <PageLayout backHref="/">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shapes className="h-6 w-6 text-primary" />
            <CardTitle>Võistlusklassid</CardTitle>
          </div>
          <CardDescription>
            Hooaja jooksul kasutatavad põhiklassid ja eriauhinnad.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div>
            <h3 className="text-xl font-semibold mb-4 text-center">Põhiklassid</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-center">
              <div className="flex flex-col items-center p-4 rounded-lg">
                <Weight className="h-10 w-10 text-primary mb-2" />
                <h4 className="text-lg font-bold">Junior</h4>
                <p className="text-muted-foreground">kuni 65 kg</p>
              </div>
              <div className="flex flex-col items-center p-4 rounded-lg">
                <Weight className="h-10 w-10 text-primary mb-2" />
                <h4 className="text-lg font-bold">Standard</h4>
                <p className="text-muted-foreground">65–85 kg</p>
              </div>
              <div className="flex flex-col items-center p-4 rounded-lg">
                <Weight className="h-10 w-10 text-primary mb-2" />
                <h4 className="text-lg font-bold">Heavy</h4>
                <p className="text-muted-foreground">90–105 kg</p>
              </div>
              <div className="flex flex-col items-center p-4 rounded-lg">
                <Users className="h-10 w-10 text-primary mb-2" />
                <h4 className="text-lg font-bold">Team</h4>
                <p className="text-muted-foreground">Võistkondlik arvestus</p>
              </div>
            </div>
          </div>

          <div className="border-t pt-8">
            <h3 className="text-xl font-semibold mb-6 text-center">Eriauhinnad</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
              <div className="border-2 border-foreground rounded-lg p-6 flex flex-col items-center text-center">
                <Star className="h-10 w-10 text-primary mb-3" />
                <h4 className="text-xl font-bold">Parim Uustulnuk</h4>
                <p className="text-muted-foreground mt-1">Parim uustulnuk hooaja kokkuvõttes.</p>
              </div>
              <div className="border-2 border-foreground rounded-lg p-6 flex flex-col items-center text-center">
                <Sparkles className="h-10 w-10 text-primary mb-3" />
                <h4 className="text-xl font-bold">Parim Naisvõistleja</h4>
                <p className="text-muted-foreground mt-1">Hooaja parim naisvõistleja.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </PageLayout>
  );
}
