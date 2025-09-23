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
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-magic-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
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

      toast.success("Lien d'accès envoyé ! Vérifiez votre email.");
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
                Nom de l'espace
              </Label>
              <Input
                id="space"
                type="text"
                placeholder="Mon espace de transfert"
                value={spaceName}
                onChange={(e) => setSpaceName(e.target.value)}
                required
                className="w-full"
              />
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
              <li>• Taille max : 100 MB par fichier</li>
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