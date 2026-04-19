'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { Participant, Team } from '@/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { parse } from "date-fns";

import PageLayout from '@/components/PageLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from "@/hooks/use-toast";
import LoadingSpinner from '@/components/LoadingSpinner';
import { Users, UserPlus, Edit, Trash2, Shield, Search } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


const LOCAL_STORAGE_PREFIX = 'hobbyKarting_';
const LS_ALL_DRIVERS = `${LOCAL_STORAGE_PREFIX}all_drivers`;
const LS_TEAMS = `${LOCAL_STORAGE_PREFIX}teams`;
const RACE_CALENDAR = [
  '1. Rapla kardirada', '2. Raassilla/Porsche', '3. Põltsamaa(Kuningamäe)', '4. Käina kardirada', '5.Unibet Kardikeskus', '6.Aravete kardirada'
];

const getDynamicLsKeys = (event: string) => {
  if (!event) return {};
  const eventPrefix = `${LOCAL_STORAGE_PREFIX}${event.replace(/[^a-zA-Z0-9]/g, '_')}_`;
  return {
    LS_PARTICIPANTS: `${eventPrefix}participants`,
  };
};

const cleanName = (name: string | null | undefined): string => {
    if (!name) return '';
    return name.replace(/[\s\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]+/g, ' ').trim();
};

const driverFormSchema = z.object({
  name: z.string().min(1, { message: "Nimi on kohustuslik." }),
  dob: z.string().optional(),
  weight: z.coerce.number().positive({ message: "Kaal peab olema positiivne number." }).optional(),
  class: z.enum(["Junior", "Standard", "Heavy"]).optional(),
});

type DriverFormValues = z.infer<typeof driverFormSchema>;

const teamFormSchema = z.object({
  name: z.string().min(1, { message: "Meeskonna nimi on kohustuslik." }),
  driver1Id: z.string().min(1, { message: "Vali 1. sõitja." }),
  driver2Id: z.string().min(1, { message: "Vali 2. sõitja." }),
  substituteDriverId: z.string().optional().nullable(),
  substituteUsedOnEvent: z.string().optional().nullable(),
}).refine(data => data.driver1Id !== data.driver2Id, {
  message: "Sõitjad peavad olema erinevad.",
  path: ["driver2Id"],
}).refine(data => !data.substituteDriverId || (data.substituteDriverId !== data.driver1Id && data.substituteDriverId !== data.driver2Id), {
    message: "Asendussõitja peab olema erinev põhisõitjatest.",
    path: ["substituteDriverId"],
});


type TeamFormValues = z.infer<typeof teamFormSchema>;

const calculateAge = (dob: string | undefined): number | null => {
    if (!dob) return null;
    try {
        const date = parse(dob, 'dd.MM.yyyy', new Date());
        if (isNaN(date.getTime())) return null;
        const today = new Date();
        let age = today.getFullYear() - date.getFullYear();
        const m = today.getMonth() - date.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < date.getDate())) {
            age--;
        }
        return age;
    } catch (e) {
        return null;
    }
};

