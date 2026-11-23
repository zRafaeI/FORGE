import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-20">
      <h1 className="type-display text-4xl">Página não encontrada</h1>
      <p className="mt-4 text-muted">Este endereço não existe ou esta seção ainda não foi construída.</p>
      <Link href="/" className="mt-8 inline-block text-accent hover:underline">
        Voltar para o dashboard
      </Link>
    </div>
  );
}
