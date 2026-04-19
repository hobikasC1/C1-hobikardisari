'use client';

import React from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const driverFormSchema = z.object({
  name: z.string().min(1, { message: "Nimi on kohustuslik." }),
  dob: z.string().optional(),
  weight: z.coerce.number().positive({ message: "Kaal peab olema positiivne number." }).optional(),
  class: z.enum(["Junior", "Standard", "Heavy"]).optional(),
});

export type DriverFormValues = z.infer<typeof driverFormSchema>;

interface DriverFormDialogProps {
  isFormOpen: boolean;
  setIsFormOpen: (open: boolean) => void;
  form: UseFormReturn<DriverFormValues>;
  onDriverFormSubmit: (data: DriverFormValues) => void;
}

export default function DriverFormDialog({ isFormOpen, setIsFormOpen, form, onDriverFormSubmit }: DriverFormDialogProps) {
  return (
    <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Muuda sõitja andmeid</DialogTitle>
          <DialogDescription>Muuda sõitja klassi või kaalu andmeid sellel etapil.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onDriverFormSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Nimi</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="weight" render={({ field }) => (
              <FormItem>
                <FormLabel>Kaal (kg)</FormLabel>
                <FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="class" render={({ field }) => (
              <FormItem>
                <FormLabel>Klass</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
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
            <DialogFooter className="sm:justify-end">
              <Button type="submit">Salvesta muudatused</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
