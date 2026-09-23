import { createFileRoute, Link } from "@tanstack/react-router";
import { JolibaMark } from "~/components/app/auth-layout";
import { Button } from "~/components/ui/button";

/**
 * Page d'entrée provisoire. Le site public (fonctionnalités, tarifs, carte en ligne) est
 * une tranche à part : cette page ne promet rien que le produit ne fasse déjà.
 */
export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Joliba — le système d'exploitation du restaurant" }] }),
  component: Home,
});

function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-4 py-12">
      <JolibaMark />
      <h1 className="text-title-2xl text-ink">Le service, visible de la salle à la caisse.</h1>
      <p className="text-body text-ink-2">
        Joliba relie la carte, la salle, la cuisine et la caisse de votre restaurant. Chaque membre de l'équipe voit ce que son
        rôle permet, dans l'établissement où il travaille.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link to="/connexion" search={{ redirect: "/app/onboarding" }}>
            Ouvrir mon établissement
          </Link>
        </Button>
        <Button asChild size="lg" variant="secondary">
          <Link to="/connexion">Se connecter</Link>
        </Button>
      </div>
    </main>
  );
}
