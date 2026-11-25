"use client";

import { getSupabase, supabaseConfigured } from "@/lib/data/supabase-client";
import { joinedChallengeSchema } from "@/lib/domain/schemas";
import type { ChallengeTask, DateKey, JoinedChallenge } from "@/lib/domain/types";

export const challengesAvailable = supabaseConfigured;

export type ServerChallenge = Omit<JoinedChallenge, "joinedAt"> & { archived?: boolean };

function parseChallenge(raw: unknown): ServerChallenge {
  const r = raw as Record<string, unknown>;
  const parsed = joinedChallengeSchema.omit({ joinedAt: true }).parse({ ...r, description: r.description ?? undefined });
  return { ...parsed, archived: !!r.archived };
}

export class ChallengeError extends Error {}

const MESSAGES: Record<string, string> = {
  challenge_not_found: "Não encontramos um desafio com esse código. Confira e tente de novo.",
  challenge_ended: "Esse desafio já terminou.",
  code_taken: "Já existe um desafio com esse código. Escolha outro.",
  forbidden: "Só o responsável pelo FORGE pode fazer isso.",
  not_member: "Você não participa desse desafio.",
};

function fail(error: { message?: string } | null): never {
  const key = Object.keys(MESSAGES).find((k) => error?.message?.includes(k));
  if (key) throw new ChallengeError(MESSAGES[key]);
  const m = (error?.message ?? "").toLowerCase();
  if (["fetch", "network", "load failed", "connection"].some((t) => m.includes(t)))
    throw new ChallengeError("Sem conexão. Para entrar em um desafio é preciso internet.");
  throw new ChallengeError("Não foi possível concluir agora. Tente de novo em instantes.");
}

export async function joinChallenge(code: string): Promise<ServerChallenge> {
  const { data, error } = await getSupabase().rpc("forge_join_challenge", { p_code: code });
  if (error) fail(error);
  return parseChallenge(data);
}

export async function myChallenges(): Promise<ServerChallenge[]> {
  const { data, error } = await getSupabase().rpc("forge_my_challenges");
  if (error) fail(error);
  return ((data as unknown[]) ?? []).map(parseChallenge);
}

export async function leaveChallengeRemote(id: string): Promise<void> {
  const { error } = await getSupabase().rpc("forge_leave_challenge", { p_id: id });
  if (error) fail(error);
}

export async function reportDay(id: string, day: DateKey, done: number, total: number): Promise<void> {
  const { error } = await getSupabase().rpc("forge_challenge_report", { p_id: id, p_day: day, p_done: done, p_total: total });
  if (error) fail(error);
}

export async function groupProgress(id: string, day: DateKey): Promise<{ members: number; completed: number }> {
  const { data, error } = await getSupabase().rpc("forge_challenge_group", { p_id: id, p_day: day });
  if (error) fail(error);
  return data as { members: number; completed: number };
}

/* ---------- Painel do dono do app ---------- */

export async function isAdmin(): Promise<boolean> {
  if (!supabaseConfigured) return false;
  const { data, error } = await getSupabase().rpc("forge_is_admin");
  return !error && data === true;
}

export interface AdminChallenge extends ServerChallenge {
  members: number;
  completedToday: number;
  activeToday: number;
  daily: { day: DateKey; completed: number }[];
}

export async function adminChallenges(day: DateKey): Promise<AdminChallenge[]> {
  const { data, error } = await getSupabase().rpc("forge_admin_challenges", { p_day: day });
  if (error) fail(error);
  return ((data as Record<string, unknown>[]) ?? []).map((r) => ({
    ...parseChallenge(r),
    members: Number(r.members ?? 0),
    completedToday: Number(r.completedToday ?? 0),
    activeToday: Number(r.activeToday ?? 0),
    daily: (r.daily as AdminChallenge["daily"]) ?? [],
  }));
}

export interface ChallengeDraft {
  id?: string;
  code: string;
  name: string;
  description?: string;
  startDate: DateKey;
  days: number;
  tasks: ChallengeTask[];
  archived?: boolean;
}

export async function saveChallenge(draft: ChallengeDraft): Promise<ServerChallenge> {
  const { data, error } = await getSupabase().rpc("forge_admin_save_challenge", { p: draft });
  if (error) fail(error);
  return parseChallenge(data);
}

/* ---------- Fotos (privadas) ---------- */

const BUCKET = "challenge-photos";

/** Reduz a foto para no máximo 1280 px e JPEG, para enviar rápido e ocupar pouco. */
export async function compressPhoto(file: File, max = 1280): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new ChallengeError("Não foi possível abrir essa imagem. Tente outra foto.");
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new ChallengeError("Não foi possível preparar a foto."))), "image/jpeg", 0.82),
  );
}

export async function uploadPhoto(userId: string, challengeId: string, day: DateKey, file: File): Promise<string> {
  const blob = await compressPhoto(file);
  const path = `${userId}/${challengeId}/${day}.jpg`;
  const { error } = await getSupabase().storage.from(BUCKET).upload(path, blob, { upsert: true, contentType: "image/jpeg" });
  if (error) fail(error);
  return path;
}

export async function photoUrl(path: string): Promise<string | null> {
  const { data, error } = await getSupabase().storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  return error ? null : data.signedUrl;
}

export async function removePhotos(paths: string[]): Promise<void> {
  if (!paths.length) return;
  const { error } = await getSupabase().storage.from(BUCKET).remove(paths);
  if (error) fail(error);
}

/** Todas as fotos da pessoa (para excluir a conta). */
export async function removeAllPhotos(userId: string): Promise<void> {
  const storage = getSupabase().storage.from(BUCKET);
  const { data: folders } = await storage.list(userId, { limit: 1000 });
  for (const folder of folders ?? []) {
    const { data: files } = await storage.list(`${userId}/${folder.name}`, { limit: 1000 });
    const paths = (files ?? []).map((f) => `${userId}/${folder.name}/${f.name}`);
    if (paths.length) await storage.remove(paths);
  }
}
