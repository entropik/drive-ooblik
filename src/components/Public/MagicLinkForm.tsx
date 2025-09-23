import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Mail, Shield, Upload } from "lucide-react";

interface MagicLinkFormProps {
  onSuccess: (data: { email: string; space_name: string; token?: string }) => void;
}

const MagicLinkForm = ({ onSuccess }: MagicLinkFormProps) => {
  const [email, setEmail] = useState("");
  const [spaceName, setSpaceName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !spaceName) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`https://khygjfhrmnwtigqtdmgm.supabase.co/functions/v1/auth-magic-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoeWdqZmhybW53dGlncXRkbWdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2MzUwNDUsImV4cCI6MjA3NDIxMTA0NX0.iTtQEbCcScU_da3Micct9Y13_Obl8KVBa8M7FkHzIww',
        },
        body: JSON.stringify({
          email,
          space_name: spaceName,
          hcaptcha_token: 'dev-token' // En dev, token fictif
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la demande');
      }

      if (data.magic_link) {
        // En développement, on affiche le lien directement
        toast.success(`Lien d'accès généré ! Cliquez ici pour y accéder : ${data.magic_link}`, {
          duration: 10000,
          action: {
            label: "Copier le lien",
            onClick: () => navigator.clipboard.writeText(data.magic_link)
          }
        });
      } else {
        toast.success("Lien d'accès envoyé ! Vérifiez votre email.");
      }
      
      onSuccess({ email, space_name: spaceName, token: data.magic_token });

    } catch (error) {
      console.error('Erreur magic link:', error);
      toast.error(error instanceof Error ? error.message : "Erreur lors de l'envoi");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Upload className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Ooblik S3 Manager</CardTitle>
          <CardDescription>
            Accédez à votre espace de transfert sécurisé
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Adresse email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="votre@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="space" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Nom du projet d'impression
              </Label>
              <Input
                id="space"
                type="text"
                placeholder="Catalogue 2024, Cartes de visite..."
                value={spaceName}
                onChange={(e) => setSpaceName(e.target.value)}
                required
                className="w-full"
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                Donnez un nom parlant à votre projet pour le retrouver facilement
              </p>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Envoi en cours...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Recevoir le lien d'accès
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-muted rounded-lg">
            <h3 className="font-semibold text-sm mb-2">Règles d'upload :</h3>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Aucune limite de taille par fichier</li>
              <li>• Extensions : JPG, PNG, PDF, DOC, ZIP...</li>
              <li>• Quota total : 10 GB par espace</li>
              <li>• Reprise d'upload automatique</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MagicLinkForm;