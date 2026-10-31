import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-xs tracking-[0.14em] text-brand uppercase">404</p>
      <h1 className="mt-3 font-serif text-4xl tracking-tight">Not found in the reviewed sources.</h1>
      <p className="mt-3 text-muted-foreground">That page doesn&apos;t exist here, or it hasn&apos;t been built yet.</p>
      <Button asChild className="mt-8">
        <Link href="/">Back to GapLens</Link>
      </Button>
    </main>
  );
}
