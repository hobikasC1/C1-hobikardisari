
'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import type { FinalRace, SeasonStanding, Team, TeamStanding } from '@/types';
import PageLayout from '@/components/PageLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Trophy, RefreshCw, Shapes, Weight, Users, Star, Sparkles, ChevronRight } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';

const LOCAL_STORAGE_PREFIX = 'hobbyKarting_';
const LS_TEAMS = `${LOCAL_STORAGE_PREFIX}teams`;
const RACE_CALENDAR = [
  '1. Rapla kardirada', '2. Raassilla/Porsche', '3. Põltsamaa(Kuningamäe)', '4. Käina kardirada', '5.Unibet Kardikeskus', '6.Aravete kardirada'
];

const getDynamicLsKeys = (event: string) => {
  if (!event) return { LS_FINALS: '' };
  const eventPrefix = `${LOCAL_STORAGE_PREFIX}${event.replace(/[^a-zA-Z0-9]/g, '_')}_`;
  return {
    LS_FINALS: `${eventPrefix}finals`,
  };
};

const StandingsTableByClass: React.FC<{ standings: SeasonStanding[] }> = ({ standings }) => {
  const standingsByClass = standings.reduce((acc, s) => {
    const pClass = s.participantClass;
    if (!pClass || pClass === 'Team') return acc;
    if (!acc[pClass]) {
      acc[pClass] = [];
    }
    acc[pClass].push(s);
    return acc;
  }, {} as Record<string, SeasonStanding[]>);

  const classOrder = ["Junior", "Standard", "Heavy"];

  return (
    <Accordion type="single" collapsible className="w-full" defaultValue='Standard'>
      {classOrder.map(c => {
        const classStandings = standingsByClass[c] || [];
        return (
          <AccordionItem value={c} key={c}>
            <AccordionTrigger className="text-xl font-semibold">
              {c}
            </AccordionTrigger>
            <AccordionContent>
              {classStandings.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Koht</TableHead>
                        <TableHead>Sõitja</TableHead>
                        {RACE_CALENDAR.map((event, index) => (
                          <TableHead key={event} className="text-center" title={event}>{`E${index + 1}`}</TableHead>
                        ))}
                        <TableHead className="text-right font-bold">KOKKU</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {classStandings.map((s, index) => (
                        <TableRow key={s.participantId}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>{s.participantName}</TableCell>
                          {RACE_CALENDAR.map((event) => (
                            <TableCell key={event} className="text-center">{s.pointsByEvent[event] ?? 0}</TableCell>
                          ))}
                          <TableCell className="text-right font-bold">{s.totalPoints}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">Selles klassis punktiarvestus puudub.</p>
              )}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
};


const TeamStandingsTable: React.FC<{ standings: TeamStanding[] }> = ({ standings }) => {
  if (standings.length === 0) {
    return <p className="text-muted-foreground text-center py-4">Meeskondliku arvestuse andmed puuduvad. Arvutamiseks vajuta "Uuenda punkte".</p>;
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Koht</TableHead>
            <TableHead>Meeskond</TableHead>
            {RACE_CALENDAR.map((event, index) => (
              <TableHead key={event} className="text-center" title={event}>{`E${index + 1}`}</TableHead>
            ))}
            <TableHead className="text-right font-bold">KOKKU</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {standings.map((s, index) => (
            <TableRow key={s.teamId}>
              <TableCell>{index + 1}</TableCell>
              <TableCell>{s.teamName}</TableCell>
              {RACE_CALENDAR.map((event) => (
                <TableCell key={event} className="text-center">{s.pointsByEvent[event] ?? 0}</TableCell>
              ))}
              <TableCell className="text-right font-bold">{s.totalPoints}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};


export default function StandingsPage() {
  const [seasonStandings, setSeasonStandings] = useState<SeasonStanding[]>([]);
  const [teamStandings, setTeamStandings] = useState<TeamStanding[]>([]);
  const [isCalculatingSeason, setIsCalculatingSeason] = useState(false);
  const { toast } = useToast();

  const handleCalculateSeasonStandings = useCallback(async () => {
    setIsCalculatingSeason(true);
    toast({ title: 'Uuendan hooaja punkte...', description: 'Arvutan punktid sisestatud etapiandmete põhjal.' });
    try {
        await new Promise(resolve => setTimeout(resolve, 500)); 

        const aggregatedIndividualData: Record<string, SeasonStanding> = {};
        const aggregatedTeamData: Record<string, TeamStanding> = {};
        
        const allTeamsRaw = localStorage.getItem(LS_TEAMS);
        const allTeams: Team[] = allTeamsRaw ? JSON.parse(allTeamsRaw) : [];
        
        for (const team of allTeams) {
            aggregatedTeamData[team.id] = {
                teamId: team.id,
                teamName: team.name,
                totalPoints: 0,
                pointsByEvent: {}
            };
        }

        for (const eventName of RACE_CALENDAR) {
            const eventKeys = getDynamicLsKeys(eventName);
            const finalsDataRaw = localStorage.getItem(eventKeys.LS_FINALS);
            if (!finalsDataRaw) continue;

            const eventPointsMap = new Map<string, number>();
            try {
                const finalsForEvent: FinalRace[] = JSON.parse(finalsDataRaw);
                const allResults = finalsForEvent.flatMap(f => f.results || []);

                allResults.forEach(p => {
                    const points = p.eventPoints ?? 0;
                    eventPointsMap.set(p.id, points);
                    
                    if (points > 0 || aggregatedIndividualData[p.id]) {
                        if (!aggregatedIndividualData[p.id]) {
                            aggregatedIndividualData[p.id] = {
                                participantId: p.id,
                                participantName: p.name,
                                participantClass: p.class,
                                totalPoints: 0,
                                pointsByEvent: {}
                            };
                        }
                        aggregatedIndividualData[p.id].totalPoints += points;
                        aggregatedIndividualData[p.id].pointsByEvent[eventName] = points;
                    }
                });
                
                for (const team of allTeams) {
                    const p1_points = eventPointsMap.get(team.driver1Id) ?? 0;
                    const p2_points = eventPointsMap.get(team.driver2Id) ?? 0;
                    const sub_points = team.substituteDriverId ? (eventPointsMap.get(team.substituteDriverId) ?? 0) : 0;
                    
                    let teamEventPoints = 0;
                    
                    if (team.substituteUsedOnEvent === eventName && sub_points > 0) {
                        const p1_participated = p1_points > 0;
                        const p2_participated = p2_points > 0;
                        
                        if (p1_participated && !p2_participated) {
                            teamEventPoints = p1_points + sub_points;
                        } else if (!p1_participated && p2_participated) {
                            teamEventPoints = p2_points + sub_points;
                        } else if (!p1_participated && !p2_participated) {
                            teamEventPoints = sub_points; 
                        }
                        else {
                            teamEventPoints = p1_points + p2_points;
                        }
                    } else {
                        teamEventPoints = p1_points + p2_points;
                    }
                    
                    if(aggregatedTeamData[team.id]) {
                        aggregatedTeamData[team.id].pointsByEvent[eventName] = teamEventPoints;
                        aggregatedTeamData[team.id].totalPoints += teamEventPoints;
                    }
                }

            } catch (e) {
                console.error(`Error processing event ${eventName}:`, e);
            }
        }

        const standingsArray = Object.values(aggregatedIndividualData).sort((a, b) => b.totalPoints - a.totalPoints);
        setSeasonStandings(standingsArray);
        
        const teamStandingsArray = Object.values(aggregatedTeamData).sort((a, b) => b.totalPoints - a.totalPoints);
        setTeamStandings(teamStandingsArray);

        if(standingsArray.length > 0 || teamStandingsArray.length > 0) {
            toast({ title: 'Hooaja punktid uuendatud!', description: `Leitud ${standingsArray.length} sõitjat ja ${teamStandingsArray.length} meeskonda.` });
        } else {
            toast({ title: 'Andmeid ei leitud', description: 'Punktide arvutamiseks ei leitud ühtegi tulemust. Lisa esmalt andmeid etappidele.', variant: 'default' });
        }

    } catch (error) {
        console.error("Failed to calculate season standings:", error);
        toast({ title: 'Viga!', description: 'Hooaja punktide arvutamine ebaõnnestus.', variant: 'destructive' });
    } finally {
        setIsCalculatingSeason(false);
    }
  }, [toast]);

  return (
    <PageLayout backHref="/">
       <div className="mb-8 flex justify-end">
            <Button asChild>
                <Link href="/standings/2025">
                    Vaata 2025 tulemusi <ChevronRight className="ml-2 h-4 w-4" />
                </Link>
            </Button>
        </div>

      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shapes className="h-6 w-6 text-primary" />
              <CardTitle>Võistlusklassid ja eriauhinnad</CardTitle>
            </div>
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

       <Card>
          <CardHeader>
              <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                      <Trophy size={24} className="text-primary"/>
                      <CardTitle className="text-xl">Hooaja Üldtabel</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                      <Button onClick={handleCalculateSeasonStandings} disabled={isCalculatingSeason}>
                          {isCalculatingSeason ? <LoadingSpinner size={16} className="mr-2" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                          {isCalculatingSeason ? 'Arvutan...' : 'Uuenda punkte'}
                      </Button>
                  </div>
              </div>
               <CardDescription>
                  Jälgi hooaja üldist punktiseisu ja sõitjate edetabelit klasside kaupa. Andmete uuendamiseks vajuta nuppu.
              </CardDescription>
          </CardHeader>
          <CardContent>
              {isCalculatingSeason ? (
                 <div className="flex justify-center items-center py-10">
                    <LoadingSpinner size={32} />
                 </div>
              ) : (
                <div className='space-y-8'>
                  <StandingsTableByClass standings={seasonStandings} />
                  <Separator />
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                        <Users size={24} className="text-primary"/>
                        <h3 className="text-xl font-semibold">Meeskondlik arvestus</h3>
                    </div>
                    <TeamStandingsTable standings={teamStandings} />
                  </div>
                </div>
              )}
          </CardContent>
      </Card>
    </PageLayout>
  );
}
