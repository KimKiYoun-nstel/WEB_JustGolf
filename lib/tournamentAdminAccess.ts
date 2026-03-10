import type { SupabaseClient } from "@supabase/supabase-js";

export type TournamentAdminAccess = {
  isAdmin: boolean;
  canManageTournament: boolean;
  canManageSideEvents: boolean;
  hasAnyManagedTournament: boolean;
};

export async function getTournamentAdminAccess(
  supabase: SupabaseClient,
  userId: string,
  tournamentId?: number
): Promise<TournamentAdminAccess> {
  const profileRes = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();

  if (profileRes.error) {
    return {
      isAdmin: false,
      canManageTournament: false,
      canManageSideEvents: false,
      hasAnyManagedTournament: false,
    };
  }

  const isAdmin = profileRes.data?.is_admin === true;
  if (isAdmin) {
    return {
      isAdmin: true,
      canManageTournament: true,
      canManageSideEvents: true,
      hasAnyManagedTournament: true,
    };
  }

  if (typeof tournamentId === "number" && Number.isFinite(tournamentId)) {
    const permissionRes = await supabase
      .from("manager_permissions")
      .select("id")
      .eq("user_id", userId)
      .eq("tournament_id", tournamentId)
      .eq("can_manage_side_events", true)
      .is("revoked_at", null)
      .maybeSingle();

    if (permissionRes.error) {
      return {
        isAdmin: false,
        canManageTournament: false,
        canManageSideEvents: false,
        hasAnyManagedTournament: false,
      };
    }

    const allowed = Boolean(permissionRes.data);
    return {
      isAdmin: false,
      canManageTournament: false,
      canManageSideEvents: allowed,
      hasAnyManagedTournament: allowed,
    };
  }

  const managedCountRes = await supabase
    .from("manager_permissions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("can_manage_side_events", true)
    .is("revoked_at", null);

  if (managedCountRes.error) {
    return {
      isAdmin: false,
      canManageTournament: false,
      canManageSideEvents: false,
      hasAnyManagedTournament: false,
    };
  }

  return {
    isAdmin: false,
    canManageTournament: false,
    canManageSideEvents: false,
    hasAnyManagedTournament: (managedCountRes.count ?? 0) > 0,
  };
}

export async function listManagedTournamentIds(
  supabase: SupabaseClient,
  userId: string
): Promise<number[]> {
  const managedRes = await supabase
    .from("manager_permissions")
    .select("tournament_id")
    .eq("user_id", userId)
    .eq("can_manage_side_events", true)
    .is("revoked_at", null);

  if (managedRes.error) return [];

  const ids = ((managedRes.data ?? []) as Array<{ tournament_id: number }>)
    .map((row) => row.tournament_id)
    .filter((value) => Number.isFinite(value));

  return Array.from(new Set(ids));
}
