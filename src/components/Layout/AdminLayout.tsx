import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { 
  Settings, 
  FileText, 
  Activity, 
  Stethoscope,
  Upload
} from "lucide-react";

interface AdminLayoutProps {
  children: ReactNode;
  activeTab: "config" | "files" | "logs" | "diagnostic" | "upload";
  onTabChange: (tab: "config" | "files" | "logs" | "diagnostic" | "upload") => void;
}

const tabs = [
  { id: "upload" as const, label: "Espace Client", icon: Upload },
  { id: "config" as const, label: "Configuration", icon: Settings },
  { id: "files" as const, label: "Fichiers", icon: FileText },
  { id: "logs" as const, label: "Logs", icon: Activity },
  { id: "diagnostic" as const, label: "Diagnostic", icon: Stethoscope },
];

export default function AdminLayout({ children, activeTab, onTabChange }: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-admin-header border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
              <Upload className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Ooblik S3 Manager</h1>
              <p className="text-sm text-muted-foreground">Gestionnaire de fichiers volumineux</p>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            Version 1.0.0
          </div>
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