import { useState } from "react";
import AdminLayout from "@/components/Layout/AdminLayout";
import UploadZone from "@/components/FileUpload/UploadZone";
import ConfigurationTab from "@/components/Admin/ConfigurationTab";
import FilesTab from "@/components/Admin/FilesTab";
import LogsTab from "@/components/Admin/LogsTab";
import DiagnosticTab from "@/components/Admin/DiagnosticTab";

const Index = () => {
  const [activeTab, setActiveTab] = useState<"config" | "files" | "logs" | "diagnostic" | "upload">("upload");

  const renderContent = () => {
    switch (activeTab) {
      case "upload":
        return (
          <div className="max-w-4xl">
            <div className="mb-6">
              <h2 className="text-2xl font-bold">Espace Client</h2>
              <p className="text-muted-foreground">
                Téléchargez vos fichiers PDF et images de manière sécurisée.
              </p>
            </div>
            <UploadZone />
          </div>
        );
      case "config":
        return <ConfigurationTab />;
      case "files":
        return <FilesTab />;
      case "logs":
        return <LogsTab />;
      case "diagnostic":
        return <DiagnosticTab />;
      default:
        return null;
    }
  };

  return (
    <AdminLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderContent()}
    </AdminLayout>
  );
};

export default Index;