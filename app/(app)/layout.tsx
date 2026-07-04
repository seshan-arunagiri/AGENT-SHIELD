import { Sidebar } from "@/components/ui/sidebar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 bg-background/50 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
