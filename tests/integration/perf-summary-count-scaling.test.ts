import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function readProjectFile(relativePath: string) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(absolutePath, "utf8");
}

describe("perf/summary-count-scaling regression contracts", () => {
  it("tournaments page uses aggregate summary RPCs", () => {
    const source = readProjectFile("app/tournaments/page.tsx");

    expect(source).toContain('supabase.rpc("get_registration_counts_by_tournaments"');
    expect(source).toContain('supabase.rpc("get_round_preference_counts_by_tournaments"');
    expect(source).toContain('supabase.rpc("get_side_event_summaries_by_tournaments"');
  });

  it("admin side-events page keeps batched registrations query with .in()", () => {
    const source = readProjectFile("app/admin/tournaments/[id]/side-events/page.tsx");

    expect(source).toContain('.from("side_event_registrations")');
    expect(source).toContain('.in("side_event_id", sideEventIds)');
    expect(source).toContain("const [serRes, roundPreferenceRes, moRes] = await Promise.all([");
  });

  it("admin registrations page keeps pagination and aggregate summary RPC", () => {
    const source = readProjectFile("app/admin/tournaments/[id]/registrations/page.tsx");

    expect(source).toContain(".range(offset, offset + REGISTRATION_PAGE_SIZE - 1)");
    expect(source).toContain('supabase.rpc("get_registration_counts_by_tournaments"');
  });

  it("public participants page uses count RPC + first page range query", () => {
    const source = readProjectFile("app/t/[id]/participants/page.tsx");

    expect(source).toContain('supabase.rpc("get_registration_counts_by_tournaments"');
    expect(source).toContain(".range(0, REGISTRATION_PAGE_SIZE - 1)");
  });

  it("migration 041 defines aggregate RPCs and supporting indexes", () => {
    const sql = readProjectFile("db/migrations/041_aggregate_summary_rpcs.sql");

    expect(sql).toContain("create or replace function public.get_round_preference_counts_by_tournaments");
    expect(sql).toContain("create or replace function public.get_side_event_summaries_by_tournaments");
    expect(sql).toContain("create index if not exists idx_side_events_tournament_round_id");
    expect(sql).toContain("create index if not exists idx_side_event_registrations_side_event_status");
  });
});

