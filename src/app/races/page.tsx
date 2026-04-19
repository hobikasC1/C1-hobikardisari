'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import type { Participant, QualificationGroup, AppStep, Heat, FinalRace, ResultInput } from '@/types';
import { useToast } from "@/hooks/use-toast";
import { v4 as uuidv4 } from 'uuid';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

import PageLayout from '@/components/PageLayout';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from '@/components/ui/label';
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle, Users, Shuffle, Timer, Flag, Trophy, Trash2, ArrowRight, ArrowLeft, Zap, ListOrdered, BarChart3, Medal, Download, CheckCircle as CheckCircleIcon, Move } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DriverFormDialog, { driverFormSchema, type DriverFormValues } from '@/components/DriverFormDialog';

import { STEP_ORDER, STEP_LABELS, RACE_CALENDAR, LS_ALL_DRIVERS } from './constants';
import { 
  cleanName, 
  parseLapTimeToMillis, 
  millisToTimeStr, 
  getDynamicLsKeys, 
  assignKartsToMinimizeRepeats,
  generateHeatsWithStaggeredGrid,
  generateFinalsFromRankedHeats,
  calculateEventPoints
} from './utils';

export default function RacesPageWrapper() {
  return (
    <React.Suspense fallback={<PageLayout backHref="/"><LoadingSpinner className="mx-auto mt-10" size={48} /></PageLayout>}>
      <RacesPage />
    </React.Suspense>
  );
}

function RacesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventParam = searchParams.get('event');
  const [isClientMounted, setIsClientMounted] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<AppStep>('participants');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantNamesInput, setParticipantNamesInput] = useState<string>("");
  const [qualificationGroups, setQualificationGroups] = useState<QualificationGroup[]>([]);
  const [newGroupName, setNewGroupName] = useState<string>('');
  const [selectedParticipantsForGroup, setSelectedParticipantsForGroup] = useState<string[]>([]);
  const [sessionKartCapacity, setSessionKartCapacity] = useState<string>("10");
  const [availableKartNumbersInput, setAvailableKartNumbersInput] = useState<string>("1,2,3,4,5,6,7,8,9,10");
  const [heats, setHeats] = useState<Heat[]>([]);
  const [heatResultsInput, setHeatResultsInput] = useState<ResultInput>({});
  const [finals, setFinals] = useState<FinalRace[]>([]);
  const [finalResultsInput, setFinalResultsInput] = useState<ResultInput>({});
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Participant | null>(null);
  const { toast } = useToast();
  
  const DYNAMIC_LS_KEYS = useMemo(() => getDynamicLsKeys(selectedEvent || ''), [selectedEvent]);

  const form = useForm<DriverFormValues>({
    resolver: zodResolver(driverFormSchema),
    defaultValues: { name: "" },
  });

  const performFullReset = useCallback(() => {
    setParticipants([]);
    setParticipantNamesInput("");
    setQualificationGroups([]);
    setNewGroupName('');
    setSelectedParticipantsForGroup([]);
    setSessionKartCapacity("10");
    setAvailableKartNumbersInput("1,2,3,4,5,6,7,8,9,10");
    setHeats([]);
    setHeatResultsInput({});
    setFinals([]);
    setFinalResultsInput({});
    setCurrentStep('participants');
  }, []);

  useEffect(() => {
    setIsClientMounted(true);
    if (eventParam && RACE_CALENDAR.includes(eventParam)) setSelectedEvent(eventParam);
    else setSelectedEvent(null);
  }, [eventParam]);

  useEffect(() => {
    if (!isClientMounted || !selectedEvent) return;
    const keys = getDynamicLsKeys(selectedEvent);
    const storedP = localStorage.getItem(keys.LS_PARTICIPANTS);
    if (storedP) try { setParticipants(JSON.parse(storedP)); } catch (e) {}
    const storedG = localStorage.getItem(keys.LS_QUALIFICATION_GROUPS);
    if (storedG) try { setQualificationGroups(JSON.parse(storedG)); } catch (e) {}
    const storedC = localStorage.getItem(keys.LS_SESSION_KART_CAPACITY);
    if (storedC) setSessionKartCapacity(storedC);
    const storedA = localStorage.getItem(keys.LS_AVAILABLE_KART_NUMBERS);
    if (storedA) setAvailableKartNumbersInput(storedA);
    const storedH = localStorage.getItem(keys.LS_HEATS);
    if (storedH) try { setHeats(JSON.parse(storedH)); } catch (e) {}
    const storedHR = localStorage.getItem(keys.LS_HEAT_RESULTS_INPUT);
    if (storedHR) try { setHeatResultsInput(JSON.parse(storedHR)); } catch (e) {}
    const storedF = localStorage.getItem(keys.LS_FINALS);
    if (storedF) try { setFinals(JSON.parse(storedF)); } catch (e) {}
    const storedFR = localStorage.getItem(keys.LS_FINAL_RESULTS_INPUT);
    if (storedFR) try { setFinalResultsInput(JSON.parse(storedFR)); } catch (e) {}
    const storedStep = localStorage.getItem(keys.LS_CURRENT_STEP) as AppStep | null;
    if (storedStep && STEP_ORDER.includes(storedStep)) setCurrentStep(storedStep);
  }, [isClientMounted, selectedEvent]);

  useEffect(() => {
    if (isClientMounted && selectedEvent && DYNAMIC_LS_KEYS.LS_PARTICIPANTS) {
        localStorage.setItem(DYNAMIC_LS_KEYS.LS_PARTICIPANTS, JSON.stringify(participants));
        localStorage.setItem(DYNAMIC_LS_KEYS.LS_QUALIFICATION_GROUPS, JSON.stringify(qualificationGroups));
        localStorage.setItem(DYNAMIC_LS_KEYS.LS_SESSION_KART_CAPACITY, sessionKartCapacity);
        localStorage.setItem(DYNAMIC_LS_KEYS.LS_AVAILABLE_KART_NUMBERS, availableKartNumbersInput);
        localStorage.setItem(DYNAMIC_LS_KEYS.LS_HEATS, JSON.stringify(heats));
        localStorage.setItem(DYNAMIC_LS_KEYS.LS_HEAT_RESULTS_INPUT, JSON.stringify(heatResultsInput));
        localStorage.setItem(DYNAMIC_LS_KEYS.LS_FINALS, JSON.stringify(finals));
        localStorage.setItem(DYNAMIC_LS_KEYS.LS_FINAL_RESULTS_INPUT, JSON.stringify(finalResultsInput));
        localStorage.setItem(DYNAMIC_LS_KEYS.LS_CURRENT_STEP, currentStep);
    }
  }, [participants, qualificationGroups, sessionKartCapacity, availableKartNumbersInput, heats, heatResultsInput, finals, finalResultsInput, currentStep, DYNAMIC_LS_KEYS, isClientMounted, selectedEvent]);

  const handleFullEventReset = useCallback(() => {
    performFullReset();
    if(selectedEvent) {
        const keys = getDynamicLsKeys(selectedEvent);
        Object.values(keys).forEach(key => { if (key) localStorage.removeItem(key) });
    }
    toast({ title: "Andmed kustutatud" });
  }, [performFullReset, selectedEvent, toast]);

  const handleAddParticipantsFromTextarea = () => {
    const names = participantNamesInput.split('\n').map(n => cleanName(n)).filter(n => n.length > 0);
    if (names.length === 0) return;
    let allDrivers: Participant[] = [];
    try {
        const raw = localStorage.getItem(LS_ALL_DRIVERS);
        if (raw) allDrivers = JSON.parse(raw);
    } catch(e) {}
    const allDriversMap = new Map(allDrivers.map(d => [d.name.toLowerCase().trim(), d]));
    const currentIds = new Set(participants.map(p => p.id));
    const toAdd: Participant[] = [];
    const newGlobal: Participant[] = [];
    names.forEach(fullName => {
        const cleaned = cleanName(fullName);
        const lower = cleaned.toLowerCase().trim();
        const existing = allDriversMap.get(lower);
        if (existing) {
            if (!currentIds.has(existing.id)) toAdd.push({ ...existing, name: cleaned });
        } else {
            const p: Participant = { id: uuidv4(), name: cleaned };
            toAdd.push(p);
            newGlobal.push(p);
        }
    });
    if (toAdd.length > 0) {
        setParticipants(prev => [...prev, ...toAdd]);
        if (newGlobal.length > 0) {
            const updated = [...allDrivers, ...newGlobal];
            localStorage.setItem(LS_ALL_DRIVERS, JSON.stringify(updated));
        }
        setParticipantNamesInput('');
        toast({ title: "Osalejad lisatud", description: `${toAdd.length} osalejat.` });
    }
  };

  const handleDisqualifyParticipant = (participantId: string) => {
    setQualificationGroups(prev => prev.map(g => ({ ...g, participants: g.participants.filter(p => p.id !== participantId) })).filter(g => g.participants.length > 0 || g.name));
    setHeats(prev => prev.map(h => ({ ...h, participants: h.participants.filter(p => p.id !== participantId), results: h.results?.filter(p => p.id !== participantId) })).filter(h => h.participants.length > 0 || h.name));
    setFinals(prev => prev.map(f => ({ ...f, participants: f.participants.filter(p => p.id !== participantId), results: f.results?.filter(p => p.id !== participantId) })).filter(f => f.participants.length > 0 || f.name));
    toast({ title: "Sõitja eemaldatud" });
  };

  const handleMoveParticipant = (participantId: string, targetGroupId: string) => {
    setQualificationGroups(prevGroups => {
        const newGroups = JSON.parse(JSON.stringify(prevGroups));
        let p: Participant | null = null;
        for (const group of newGroups) {
            const idx = group.participants.findIndex((item: any) => item.id === participantId);
            if (idx !== -1) { [p] = group.participants.splice(idx, 1); break; }
        }
        if (p) {
            const target = newGroups.find((g: any) => g.id === targetGroupId);
            if (target) { p.kartNumber = null; p.kartNumber2 = null; target.participants.push(p); }
        }
        return newGroups;
    });
    toast({ title: "Sõitja liigutatud" });
  };

  const handleMoveParticipantInHeat = (participantId: string, sourceHeatId: string, targetHeatId: string) => {
    setHeats(prevHeats => {
        const newHeats = JSON.parse(JSON.stringify(prevHeats));
        let p: Participant | null = null;
        const source = newHeats.find((h: any) => h.id === sourceHeatId);
        if (source) {
            const idx = source.participants.findIndex((item: any) => item.id === participantId);
            if (idx !== -1) [p] = source.participants.splice(idx, 1);
        }
        const target = newHeats.find((h: any) => h.id === targetHeatId);
        if (p && target) { p.kartNumber = null; target.participants.push(p); }
        newHeats.forEach((h: any) => h.participants.forEach((item: any, i: number) => item.finalStartingPosition = i + 1));
        return newHeats;
    });
    toast({ title: "Sõitja liigutatud" });
  };

  const handleMoveParticipantInFinal = (participantId: string, sourceFinalId: string, targetFinalId: string) => {
    setFinals(prevFinals => {
        const newFinals = JSON.parse(JSON.stringify(prevFinals));
        let p: Participant | null = null;
        const source = newFinals.find((f: any) => f.id === sourceFinalId);
        if (source) {
            const idx = source.participants.findIndex((item: any) => item.id === participantId);
            if (idx !== -1) [p] = source.participants.splice(idx, 1);
        }
        const target = newFinals.find((f: any) => f.id === targetFinalId);
        if (p && target) { p.kartNumber = null; target.participants.push(p); }
        newFinals.forEach((f: any) => f.participants.forEach((item: any, i: number) => item.finalStartingPosition = i + 1));
        return newFinals;
    });
    toast({ title: "Sõitja liigutatud" });
  };

  const handleCreateQualificationGroup = () => {
    if (!newGroupName || selectedParticipantsForGroup.length === 0) return;
    const pool = availableKartNumbersInput.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
    const selected = participants.filter(p => selectedParticipantsForGroup.includes(p.id));
    const allExisting = qualificationGroups.flatMap(g => g.participants);
    const withQ1 = assignKartsToMinimizeRepeats(selected, pool, [allExisting]);
    const withQ2 = assignKartsToMinimizeRepeats(withQ1, pool, [allExisting, withQ1]);
    const finalP = withQ1.map(p1 => ({ ...p1, kartNumber2: withQ2.find(item => item.id === p1.id)?.kartNumber ?? null }));
    setQualificationGroups(prev => [...prev, { id: uuidv4(), name: newGroupName, participants: finalP }]);
    setNewGroupName('');
    setSelectedParticipantsForGroup([]);
    toast({ title: "Grupp loodud" });
  };

  const handleAutoGenerateGroups = () => {
    const cap = parseInt(sessionKartCapacity, 10);
    const pool = availableKartNumbersInput.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
    if (isNaN(cap) || pool.length === 0) return;
    const unassigned = participants.filter(p => !qualificationGroups.flatMap(g => g.participants.map(item => item.id)).includes(p.id));
    if (unassigned.length === 0) return;
    const numGroups = Math.ceil(unassigned.length / cap);
    const groups: Participant[][] = Array.from({ length: numGroups }, () => []);
    unassigned.forEach((p, i) => {
        const round = Math.floor(i / numGroups);
        const idx = round % 2 === 0 ? i % numGroups : numGroups - 1 - (i % numGroups);
        groups[idx].push(p);
    });
    const newGroups: QualificationGroup[] = [];
    const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    groups.forEach((plist, i) => {
        const allPrev = [...qualificationGroups.flatMap(g => g.participants), ...newGroups.flatMap(g => g.participants)];
        const withQ1 = assignKartsToMinimizeRepeats(plist, pool, [allPrev]);
        const withQ2 = assignKartsToMinimizeRepeats(withQ1, pool, [allPrev, withQ1]);
        const finalP = withQ1.map(p1 => ({ ...p1, kartNumber2: withQ2.find(p => p.id === p1.id)?.kartNumber ?? null }));
        newGroups.push({ id: uuidv4(), name: `Kvali ${names[i]}`, participants: finalP });
    });
    setQualificationGroups(prev => [...prev, ...newGroups]);
    toast({ title: "Grupid genereeritud" });
  };

  const handleLapTimeChange = (groupId: string, participantId: string, timeStr: string, session: 1 | 2) => {
    setQualificationGroups(prev => prev.map(g => {
        if (g.id !== groupId) return g;
        return {
            ...g,
            participants: g.participants.map(p => {
                if (p.id !== participantId) return p;
                const next = { ...p };
                if (session === 1) next.qualificationLapTime1 = timeStr;
                else next.qualificationLapTime2 = timeStr;
                const m1 = parseLapTimeToMillis(next.qualificationLapTime1);
                const m2 = parseLapTimeToMillis(next.qualificationLapTime2);
                next.qualificationLapTime = millisToTimeStr(Math.min(m1, m2));
                return next;
            })
        };
    }));
  };

  const generatePdfForGroup = (title: string, desc: string | undefined, headers: string[], body: any[][]) => {
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(cleanName(title), 14, 20);
    let y = 30;
    if (desc) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const lines = doc.splitTextToSize(`Märkused: ${desc}`, 180);
        doc.text(lines, 14, y);
        y += lines.length * 7 + 5;
    }
    (doc as any).autoTable({
        startY: y,
        head: [headers.map(h => cleanName(h))],
        body: body.map(row => row.map(cell => typeof cell === 'string' ? cleanName(cell) : cell)),
        theme: 'grid',
        headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 10, cellPadding: 2, font: 'helvetica' },
        didParseCell: function(data: any) {
            if (data.section === 'body' && (data.column.index === 2 || data.column.index === 4)) {
                data.cell.styles.textColor = [220, 38, 38];
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fontSize = 12;
                data.cell.styles.fillColor = [240, 240, 240];
            }
        }
    });
    doc.save(`${title.replace(/[: ]/g, '_')}.pdf`);
  };

  const renderParticipants = () => (
    <Card>
        <CardHeader><div className="flex items-center justify-between"><div className="flex items-center gap-2 text-primary"><Users size={28} /><CardTitle className="text-2xl">Osalejate haldus</CardTitle></div>
            <AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" size="sm"><Trash2 className="mr-2 h-4 w-4" /> Kustuta kõik andmed</Button></AlertDialogTrigger>
                <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Oled kindel?</AlertDialogTitle><AlertDialogDescription>See tegevus on tagasivõetamatu ja kustutab kõik selle etapi andmed.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Tühista</AlertDialogCancel><AlertDialogAction onClick={handleFullEventReset}>Jah, kustuta</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
            </AlertDialog>
        </div></CardHeader>
        <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-8">
                <div><Label>Lisa käsitsi (üks nimi reale)</Label><Textarea placeholder="Eesnimi Perekonnanimi..." value={participantNamesInput} onChange={(e) => setParticipantNamesInput(e.target.value)} rows={5} /><Button onClick={handleAddParticipantsFromTextarea} className="mt-2"><PlusCircle className="mr-2 h-4 w-4" /> Lisa</Button></div>
                <div className="space-y-2"><Label>Impordi CSV-failist</Label><Input type="file" accept=".csv" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) Papa.parse<any>(file, { header: true, complete: (res) => {
                        const mapped = res.data.map((row: any) => ({ id: uuidv4(), name: cleanName(`${row.name} ${row.last_name}`) }));
                        setParticipants(prev => [...prev, ...mapped]);
                        toast({ title: "Osalejad lisatud" });
                    }});
                }} /></div>
            </div>
            {participants.length > 0 && (
                <Table><TableHeader><TableRow><TableHead>#</TableHead><TableHead>Nimi</TableHead><TableHead className="text-right">Tegevused</TableHead></TableRow></TableHeader>
                    <TableBody>{participants.map((p, i) => (
                        <TableRow key={p.id}><TableCell>{i + 1}</TableCell><TableCell>{p.name}</TableCell>
                            <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => setParticipants(prev => prev.filter(item => item.id !== p.id))}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                        </TableRow>
                    ))}</TableBody>
                </Table>
            )}
        </CardContent>
        <CardFooter className="flex justify-end"><Button onClick={() => setCurrentStep('qualification_setup')} size="lg">Seadista kvalifikatsioon <ArrowRight className="ml-2 h-5 w-5" /></Button></CardFooter>
    </Card>
  );

  const renderQualiSetup = () => (
    <Card>
        <CardHeader><div className="flex items-center gap-2 text-primary"><Shuffle size={28} /><CardTitle className="text-2xl">Kvalifikatsiooni seadistus</CardTitle></div></CardHeader>
        <CardContent className="space-y-8">
            <Card className="bg-muted/30"><CardHeader><CardTitle className="text-xl">Automaatne genereerimine</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div><Label>Kartide arv sessioonis</Label><Input type="number" value={sessionKartCapacity} onChange={(e) => setSessionKartCapacity(e.target.value)} /></div>
                        <div><Label>Kättesaadavad kardi numbrid (komadega)</Label><Input placeholder="1,2,3..." value={availableKartNumbersInput} onChange={(e) => setAvailableKartNumbersInput(e.target.value)} /></div>
                    </div>
                    <Button onClick={handleAutoGenerateGroups} disabled={!sessionKartCapacity || !availableKartNumbersInput}><Zap className="mr-2 h-5 w-5" /> Genereeri automaatselt</Button>
                </CardContent>
            </Card>
            <Separator />
            <div className="space-y-4">
                <Card className="p-4"><h3 className="text-lg font-semibold mb-4">Käsitsi grupi loomine</h3>
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="flex-1 min-w-[200px]"><Label>Grupi nimi</Label>
                            <Select value={newGroupName} onValueChange={setNewGroupName}><SelectTrigger><SelectValue placeholder="Vali grupp" /></SelectTrigger>
                                <SelectContent>{['Kvali A','Kvali B','Kvali C','Kvali D','Kvali E','Kvali F','Kvali G','Kvali H'].map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="flex-[2] min-w-[300px]"><Label>Vali osalejad</Label>
                            <div className="flex flex-wrap gap-2 p-2 border rounded-md max-h-40 overflow-y-auto">
                                {participants.filter(p => !qualificationGroups.flatMap(g => g.participants.map(item => item.id)).includes(p.id)).map(p => (
                                    <div key={p.id} className="flex items-center gap-1 bg-secondary p-1 rounded text-xs">
                                        <input type="checkbox" checked={selectedParticipantsForGroup.includes(p.id)} onChange={(e) => {
                                            if (e.target.checked) setSelectedParticipantsForGroup(prev => [...prev, p.id]);
                                            else setSelectedParticipantsForGroup(prev => prev.filter(id => id !== p.id));
                                        }} /> {p.name}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <Button onClick={handleCreateQualificationGroup} disabled={!newGroupName || selectedParticipantsForGroup.length === 0}><PlusCircle className="mr-2 h-4 w-4" /> Loo grupp</Button>
                    </div>
                </Card>
                <div className="flex justify-between items-center"><h3 className="text-lg font-semibold">Grupid</h3><Button variant="destructive" size="sm" onClick={() => setQualificationGroups([])}><Trash2 className="mr-2 h-4 w-4" /> Kustuta kõik</Button></div>
                {qualificationGroups.map(group => (
                    <Card key={group.id} className="mb-4 border-2 border-foreground/20">
                        <CardHeader className="pb-2 flex flex-row items-center justify-between"><CardTitle>{group.name}</CardTitle></CardHeader>
                        <CardContent><Table>
                            <TableHeader><TableRow><TableHead>Sõitja</TableHead><TableHead>Kart (Q1)</TableHead><TableHead>Kart (Q2)</TableHead><TableHead className="text-right">Tegevused</TableHead></TableRow></TableHeader>
                            <TableBody>{group.participants.map(p => (
                                <TableRow key={p.id}><TableCell>{p.name}</TableCell>
                                    <TableCell><Input type="number" value={p.kartNumber ?? ''} onChange={(e) => setQualificationGroups(prev => prev.map(g => g.id === group.id ? { ...g, participants: g.participants.map(item => item.id === p.id ? { ...item, kartNumber: parseInt(e.target.value, 10) } : item) } : g))} className="w-24 font-bold" /></TableCell>
                                    <TableCell><Input type="number" value={p.kartNumber2 ?? ''} onChange={(e) => setQualificationGroups(prev => prev.map(g => g.id === group.id ? { ...g, participants: g.participants.map(item => item.id === p.id ? { ...item, kartNumber2: parseInt(e.target.value, 10) } : item) } : g))} className="w-24 font-bold" /></TableCell>
                                    <TableCell className="text-right flex justify-end gap-1">
                                        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><Move className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                            <DropdownMenuContent><DropdownMenuLabel>Liiguta gruppi...</DropdownMenuLabel>
                                                {qualificationGroups.filter(g => g.id !== group.id).map(tg => <DropdownMenuItem key={tg.id} onSelect={() => handleMoveParticipant(p.id, tg.id)}>{tg.name}</DropdownMenuItem>)}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                        <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                                            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{`Kas oled kindel, et soovid eemaldada sõitja ${p.name}?`}</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Tühista</AlertDialogCancel><AlertDialogAction onClick={() => handleDisqualifyParticipant(p.id)}>Eemalda</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            ))}</TableBody>
                        </Table></CardContent>
                    </Card>
                ))}
            </div>
        </CardContent>
        <CardFooter className="flex justify-between items-center"><Button onClick={() => setCurrentStep('participants')} variant="outline" size="lg"><ArrowLeft className="mr-2 h-5 w-5" /> Tagasi</Button><Button onClick={() => setCurrentStep('qualification_timing')} disabled={qualificationGroups.length === 0} size="lg">Edasi tulemuste juurde <ArrowRight className="ml-2 h-5 w-5" /></Button></CardFooter>
    </Card>
  );

  const renderQualiTiming = () => (
    <Card>
        <CardHeader><div className="flex items-center justify-between"><div className="flex items-center gap-2 text-primary"><Timer size={28} /><CardTitle className="text-2xl">Kvalifikatsiooni tulemused</CardTitle></div></div></CardHeader>
        <CardContent className="space-y-6">
            {qualificationGroups.map(group => (
                <div key={group.id} className="mb-6 rounded-lg border-2 border-foreground/20 p-4">
                    <div className="flex justify-between items-center mb-2"><h3 className="text-xl font-semibold text-primary">{group.name}</h3>
                        <Button onClick={() => generatePdfForGroup(`Kvalifikatsioon: ${group.name}`, group.description, ['#', 'Sõitja', 'Kart (Q1)', 'Aeg 1', 'Kart (Q2)', 'Aeg 2', 'Parim'], group.participants.map((p, i) => [i + 1, p.name, p.kartNumber, p.qualificationLapTime1, p.kartNumber2, p.qualificationLapTime2, p.qualificationLapTime]))} variant="outline" size="sm"><Download className="mr-2 h-4 w-4" /> PDF</Button>
                    </div>
                    <Textarea placeholder="Lisa märkmeid/karistusi selle grupi kohta..." value={group.description || ''} onChange={(e) => setQualificationGroups(prev => prev.map(g => g.id === group.id ? { ...g, description: e.target.value } : g))} className="my-2" />
                    <Table><TableHeader><TableRow><TableHead>#</TableHead><TableHead>Sõitja</TableHead><TableHead>Kart (Q1)</TableHead><TableHead>Aeg 1</TableHead><TableHead>Kart (Q2)</TableHead><TableHead>Aeg 2</TableHead><TableHead className="font-bold">Parim</TableHead></TableRow></TableHeader>
                        <TableBody>{group.participants.map((p, i) => (
                            <TableRow key={p.id}><TableCell>{i + 1}</TableCell><TableCell>{p.name}</TableCell>
                                <TableCell className="font-bold text-center">{p.kartNumber}</TableCell>
                                <TableCell><Input placeholder="MM:SS.mmm" value={p.qualificationLapTime1 || ''} onChange={(e) => handleLapTimeChange(group.id, p.id, e.target.value, 1)} className="w-32" /></TableCell>
                                <TableCell className="font-bold text-center">{p.kartNumber2}</TableCell>
                                <TableCell><Input placeholder="MM:SS.mmm" value={p.qualificationLapTime2 || ''} onChange={(e) => handleLapTimeChange(group.id, p.id, e.target.value, 2)} className="w-32" /></TableCell>
                                <TableCell className="font-semibold text-primary">{p.qualificationLapTime || 'N/A'}</TableCell>
                            </TableRow>
                        ))}</TableBody>
                    </Table>
                </div>
            ))}
        </CardContent>
        <CardFooter className="flex justify-between items-center"><Button onClick={() => setCurrentStep('qualification_setup')} variant="outline" size="lg"><ArrowLeft className="mr-2 h-5 w-5" /> Tagasi</Button><Button onClick={() => {
            const pool = availableKartNumbersInput.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
            setHeats(generateHeatsWithStaggeredGrid([...qualificationGroups], pool));
            setCurrentStep('heats_setup');
        }} size="lg">Genereeri eelsõidud <Flag className="ml-2 h-5 w-5" /></Button></CardFooter>
    </Card>
  );

  const renderHeatsSetup = () => (
    <Card>
        <CardHeader><div className="flex items-center gap-2 text-primary"><Flag size={28} /><CardTitle className="text-2xl">Eelsõitude seadistus</CardTitle></div></CardHeader>
        <CardContent className="space-y-6">
            {heats.map(heat => (
                <div key={heat.id} className="mb-6 rounded-lg border-2 border-foreground/20 p-4">
                    <div className="flex justify-between items-center mb-2"><h3 className="text-xl font-semibold text-primary">{heat.name}</h3>
                        <Button onClick={() => generatePdfForGroup(`Eelsõit: ${heat.name}`, heat.description, ['Koht', 'Sõitja', 'Kart'], heat.participants.map((p, i) => [i + 1, p.name, p.kartNumber]))} variant="outline" size="sm"><Download className="mr-2 h-4 w-4" /> PDF</Button>
                    </div>
                    <Table><TableHeader><TableRow><TableHead>Start</TableHead><TableHead>Sõitja</TableHead><TableHead>Kart</TableHead><TableHead className="text-right">Tegevused</TableHead></TableRow></TableHeader>
                        <TableBody>{heat.participants.map((p, i) => (
                            <TableRow key={p.id}><TableCell>{i + 1}</TableCell><TableCell>{p.name}</TableCell>
                                <TableCell><Input type="number" value={p.kartNumber ?? ''} onChange={(e) => setHeats(prev => prev.map(h => h.id === heat.id ? { ...h, participants: h.participants.map(item => item.id === p.id ? { ...item, kartNumber: parseInt(e.target.value, 10) } : item) } : h))} className="w-24 font-bold" /></TableCell>
                                <TableCell className="text-right flex justify-end gap-1">
                                    <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><Move className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                        <DropdownMenuContent><DropdownMenuLabel>Liiguta eelsõitu...</DropdownMenuLabel>
                                            {heats.filter(h => h.id !== heat.id).map(th => <DropdownMenuItem key={th.id} onSelect={() => handleMoveParticipantInHeat(p.id, heat.id, th.id)}>{th.name}</DropdownMenuItem>)}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                                        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{`Kas oled kindel, et soovid eemaldada sõitja ${p.name}?`}</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Tühista</AlertDialogCancel><AlertDialogAction onClick={() => handleDisqualifyParticipant(p.id)}>Eemalda</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                                    </AlertDialog>
                                </TableCell>
                            </TableRow>
                        ))}</TableBody>
                    </Table>
                </div>
            ))}
        </CardContent>
        <CardFooter className="flex justify-between items-center"><Button onClick={() => setCurrentStep('qualification_timing')} variant="outline" size="lg"><ArrowLeft className="mr-2 h-5 w-5" /> Tagasi</Button><Button onClick={() => setCurrentStep('heats_results')} size="lg">Sisesta tulemused <ArrowRight className="ml-2 h-5 w-5" /></Button></CardFooter>
    </Card>
  );

  const renderHeatsResults = () => (
    <Card>
        <CardHeader><div className="flex items-center gap-2 text-primary"><ListOrdered size={28} /><CardTitle className="text-2xl">Eelsõidu tulemused</CardTitle></div></CardHeader>
        <CardContent className="space-y-6">
            {heats.map(heat => (
                <div key={heat.id} className="mb-6 rounded-lg border-2 border-foreground/20 p-4">
                    <h3 className="text-xl font-semibold text-primary mb-2">{heat.name}</h3>
                    <Textarea placeholder="Lisa märkmeid/karistusi selle eelsõidu kohta..." value={heat.description || ''} onChange={(e) => setHeats(prev => prev.map(h => h.id === heat.id ? { ...h, description: e.target.value } : h))} className="my-2" />
                    <Table><TableHeader><TableRow><TableHead>Sõitja</TableHead><TableHead>Kart</TableHead><TableHead>Koht</TableHead><TableHead>Aeg</TableHead><TableHead>Parim</TableHead></TableRow></TableHeader>
                        <TableBody>{heat.participants.map(p => (
                            <TableRow key={p.id}><TableCell>{p.name}</TableCell><TableCell className="font-bold text-center">{p.kartNumber}</TableCell>
                                <TableCell><Input type="number" value={heatResultsInput[heat.id]?.[p.id]?.position || ''} onChange={(e) => setHeatResultsInput(prev => ({ ...prev, [heat.id]: { ...prev[heat.id], [p.id]: { ...prev[heat.id]?.[p.id], position: e.target.value } } }))} className="w-20" /></TableCell>
                                <TableCell><Input placeholder="Kogu aeg" value={heatResultsInput[heat.id]?.[p.id]?.totalTime || ''} onChange={(e) => setHeatResultsInput(prev => ({ ...prev, [heat.id]: { ...prev[heat.id], [p.id]: { ...prev[heat.id]?.[p.id], totalTime: e.target.value } } }))} /></TableCell>
                                <TableCell><Input placeholder="Parim ring" value={heatResultsInput[heat.id]?.[p.id]?.fastestLap || ''} onChange={(e) => setHeatResultsInput(prev => ({ ...prev, [heat.id]: { ...prev[heat.id], [p.id]: { ...prev[heat.id]?.[p.id], fastestLap: e.target.value } } }))} /></TableCell>
                            </TableRow>
                        ))}</TableBody>
                    </Table>
                </div>
            ))}
        </CardContent>
        <CardFooter className="flex justify-between items-center"><Button onClick={() => setCurrentStep('heats_setup')} variant="outline" size="lg"><ArrowLeft className="mr-2 h-5 w-5" /> Tagasi</Button><Button onClick={() => {
            const pool = availableKartNumbersInput.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
            const updated = heats.map(h => ({ ...h, results: h.participants.map(p => ({ ...p, heatFinishingPosition: parseInt(heatResultsInput[h.id]?.[p.id]?.position || '0', 10), totalTime: heatResultsInput[h.id]?.[p.id]?.totalTime || null, fastestLap: heatResultsInput[h.id]?.[p.id]?.fastestLap || null })).sort((a,b) => (a.heatFinishingPosition || 99) - (b.heatFinishingPosition || 99)) }));
            setHeats(updated);
            setFinals(generateFinalsFromRankedHeats(updated, pool, qualificationGroups.map(g => g.participants.length), [qualificationGroups.flatMap(g => g.participants), updated.flatMap(h => h.results || [])]));
            setCurrentStep('final_setup');
        }} size="lg">Kinnita ja mine finaalidesse <ArrowRight className="ml-2 h-5 w-5" /></Button></CardFooter>
    </Card>
  );

  const renderFinalSetup = () => (
    <Card>
        <CardHeader><div className="flex items-center gap-2 text-primary"><Trophy size={28} /><CardTitle className="text-2xl">Finaalide seadistus</CardTitle></div></CardHeader>
        <CardContent className="space-y-6">
            {finals.map(f => (
                <div key={f.id} className="mb-6 rounded-lg border-2 border-foreground/20 p-4">
                    <div className="flex justify-between items-center mb-2"><h3 className="text-xl font-semibold text-primary">{f.name}</h3>
                        <Button onClick={() => generatePdfForGroup(`Finaal: ${f.name}`, f.description, ['Stardikoht', 'Sõitja', 'Kart'], f.participants.map((p, i) => [i + 1, p.name, p.kartNumber]))} variant="outline" size="sm"><Download className="mr-2 h-4 w-4" /> PDF</Button>
                    </div>
                    <Table><TableHeader><TableRow><TableHead>Start</TableHead><TableHead>Sõitja</TableHead><TableHead>Kart</TableHead><TableHead className="text-right">Tegevused</TableHead></TableRow></TableHeader>
                        <TableBody>{f.participants.map((p, i) => (
                            <TableRow key={p.id}><TableCell>{i + 1}</TableCell><TableCell>{p.name}</TableCell>
                                <TableCell><Input type="number" value={p.kartNumber ?? ''} onChange={(e) => setFinals(prev => prev.map(item => item.id === f.id ? { ...item, participants: item.participants.map(part => part.id === p.id ? { ...part, kartNumber: parseInt(e.target.value, 10) } : part) } : item))} className="w-24 font-bold" /></TableCell>
                                <TableCell className="text-right flex justify-end gap-1">
                                    <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><Move className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                        <DropdownMenuContent><DropdownMenuLabel>Liiguta finaali...</DropdownMenuLabel>
                                            {finals.filter(item => item.id !== f.id).map(tf => <DropdownMenuItem key={tf.id} onSelect={() => handleMoveParticipantInFinal(p.id, f.id, tf.id)}>{tf.name}</DropdownMenuItem>)}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                                        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{`Kas oled kindel, et soovid eemaldada sõitja ${p.name}?`}</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Tühista</AlertDialogCancel><AlertDialogAction onClick={handleDisqualifyParticipant(p.id)}>Eemalda</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                                    </AlertDialog>
                                </TableCell>
                            </TableRow>
                        ))}</TableBody>
                    </Table>
                </div>
            ))}
        </CardContent>
        <CardFooter className="flex justify-between items-center"><Button onClick={() => setCurrentStep('heats_results')} variant="outline" size="lg"><ArrowLeft className="mr-2 h-5 w-5" /> Tagasi</Button><Button onClick={() => setCurrentStep('final_results')} size="lg">Sisesta tulemused <ArrowRight className="ml-2 h-5 w-5" /></Button></CardFooter>
    </Card>
  );

  const setUpdateInput = (raceId: string, participantId: string, field: string, value: string) => {
    setFinalResultsInput(prev => ({ ...prev, [raceId]: { ...prev[raceId], [participantId]: { ...prev[raceId]?.[participantId], [field]: value } } }));
  };

  const renderFinalResults = () => (
    <Card>
        <CardHeader><div className="flex items-center gap-2 text-primary"><BarChart3 size={28} /><CardTitle className="text-2xl">Finaali tulemused</CardTitle></div></CardHeader>
        <CardContent className="space-y-6">
            {finals.map(f => (
                <div key={f.id} className="mb-6 rounded-lg border-2 border-foreground/20 p-4">
                    <h3 className="text-xl font-semibold text-primary mb-2">{f.name}</h3>
                    <Textarea placeholder="Lisa märkmeid/karistusi selle finaali kohta..." value={f.description || ''} onChange={(e) => setFinals(prev => prev.map(item => item.id === f.id ? { ...item, description: e.target.value } : item))} className="my-2" />
                    <Table><TableHeader><TableRow><TableHead>Sõitja</TableHead><TableHead>Kart</TableHead><TableHead>Koht</TableHead><TableHead>Aeg</TableHead><TableHead>Parim</TableHead></TableRow></TableHeader>
                        <TableBody>{f.participants.map(p => (
                            <TableRow key={p.id}><TableCell>{p.name}</TableCell><TableCell className="font-bold text-center">{p.kartNumber}</TableCell>
                                <TableCell><Input type="number" value={finalResultsInput[f.id]?.[p.id]?.position || ''} onChange={(e) => setUpdateInput(f.id, p.id, 'position', e.target.value)} className="w-20" /></TableCell>
                                <TableCell><Input placeholder="Kogu aeg" value={finalResultsInput[f.id]?.[p.id]?.totalTime || ''} onChange={(e) => setUpdateInput(f.id, p.id, 'totalTime', e.target.value)} /></TableCell>
                                <TableCell><Input placeholder="Parim ring" value={finalResultsInput[f.id]?.[p.id]?.fastestLap || ''} onChange={(e) => setUpdateInput(f.id, p.id, 'fastestLap', e.target.value)} /></TableCell>
                            </TableRow>
                        ))}</TableBody>
                    </Table>
                </div>
            ))}
        </CardContent>
        <CardFooter className="flex justify-between items-center"><Button onClick={() => setCurrentStep('final_setup')} variant="outline" size="lg"><ArrowLeft className="mr-2 h-5 w-5" /> Tagasi</Button><Button onClick={() => {
            const updated = finals.map(f => {
                const results = f.participants.map(p => ({ ...p, finalFinishingPosition: parseInt(finalResultsInput[f.id]?.[p.id]?.position || '0', 10), totalTime: finalResultsInput[f.id]?.[p.id]?.totalTime || null, fastestLap: finalResultsInput[f.id]?.[p.id]?.fastestLap || null })).sort((a,b) => (a.finalFinishingPosition || 99) - (b.finalFinishingPosition || 99));
                const pts = calculateEventPoints({ ...f, results });
                return { ...f, results: results.map(p => ({ ...p, eventPoints: pts[p.id] ?? 0 })) };
            });
            setFinals(updated);
            setCurrentStep('overview');
        }} size="lg">Kinnita ja mine kokkuvõttesse <CheckCircleIcon className="ml-2 h-5 w-5" /></Button></CardFooter>
    </Card>
  );

  const renderOverview = () => (
    <Card>
        <CardHeader><div className="flex items-center gap-2 text-primary"><Medal size={28} /><CardTitle className="text-2xl">Punktitabelid</CardTitle></div></CardHeader>
        <CardContent className="space-y-8">
            <Card><CardHeader><CardTitle className="text-xl">Sõitjate punktid: {selectedEvent}</CardTitle></CardHeader>
                <CardContent><Table><TableHeader><TableRow><TableHead>Koht</TableHead><TableHead>Sõitja</TableHead><TableHead className="text-right">Punktid</TableHead></TableRow></TableHeader>
                    <TableBody>{finals.flatMap(f => f.results || []).filter(p => (p.eventPoints || 0) > 0).sort((a,b) => (b.eventPoints || 0) - (a.eventPoints || 0)).map((p, i) => (
                        <TableRow key={p.id}><TableCell>{i + 1}</TableCell><TableCell>{p.name}</TableCell><TableCell className="text-right font-bold">{p.eventPoints}</TableCell></TableRow>
                    ))}</TableBody>
                </Table></CardContent>
            </Card>
        </CardContent>
        <CardFooter><Button onClick={() => setCurrentStep('final_results')} variant="outline" size="lg"><ArrowLeft className="mr-2 h-5 w-5" /> Tagasi</Button></CardFooter>
    </Card>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 'participants': return renderParticipants();
      case 'qualification_setup': return renderQualiSetup();
      case 'qualification_timing': return renderQualiTiming();
      case 'heats_setup': return renderHeatsSetup();
      case 'heats_results': return renderHeatsResults();
      case 'final_setup': return renderFinalSetup();
      case 'final_results': return renderFinalResults();
      case 'overview': return renderOverview();
      default: return null;
    }
  };

  return (
    <PageLayout backHref={selectedEvent ? '/races' : '/'}>
        {!isClientMounted ? <div className="flex justify-center py-10"><LoadingSpinner size={48} /></div> : !selectedEvent ? (
            <div className="max-w-2xl mx-auto"><Card><CardHeader><CardTitle>Vali etapp</CardTitle></CardHeader>
                <CardContent><Select onValueChange={(v) => router.push(`/races?event=${encodeURIComponent(v)}`)}><SelectTrigger><SelectValue placeholder="Vali olemasolev etapp..." /></SelectTrigger>
                    <SelectContent>{RACE_CALENDAR.map(e => <SelectItem value={e} key={e}>{e}</SelectItem>)}</SelectContent>
                </Select></CardContent>
            </Card></div>
        ) : (
            <div className="space-y-4">
                <h1 className="font-bold text-3xl text-center">{selectedEvent}</h1>
                <Tabs value={currentStep} onValueChange={(v) => setCurrentStep(v as AppStep)}>
                    <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:grid-cols-8">
                        {STEP_ORDER.map(s => <TabsTrigger value={s} key={s} className="text-xs">{STEP_LABELS[s]}</TabsTrigger>)}
                    </TabsList>
                    <TabsContent value={currentStep} className="mt-4">{renderStepContent()}</TabsContent>
                </Tabs>
            </div>
        )}
        <DriverFormDialog isFormOpen={isFormOpen} setIsFormOpen={setIsFormOpen} form={form} onDriverFormSubmit={(data) => {
            if (editingDriver) {
                const cleaned = cleanName(data.name);
                const updated = { ...editingDriver, name: cleaned, class: data.class, weight: data.weight };
                setParticipants(prev => prev.map(p => p.id === updated.id ? updated : p));
                setQualificationGroups(prev => prev.map(g => ({ ...g, participants: g.participants.map(p => p.id === updated.id ? updated : p) })));
                setIsFormOpen(false);
                toast({ title: "Andmed muudetud" });
            }
        }} />
    </PageLayout>
  );
}