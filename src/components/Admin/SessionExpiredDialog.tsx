import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Clock, AlertTriangle } from "lucide-react";

interface SessionExpiredDialogProps {
  isOpen: boolean;
  onClose: () => void;
  expirationTime?: string;
}

const SessionExpiredDialog = ({ isOpen, onClose, expirationTime }: SessionExpiredDialogProps) => {
  const [timeUntilExpiry, setTimeUntilExpiry] = useState<string>("");

  useEffect(() => {
    if (!expirationTime) return;

    const updateTimeUntilExpiry = () => {
      const now = new Date().getTime();
      const expiry = new Date(expirationTime).getTime();
      const difference = expiry - now;

      if (difference <= 0) {
        setTimeUntilExpiry("Expirée");
        return;
      }

      const hours = Math.floor(difference / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      
      if (hours > 0) {
        setTimeUntilExpiry(`${hours}h ${minutes}m`);
      } else {
        setTimeUntilExpiry(`${minutes}m`);
      }
    };

    updateTimeUntilExpiry();
    const interval = setInterval(updateTimeUntilExpiry, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [expirationTime]);

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <AlertDialogTitle>Session Expirée</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-2">
            <p>Votre session d'administration a expiré pour des raisons de sécurité.</p>
            {expirationTime && timeUntilExpiry && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>
                  {timeUntilExpiry === "Expirée" 
                    ? "Session expirée" 
                    : `Temps restant: ${timeUntilExpiry}`
                  }
                </span>
              </div>
            )}
            <p className="text-sm">
              Veuillez vous reconnecter pour continuer à utiliser l'interface d'administration.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onClose} className="bg-primary hover:bg-primary/90">
            Se reconnecter
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default SessionExpiredDialog;