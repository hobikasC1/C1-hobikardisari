
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PageLayoutProps {
  children: ReactNode;
  backHref?: string;
  className?: string;
}

export default function PageLayout({ children, backHref, className }: PageLayoutProps) {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-card py-3 px-6 shadow-md border-b">
        <div className="container mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
                <div>
                    <h1 className="text-3xl font-headline font-extrabold tracking-tighter">
                        CORNER<span className="text-primary">1</span>
                    </h1>
                    <p className="text-sm font-semibold tracking-wider text-muted-foreground -mt-1.5">
                        HOBIKARDISARI
                    </p>
                </div>
            </div>
             {backHref && (
                <Button asChild variant="outline">
                    <Link href={backHref}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Tagasi
                    </Link>
                </Button>
            )}
        </div>
      </header>
      <main className={cn("flex-grow container mx-auto px-4 py-8", className)}>
        {children}
      </main>
    </div>
  );
}
