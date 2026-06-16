import { supabase } from "@/integrations/supabase/client";

/**
 * Modo Fantasma — Super Dev impersonation helpers.
 * Tudo aqui é client-side; a segurança real é server-side (RPCs SECURITY DEFINER + RLS).
 */

const GHOST_FLAG = "lov_ghost_active";

export async function isSuperDev(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_super_dev", {});
  if (error) return false;
  return Boolean(data);
}

export async function isGhostActive(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_ghost_mode", {});
  if (error) return false;
  return Boolean(data);
}

export async function startGhost(targetCompanyId: string) {
  const { data, error } = await supabase.rpc("start_ghost_session", {
    p_target_company_id: targetCompanyId,
  });
  if (error) throw error;
  sessionStorage.setItem(GHOST_FLAG, "1");
  return data;
}

export async function stopGhost() {
  const { error } = await supabase.rpc("stop_ghost_session", {});
  sessionStorage.removeItem(GHOST_FLAG);
  if (error) throw error;
}

export function hasGhostFlag() {
  return sessionStorage.getItem(GHOST_FLAG) === "1";
}

export async function readGhostAudit(opts: {
  limit?: number;
  targetCompany?: string | null;
  since?: string | null;
} = {}) {
  const { data, error } = await supabase.rpc("read_ghost_audit", {
    p_limit: opts.limit ?? 200,
    p_target_company: opts.targetCompany ?? null,
    p_since: opts.since ?? null,
  });
  if (error) throw error;
  return data ?? [];
}