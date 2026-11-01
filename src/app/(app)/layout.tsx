import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main
        id="main"
        className="relative z-10 mx-auto min-h-[70dvh] w-full max-w-[1100px] px-4 py-8 sm:px-6 sm:py-11"
      >
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
