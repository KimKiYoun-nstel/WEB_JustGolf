/**
 * Seed/cleanup helper for live draw testing.
 *
 * Usage:
 *   node scripts/seed-draw-test-data.mjs seed --tournament 12 --count 40
 *   node scripts/seed-draw-test-data.mjs cleanup --tournament 12
 *
 * Optional:
 *   --prefix draw-test
 *   --registering-user <uuid>
 */

import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        args[key] = true;
      } else {
        args[key] = next;
        i += 1;
      }
    } else {
      args._.push(token);
    }
  }
  return args;
}

async function resolveRegisteringUserId(explicit) {
  if (explicit) return explicit;

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_admin", true)
    .limit(1)
    .maybeSingle();

  if (error || !data?.id) {
    throw new Error(
      `Unable to resolve registering user id automatically: ${error?.message ?? "no admin found"}`
    );
  }

  return data.id;
}

async function ensureTournamentExists(tournamentId) {
  const { data, error } = await supabase
    .from("tournaments")
    .select("id,title,status")
    .eq("id", tournamentId)
    .maybeSingle();

  if (error) {
    throw new Error(`Tournament lookup failed: ${error.message}`);
  }
  if (!data?.id) {
    throw new Error(`Tournament not found: ${tournamentId}`);
  }

  return data;
}

async function seed({ tournamentId, count, prefix, registeringUserId }) {
  const tournament = await ensureTournamentExists(tournamentId);
  const registrarId = await resolveRegisteringUserId(registeringUserId);
  const timestamp = Date.now();

  const rows = Array.from({ length: count }, (_, index) => {
    const seq = String(index + 1).padStart(2, "0");
    return {
      tournament_id: tournamentId,
      user_id: null,
      registering_user_id: registrarId,
      nickname: `${prefix}-${timestamp}-${seq}`,
      relation: "draw-seed",
      memo: "auto seeded for live draw test",
      status: "approved",
      approval_status: "approved",
    };
  });

  const { data, error } = await supabase
    .from("registrations")
    .insert(rows)
    .select("id,nickname,status");

  if (error) {
    throw new Error(`Seed insert failed: ${error.message}`);
  }

  console.log("Seed completed");
  console.log(`  Tournament: ${tournament.id} (${tournament.title})`);
  console.log(`  Added rows: ${(data ?? []).length}`);
  console.log(`  Prefix: ${prefix}`);
}

async function cleanup({ tournamentId, prefix }) {
  await ensureTournamentExists(tournamentId);

  const { data: targetRows, error: selectError } = await supabase
    .from("registrations")
    .select("id,nickname")
    .eq("tournament_id", tournamentId)
    .eq("relation", "draw-seed")
    .like("nickname", `${prefix}-%`);

  if (selectError) {
    throw new Error(`Cleanup select failed: ${selectError.message}`);
  }

  const ids = (targetRows ?? []).map((row) => row.id);
  if (ids.length === 0) {
    console.log("Cleanup done: no matching seed rows");
    return;
  }

  const { error: deleteError } = await supabase
    .from("registrations")
    .delete()
    .in("id", ids);

  if (deleteError) {
    throw new Error(`Cleanup delete failed: ${deleteError.message}`);
  }

  console.log("Cleanup completed");
  console.log(`  Deleted rows: ${ids.length}`);
  console.log(`  Tournament: ${tournamentId}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  const tournamentId = Number(args.tournament);
  const count = Number(args.count ?? 40);
  const prefix = String(args.prefix ?? "draw-test");
  const registeringUserId = args["registering-user"]
    ? String(args["registering-user"])
    : null;

  if (!command || !["seed", "cleanup"].includes(command)) {
    console.log("Usage:");
    console.log(
      "  node scripts/seed-draw-test-data.mjs seed --tournament <id> [--count 40] [--prefix draw-test] [--registering-user <uuid>]"
    );
    console.log(
      "  node scripts/seed-draw-test-data.mjs cleanup --tournament <id> [--prefix draw-test]"
    );
    process.exit(1);
  }

  if (!Number.isInteger(tournamentId) || tournamentId <= 0) {
    throw new Error("Valid --tournament is required");
  }

  if (command === "seed") {
    if (!Number.isInteger(count) || count <= 0) {
      throw new Error("--count must be positive integer");
    }
    await seed({ tournamentId, count, prefix, registeringUserId });
    return;
  }

  await cleanup({ tournamentId, prefix });
}

main().catch((error) => {
  console.error(error?.message ?? error);
  process.exit(1);
});
