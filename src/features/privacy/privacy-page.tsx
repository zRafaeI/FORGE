import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";

/** Página de privacidade em linguagem simples. Pode ser lida com ou sem login. */

export const PRIVACY_UPDATED = "28 de novembro de 2026";
export const PRIVACY_CONTACT = "eurafaelguerra@gmail.com";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="type-title text-[15px]">{title}</h2>
      <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-muted [&_strong]:font-normal [&_strong]:text-ink">{children}</div>
    </section>
  );
}

function Item({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="border-l-2 border-accent-deep pl-4">
      <p className="text-ink">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted">{children}</p>
    </li>
  );
}

export function PrivacyPage() {
  return (
    <article className="max-w-[68ch]">
      <PageHeader
        title="Privacidade"
        description="Como o FORGE cuida dos seus dados, em poucas palavras. Sem letra miúda."
      />

      <div className="flex flex-col gap-10">
        <ul className="flex flex-col gap-2.5 rounded-lg border border-line bg-surface p-5 text-[15px] leading-relaxed">
          <li>O FORGE não vende seus dados e não mostra anúncios.</li>
          <li>Só guardamos o que o app precisa para funcionar.</li>
          <li>Você pode baixar uma cópia e apagar tudo quando quiser, direto em Configurações.</li>
        </ul>

        <Section title="O que guardamos">
          <ul className="flex flex-col gap-4">
            <Item title="Sua conta">
              E-mail e senha. A senha é guardada de forma criptografada pelo serviço de login e ninguém consegue vê-la, nem quem
              faz o FORGE.
            </Item>
            <Item title="Seus registros">
              O que você cadastra no app: rotina, hábitos, treinos, alimentação, água, peso (só se você ativar), estudos, fé e
              finanças. Ficam guardados para sincronizar entre seus aparelhos.
            </Item>
            <Item title="Notificações">
              Se você ativar, guardamos o endereço técnico do aparelho para enviar os lembretes e o seu fuso horário, para eles
              chegarem na hora certa.
            </Item>
            <Item title="Sugestões que você enviar">
              A mensagem, a tela em que você estava, o tipo de aparelho e a versão do app. O seu e-mail só vai junto se você
              marcar a opção de resposta.
            </Item>
            <Item title="Desafios">
              Em quais desafios você entrou e, para o progresso do grupo, só quantas tarefas fez em cada dia. Quem organiza
              o desafio vê a lista de participantes com o nome do seu perfil; os outros participantes não. As fotos do
              check-in são opcionais e ficam numa área privada: no app, só você vê. Outros participantes nunca têm acesso,
              e quem mantém o FORGE não as consulta.
            </Item>
            <Item title="E-mails">
              De vez em quando, quem faz o FORGE pode mandar um e-mail sobre o app para o endereço da sua conta, como um
              lembrete para voltar ou uma novidade importante. É raro, e você pode pedir para parar a qualquer momento
              respondendo o próprio e-mail.
            </Item>
            <Item title="Estatísticas de visita">
              Contagem de visitas e páginas mais acessadas, sem cookies e sem identificar quem você é. Servem só para saber se o
              app está sendo útil.
            </Item>
          </ul>
          <p>
            O FORGE não pede CPF, endereço, telefone ou dados de cartão. No apoio por Pix, o pagamento acontece no app do seu
            banco: o FORGE não recebe nem guarda nenhum dado do pagamento.
          </p>
        </Section>

        <Section title="Quem vê seus dados">
          <p>
            <strong>Só você.</strong> Regras de segurança no banco de dados impedem que qualquer outra conta leia os seus
            registros.
          </p>
          <p>
            Quem mantém o FORGE tem acesso técnico ao banco para que o app funcione e para corrigir problemas, e não consulta
            registros pessoais. Para acompanhar o uso do app, vê só o nome do seu perfil, quando você criou a conta e o dia do
            último uso, nunca o que você registrou. Seus dados não são compartilhados com ninguém.
          </p>
        </Section>

        <Section title="Onde ficam">
          <p>
            Em serviços conhecidos e seguros: o <strong>Supabase</strong> (banco de dados e login) e a <strong>Vercel</strong>{" "}
            (onde o site fica no ar). Esses serviços podem armazenar dados em servidores fora do Brasil, sempre com conexão
            criptografada.
          </p>
        </Section>

        <Section title="Seus direitos">
          <p>Pela Lei Geral de Proteção de Dados (LGPD), você pode, a qualquer momento:</p>
          <ul className="flex flex-col gap-4">
            <Item title="Ter uma cópia">Em Configurações → Exportar backup, você baixa tudo o que registrou.</Item>
            <Item title="Corrigir">Tudo o que você cadastrou pode ser editado no próprio app.</Item>
            <Item title="Apagar os registros">Em Configurações → Apagar dados, seus registros são apagados e a conta continua.</Item>
            <Item title="Excluir a conta">
              Em Configurações → Excluir minha conta, a conta, todos os registros e as fotos dos desafios são apagados de vez.
              Sugestões já enviadas continuam, mas sem nenhuma ligação com você.
            </Item>
          </ul>
        </Section>

        <Section title="Dúvidas">
          <p>
            Fale com quem faz o FORGE pelo e-mail{" "}
            <a href={`mailto:${PRIVACY_CONTACT}`} className="text-accent underline-offset-4 hover:underline">
              {PRIVACY_CONTACT}
            </a>{" "}
            ou pelo botão Enviar sugestão, dentro do app.
          </p>
          <p className="text-sm text-faint">Última atualização: {PRIVACY_UPDATED}. Se algo mudar, esta página será atualizada.</p>
        </Section>
      </div>
    </article>
  );
}
