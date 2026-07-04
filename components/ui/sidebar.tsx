"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldAlert, LayoutDashboard, Activity, FileText, BarChart3, Settings, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Demo", href: "/demo", icon: Activity },
  { name: "Logs", href: "/logs", icon: FileText },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Architecture", href: "/architecture", icon: BookOpen },
  { name: "Docs", href: "/docs", icon: BookOpen },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex flex-col w-64 h-screen border-r border-border bg-background">
      <div className="p-6 flex items-center gap-3">
        <ShieldAlert className="w-6 h-6 text-primary" />
        <span className="font-semibold text-lg tracking-tight">AgentShield</span>
      </div>
      
      <div className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                isActive 
                  ? "bg-secondary text-secondary-foreground font-medium" 
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.name}
            </Link>
          );
        })}
      </div>
      
      <div className="p-4 border-t border-border/50 text-xs text-muted-foreground">
        AgentShield v0.1.0
      </div>
    </div>
  );
}
