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
    <main className="flex min-h-dvh flex-col bg-background">
      <header className="flex h-14 items-center px-4 md:px-6">
        <JolibaMark />
      </header>
      <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-4 py-12">
        <h1 className="text-4xl font-semibold tracking-tight text-balance md:text-5xl">
          Le service qui coule de source.
        </h1>
        <p className="text-lg text-muted-foreground">
          Joliba relie la carte, la salle, la cuisine et la caisse de votre restaurant. Chaque membre de l'équipe voit ce que son
          rôle permet, dans l'établissement où il travaille.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link to="/connexion" search={{ redirect: "/app/onboarding" }}>
              Ouvrir mon établissement
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/connexion">Se connecter</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