export default function DriversAndTeamsPage() {
  const [allDrivers, setAllDrivers] = useState<Participant[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDriverFormOpen, setIsDriverFormOpen] = useState(false);
  const [isTeamFormOpen, setIsTeamFormOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Participant | null>(null);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const { toast } = useToast();
  
  const [driver1Search, setDriver1Search] = useState('');
  const [driver2Search, setDriver2Search] = useState('');
  const [substituteSearch, setSubstituteSearch] = useState('');

  const driverIdToNameMap = useMemo(() => new Map(allDrivers.map(d => [d.id, d.name])), [allDrivers]);

  const driverForm = useForm<DriverFormValues>({
    resolver: zodResolver(driverFormSchema),
    defaultValues: { name: "" },
  });

  const teamForm = useForm<TeamFormValues>({
    resolver: zodResolver(teamFormSchema),
    defaultValues: { name: "", driver1Id: "", driver2Id: "" },
  });

  const loadAllData = () => {
    setIsLoading(true);
    try {
        let allDriversDataRaw = localStorage.getItem(LS_ALL_DRIVERS);
        let drivers: Participant[] = [];
        if (allDriversDataRaw) {
            try {
                const parsedDrivers: Participant[] = JSON.parse(allDriversDataRaw);
                drivers = parsedDrivers.map(d => {
                    const cleanedName = cleanName(d.name);
                    const nameParts = cleanedName.split(' ').filter(part => part.length > 0);
                    return { 
                        ...d, 
                        name: cleanedName,
                        firstName: nameParts.shift() || '', 
                        lastName: nameParts.join(' ') 
                    };
                });
            } catch (e) { console.error("Error parsing drivers", e); }
        }
        setAllDrivers(drivers.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
    } catch (error) {
        console.error("Error loading drivers list:", error);
        setAllDrivers([]);
    }
    try {
        const teamsDataRaw = localStorage.getItem(LS_TEAMS);
        if (teamsDataRaw) {
            setTeams(JSON.parse(teamsDataRaw).sort((a: Team, b: Team) => a.name.localeCompare(b.name)));
        } else {
            setTeams([]);
        }
    } catch (error) {
        console.error("Error loading teams list:", error);
        setTeams([]);
    }
    setIsLoading(false);
  };
  
  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    if (!isDriverFormOpen) {
      setEditingDriver(null);
      driverForm.reset({ name: "", dob: undefined, weight: undefined, class: undefined });
    }
  }, [isDriverFormOpen, driverForm]);
  
  useEffect(() => {
    if (editingDriver) {
        driverForm.reset({
            name: editingDriver.name,
            dob: editingDriver.dob,
            weight: editingDriver.weight,
            class: editingDriver.class as any
        });
    } else {
        driverForm.reset({ name: "", dob: "", weight: undefined, class: undefined });
    }
  }, [editingDriver, driverForm]);

  useEffect(() => {
    if (!isTeamFormOpen) {
      setEditingTeam(null);
      teamForm.reset({ name: "", driver1Id: "", driver2Id: "", substituteDriverId: null, substituteUsedOnEvent: null });
      setDriver1Search('');
      setDriver2Search('');
      setSubstituteSearch('');
    }
  }, [isTeamFormOpen, teamForm]);

  useEffect(() => {
    if (editingTeam) {
        teamForm.reset({
            name: editingTeam.name,
            driver1Id: editingTeam.driver1Id,
            driver2Id: editingTeam.driver2Id,
            substituteDriverId: editingTeam.substituteDriverId,
            substituteUsedOnEvent: editingTeam.substituteUsedOnEvent,
        });
    } else {
        teamForm.reset({ name: "", driver1Id: "", driver2Id: "", substituteDriverId: null, substituteUsedOnEvent: null });
    }
  }, [editingTeam, teamForm]);

  function onDriverSubmit(data: DriverFormValues) {
    try {
        let currentDrivers: Participant[] = JSON.parse(localStorage.getItem(LS_ALL_DRIVERS) || '[]');
        const cleanedName = cleanName(data.name);
        const nameParts = cleanedName.split(' ').filter(part => part.length > 0);
        const firstName = nameParts.shift() || '';
        const lastName = nameParts.join(' ');
        let savedDriver: Participant;

        if (editingDriver) {
            const updatedDriver = { ...editingDriver, name: cleanedName, firstName, lastName, class: data.class, dob: data.dob, weight: data.weight };
            currentDrivers = currentDrivers.map(d => d.id === editingDriver.id ? updatedDriver : d);
            savedDriver = updatedDriver;
            toast({ title: "Sõitja andmed muudetud" });
        } else {
            const newDriver = { id: uuidv4(), name: cleanedName, firstName, lastName, class: data.class, dob: data.dob, weight: data.weight };
            currentDrivers.push(newDriver);
            savedDriver = newDriver;
            toast({ title: "Sõitja lisatud" });
        }
        localStorage.setItem(LS_ALL_DRIVERS, JSON.stringify(currentDrivers));

        for (const eventName of RACE_CALENDAR) {
            const eventKeys = getDynamicLsKeys(eventName);
            if (eventKeys.LS_PARTICIPANTS) {
                const participantsDataRaw = localStorage.getItem(eventKeys.LS_PARTICIPANTS);
                if (participantsDataRaw) {
                    let eventParticipants: Participant[] = JSON.parse(participantsDataRaw);
                    const driverIndex = eventParticipants.findIndex(p => p.id === savedDriver.id);
                    if (driverIndex > -1) {
                        const existingEventDriver = eventParticipants[driverIndex];
                        eventParticipants[driverIndex] = { ...existingEventDriver, name: savedDriver.name, firstName, lastName, class: savedDriver.class, dob: savedDriver.dob, weight: savedDriver.weight };
                        localStorage.setItem(eventKeys.LS_PARTICIPANTS, JSON.stringify(eventParticipants));
                    }
                }
            }
        }
        setIsDriverFormOpen(false);
        loadAllData();
    } catch (error) {
        console.error("Error saving driver:", error);
        toast({ title: "Viga", description: "Sõitja salvestamine ebaõnnestus.", variant: "destructive" });
    }
  }

  const handleDeleteDriverAction = (driverId: string) => {
    try {
        let currentDrivers: Participant[] = JSON.parse(localStorage.getItem(LS_ALL_DRIVERS) || '[]');
        localStorage.setItem(LS_ALL_DRIVERS, JSON.stringify(currentDrivers.filter(d => d.id !== driverId)));
        
        let allTeams: Team[] = JSON.parse(localStorage.getItem(LS_TEAMS) || '[]');
        const updatedTeams = allTeams.filter(t => ![t.driver1Id, t.driver2Id, t.substituteDriverId].includes(driverId));
        localStorage.setItem(LS_TEAMS, JSON.stringify(updatedTeams));

        for (const eventName of RACE_CALENDAR) {
            const eventKeys = getDynamicLsKeys(eventName);
            if(eventKeys.LS_PARTICIPANTS){
                const participantsDataRaw = localStorage.getItem(eventKeys.LS_PARTICIPANTS);
                if (participantsDataRaw) {
                    let eventParticipants: Participant[] = JSON.parse(participantsDataRaw);
                    localStorage.setItem(eventKeys.LS_PARTICIPANTS, JSON.stringify(eventParticipants.filter(p => p.id !== driverId)));
                }
            }
        }
        toast({ title: "Sõitja kustutatud", description: "Sõitja eemaldati nimekirjast, kõikidelt etappidelt ja meeskondadest." });
        setIsDriverFormOpen(false);
        loadAllData();
    } catch (error) {
        console.error("Error deleting driver:", error);
        toast({ title: "Viga", description: "Sõitja kustutamine ebaõnnestus.", variant: "destructive" });
    }
  };

  const handleClearAllDrivers = () => {
    try {
      localStorage.removeItem(LS_ALL_DRIVERS);
      localStorage.removeItem(LS_TEAMS);
      for (const eventName of RACE_CALENDAR) {
        const eventKeys = getDynamicLsKeys(eventName);
        Object.values(eventKeys).forEach(key => { if(key) localStorage.removeItem(key) });
      }
      toast({ title: "Andmed lähtestatud", description: "Kõik sõitjad, meeskonnad ja etappide andmed on kustutatud." });
      loadAllData();
    } catch (error) {
      console.error("Error clearing all data:", error);
      toast({ title: "Viga", description: "Andmete lähtestamine ebaõnnestus.", variant: "destructive" });
    }
  };

  function onTeamSubmit(data: TeamFormValues) {
    try {
        let currentTeams: Team[] = JSON.parse(localStorage.getItem(LS_TEAMS) || '[]');
        if (editingTeam) {
            const updatedTeam: Team = { ...editingTeam, ...data };
            currentTeams = currentTeams.map(t => t.id === editingTeam.id ? updatedTeam : t);
            toast({ title: "Meeskond muudetud" });
        } else {
            const newTeam: Team = { id: uuidv4(), ...data };
            currentTeams.push(newTeam);
            toast({ title: "Meeskond lisatud" });
        }
        localStorage.setItem(LS_TEAMS, JSON.stringify(currentTeams));
        setIsTeamFormOpen(false);
        loadAllData();
    } catch (error) {
        console.error("Error saving team:", error);
        toast({ title: "Viga", description: "Meeskonna salvestamine ebaõnnestus.", variant: "destructive" });
    }
  }

  const handleDeleteTeam = (teamId: string) => {
    try {
        let currentTeams: Team[] = JSON.parse(localStorage.getItem(LS_TEAMS) || '[]');
        localStorage.setItem(LS_TEAMS, JSON.stringify(currentTeams.filter(t => t.id !== teamId)));
        toast({ title: "Meeskond kustutatud" });
        loadAllData();
    } catch (error) {
        console.error("Error deleting team:", error);
        toast({ title: "Viga", description: "Meeskonna kustutamine ebaõnnestus.", variant: "destructive" });
    }
  };

  const filteredDrivers1 = useMemo(() => allDrivers.filter(d => d.name.toLowerCase().includes(driver1Search.toLowerCase())), [allDrivers, driver1Search]);
  const filteredDrivers2 = useMemo(() => allDrivers.filter(d => d.name.toLowerCase().includes(driver2Search.toLowerCase())), [allDrivers, driver2Search]);
  const filteredSubstituteDrivers = useMemo(() => allDrivers.filter(d => d.name.toLowerCase().includes(substituteSearch.toLowerCase())), [allDrivers, substituteSearch]);


  return (
    <PageLayout backHref="/">
        <Tabs defaultValue="drivers" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="drivers">Sõitjad</TabsTrigger>
                <TabsTrigger value="teams">Meeskonnad</TabsTrigger>
            </TabsList>
            <TabsContent value="drivers">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Users className="h-6 w-6 text-primary" />
                                <CardTitle>Sõitjate nimekiri</CardTitle>
                            </div>
                            <div className="flex items-center gap-2">
                                <AlertDialog>
                                    <AlertDialogTrigger asChild><Button variant="destructive" size="sm"><Trash2 className="mr-2 h-4 w-4" /> Kustuta kõik</Button></AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader><AlertDialogTitle>Kas oled täiesti kindel?</AlertDialogTitle><AlertDialogDescription>See tegevus kustutab jäädavalt KÕIK sõitjad, meeskonnad ja lähtestab KÕIKIDE etappide andmed. Seda tegevust ei saa tagasi võtta.</AlertDialogDescription></AlertDialogHeader>
                                        <AlertDialogFooter><AlertDialogCancel>Tühista</AlertDialogCancel><AlertDialogAction onClick={handleClearAllDrivers}>Jah, kustuta kõik andmed</AlertDialogAction></AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                                <Dialog open={isDriverFormOpen} onOpenChange={setIsDriverFormOpen}>
                                    <DialogTrigger asChild><Button onClick={() => setEditingDriver(null)}><UserPlus className="mr-2 h-4 w-4" /> Lisa uus sõitja</Button></DialogTrigger>
                                    <DialogContent className="sm:max-w-lg">
                                        <DialogHeader>
                                            <DialogTitle>{editingDriver ? 'Muuda sõitja andmeid' : 'Lisa uus sõitja'}</DialogTitle>
                                            <DialogDescription>{editingDriver ? 'Muuda allolevaid välju ja salvesta muudatused.' : 'Täida allolevad väljad, et lisada uus sõitja üldisesse nimekirja.'}</DialogDescription>
                                        </DialogHeader>
                                        <Form {...driverForm}>
                                            <form onSubmit={driverForm.handleSubmit(onDriverSubmit)} className="space-y-4 py-4">
                                                <FormField control={driverForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Osaleja nimi</FormLabel><FormControl><Input placeholder="Evert Sild" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                                <FormField control={driverForm.control} name="dob" render={({ field }) => (<FormItem><FormLabel>Sünnikuupäev</FormLabel><FormControl><Input placeholder="PP.KK.AAAA" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                                <div className="grid grid-cols-2 gap-4">
                                                    <FormField control={driverForm.control} name="weight" render={({ field }) => (<FormItem><FormLabel>Kaal (kg)</FormLabel><FormControl><Input type="number" placeholder="85" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                                    <FormField control={driverForm.control} name="class" render={({ field }) => (<FormItem><FormLabel>Klass</FormLabel><Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Vali klass" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Junior">Junior (kuni 65 kg)</SelectItem><SelectItem value="Standard">Standard (65-85 kg)</SelectItem><SelectItem value="Heavy">Heavy (90-105 kg)</SelectItem></Select><FormMessage /></FormItem>)} />
                                                </div>
                                                <DialogFooter className="justify-between">
                                                  {editingDriver ? (
                                                    <AlertDialog>
                                                      <AlertDialogTrigger asChild><Button type="button" variant="destructive"><Trash2 className="mr-2 h-4 w-4" /> Kustuta sõitja</Button></AlertDialogTrigger>
                                                      <AlertDialogContent>
                                                        <AlertDialogHeader><AlertDialogTitle>Kas oled kindel, et soovid kustutada sõitja?</AlertDialogTitle><AlertDialogDescription>Seda tegevust ei saa tagasi võtta. Sõitja eemaldatakse jäädavalt nii üldisest nimekirjast kui ka kõikidelt etappidelt ja meeskondadest.</AlertDialogDescription></AlertDialogHeader>
                                                        <AlertDialogFooter><AlertDialogCancel>Tühista</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteDriverAction(editingDriver.id)}>Kustuta</AlertDialogAction></AlertDialogFooter>
                                                      </AlertDialogContent>
                                                    </AlertDialog>
                                                  ) : <div />}
                                                  <div className="flex gap-2"><DialogClose asChild><Button type="button" variant="outline">Tühista</Button></DialogClose><Button type="submit">{editingDriver ? 'Salvesta muudatused' : 'Salvesta sõitja'}</Button></div>
                                                </DialogFooter>
                                            </form>
                                        </Form>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </div>
                        <CardDescription>Kõik sõitjad, kes on hooaja jooksul osalenud või manuaalselt lisatud.</CardDescription>
                    </CardHeader>
                    <CardContent>
                    {isLoading ? (<div className="flex justify-center items-center py-10"><LoadingSpinner size={32} /></div>) : allDrivers.length > 0 ? (<Table><TableHeader><TableRow><TableHead className="w-[50px]">#</TableHead><TableHead>Nimi</TableHead><TableHead>Klass</TableHead><TableHead>Vanus</TableHead><TableHead>Sünnikuupäev</TableHead><TableHead>Kaal</TableHead><TableHead className="text-right">Tegevused</TableHead></TableRow></TableHeader><TableBody>{allDrivers.map((driver, index) => (<TableRow key={driver.id || index}><TableCell>{index + 1}</TableCell><TableCell>{driver.name}</TableCell><TableCell>{driver.class || 'N/A'}</TableCell><TableCell>{calculateAge(driver.dob) ?? 'N/A'}</TableCell><TableCell>{driver.dob || 'N/A'}</TableCell><TableCell>{driver.weight ? `${driver.weight} kg` : 'N/A'}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" title="Muuda sõitjat" onClick={() => { setEditingDriver(driver); setIsDriverFormOpen(true);}}><Edit className="h-4 w-4" /></Button></TableCell></TableRow>))}</TableBody></Table>) : (<p className="text-center text-muted-foreground py-10">Sõitjaid ei leitud. Lisa uus sõitja.</p>)}
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="teams">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Shield className="h-6 w-6 text-primary" />
                                <CardTitle>Meeskondade nimekiri</CardTitle>
                            </div>
                            <Dialog open={isTeamFormOpen} onOpenChange={setIsTeamFormOpen}>
                                <DialogTrigger asChild><Button onClick={() => setEditingTeam(null)}><UserPlus className="mr-2 h-4 w-4" /> Lisa uus meeskond</Button></DialogTrigger>
                                <DialogContent className="sm:max-w-3xl">
                                    <DialogHeader><DialogTitle>{editingTeam ? 'Muuda meeskonna andmeid' : 'Lisa uus meeskond'}</DialogTitle><DialogDescription>{editingTeam ? 'Muuda allolevaid välju ja salvesta muudatused.' : 'Täida väljad, et luua uus meeskond.'}</DialogDescription></DialogHeader>
                                    <Form {...teamForm}>
                                        <form onSubmit={teamForm.handleSubmit(onTeamSubmit)} className="space-y-4 py-4">
                                            <FormField control={teamForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Meeskonna nimi</FormLabel><FormControl><Input placeholder="Tiim Corner" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                              <FormField control={teamForm.control} name="driver1Id" render={({ field }) => (<FormItem><FormLabel>1. sõitja</FormLabel><div className="relative"><Input placeholder="Otsi..." value={driver1Search} onChange={e => setDriver1Search(e.target.value)} className="mb-2 pl-8" /><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /></div><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Vali 1. sõitja" /></SelectTrigger></FormControl><SelectContent>{filteredDrivers1.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</Select><FormMessage /></FormItem>)} />
                                              <FormField control={teamForm.control} name="driver2Id" render={({ field }) => (<FormItem><FormLabel>2. sõitja</FormLabel><div className="relative"><Input placeholder="Otsi..." value={driver2Search} onChange={e => setDriver2Search(e.target.value)} className="mb-2 pl-8" /><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /></div><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Vali 2. sõitja" /></SelectTrigger></FormControl><SelectContent>{filteredDrivers2.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</Select><FormMessage /></FormItem>)} />
                                              <FormField control={teamForm.control} name="substituteDriverId" render={({ field }) => (<FormItem><FormLabel>Asendussõitja (valikuline)</FormLabel><div className="relative"><Input placeholder="Otsi..." value={substituteSearch} onChange={e => setSubstituteSearch(e.target.value)} className="mb-2 pl-8" /><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /></div><Select onValueChange={field.onChange} value={field.value ?? undefined}><FormControl><SelectTrigger><SelectValue placeholder="Vali asendussõitja" /></SelectTrigger></FormControl><SelectContent>{filteredSubstituteDrivers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</Select><FormMessage /></FormItem>)} />
                                            </div>
                                            <FormField control={teamForm.control} name="substituteUsedOnEvent" render={({ field }) => (<FormItem><FormLabel>Asendust kasutati etapil (ainult 1)</FormLabel><Select onValueChange={field.onChange} value={field.value ?? undefined} disabled={!teamForm.watch('substituteDriverId')}><FormControl><SelectTrigger><SelectValue placeholder="Vali etapp" /></SelectTrigger></FormControl><SelectContent><SelectItem value=" ">Ära kasuta</SelectItem>{RACE_CALENDAR.map(event => <SelectItem key={event} value={event}>{event}</SelectItem>)}</Select><FormMessage /></FormItem>)} />
                                            <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Tühista</Button></DialogClose><Button type="submit">{editingTeam ? 'Salvesta muudatused' : 'Salvesta meeskond'}</Button></DialogFooter>
                                        </form>
                                    </Form>
                                </DialogContent>
                            </Dialog>
                        </div>
                        <CardDescription>Hooajal osalevad meeskonnad. Meeskond koosneb kahest põhisõitjast ja valikuliselt ühest asendussõitjast.</CardDescription>
                    </CardHeader>
                    <CardContent>
                    {isLoading ? (<div className="flex justify-center items-center py-10"><LoadingSpinner size={32} /></div>) : teams.length > 0 ? (<Table><TableHeader><TableRow><TableHead className="w-[50px]">#</TableHead><TableHead>Meeskonna nimi</TableHead><TableHead>Sõitja 1</TableHead><TableHead>Sõitja 2</TableHead><TableHead>Asendussõitja</TableHead><TableHead>Asendus kasutusel</TableHead><TableHead className="text-right">Tegevused</TableHead></TableRow></TableHeader><TableBody>{teams.map((team, index) => (<TableRow key={team.id}><TableCell>{index + 1}</TableCell><TableCell>{team.name}</TableCell><TableCell>{driverIdToNameMap.get(team.driver1Id) || 'N/A'}</TableCell><TableCell>{driverIdToNameMap.get(team.driver2Id) || 'N/A'}</TableCell><TableCell>{team.substituteDriverId ? driverIdToNameMap.get(team.substituteDriverId) || 'N/A' : 'Puudub'}</TableCell><TableCell>{team.substituteUsedOnEvent && team.substituteUsedOnEvent.trim() ? team.substituteUsedOnEvent : 'N/A'}</TableCell><TableCell className="text-right space-x-1"><Button variant="ghost" size="icon" title="Muuda meeskonda" onClick={() => { setEditingTeam(team); setIsTeamFormOpen(true); }}><Edit className="h-4 w-4" /></Button><AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" title="Kustuta meeskond"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Kas oled kindel?</AlertDialogTitle><AlertDialogDescription>Seda tegevust ei saa tagasi võtta. Meeskond kustutatakse jäädavalt.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Tühista</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteTeam(team.id)}>Kustuta</AlertDialogAction></AlertDialogFooter></AlertDialog></TableCell></TableRow>))}</TableBody></Table>) : (<p className="text-center text-muted-foreground py-10">Meeskondi ei leitud. Lisa uus meeskond.</p>)}
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    </PageLayout>
  );
}