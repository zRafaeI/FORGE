import type { SupabaseClient } from "@supabase/supabase-js";
import type { ForgeData } from "@/lib/domain/types";
import type { RemoteDocumentStore } from "./synced-repository";

/**
 * Um documento por usuário na tabela public.forge_documents (ver supabase/schema.sql).
 * O acesso é limitado ao próprio usuário pelas políticas de RLS; a gravação passa
 * pela função save_forge_document, que aplica o controle de revisão no banco.
 */
export class SupabaseRemote implements RemoteDocumentStore {
  constructor(
    private db: SupabaseClient,
    private userId: string,
  ) {}

  async fetch() {
    const { data, error } = await this.db
      .from("forge_documents")
      .select("data, revision")
      .eq("user_id", this.userId)
      .maybeSingle();
    if (error) throw error;
    return data ? { data: data.data as unknown, revision: data.revision as number } : null;
  }

  async push(doc: ForgeData, expectedRevision: number | null) {
    const { data, error } = await this.db.rpc("save_forge_document", {
      p_data: doc,
      p_schema_version: doc.schemaVersion,
      p_expected_revision: expectedRevision,
    });
    if (error) throw error;
    return (data as number | null) ?? null;
  }

  async remove() {
    const { error } = await this.db.from("forge_documents").delete().eq("user_id", this.userId);
    if (error) throw error;
  }
}
