import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { 
  Settings, 
  FileText, 
  Activity, 
  Stethoscope,
  Upload,
  User,
  Mail
} from "lucide-react";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdminLayoutProps {
  children: ReactNode;
  activeTab: "account" | "smtp" | "config" | "files" | "logs" | "diagnostic";
  onTabChange: (tab: "account" | "smtp" | "config" | "files" | "logs" | "diagnostic") => void;
  onLogout?: () => void;
}

const tabs = [
  { id: "account" as const, label: "Compte", icon: User },
  { id: "smtp" as const, label: "SMTP", icon: Mail },
  { id: "config" as const, label: "S3", icon: Settings },
  { id: "files" as const, label: "Fichiers", icon: FileText },
  { id: "logs" as const, label: "Logs", icon: Activity },
  { id: "diagnostic" as const, label: "Diagnostic", icon: Stethoscope },
];

export default function AdminLayout({ children, activeTab, onTabChange, onLogout }: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-admin-header border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Ooblik S3 Manager - Administration
            </h1>
            <p className="text-sm text-muted-foreground">
              Version 1.0.0 • Back-office sécurisé
            </p>
          </div>
          
          {onLogout && (
            <Button
              onClick={onLogout}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Déconnexion
            </Button>
          )}
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-admin-header border-b border-border">
        <div className="px-6">
          <div className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={cn(
                    "flex items-center space-x-2 py-4 border-b-2 transition-colors",
                    activeTab === tab.id
                      ? "border-primary text-primary font-medium"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="p-6">
        {children}
      </main>
    </div>
  );
}