"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Subscribes to changes on the given tables and refreshes the route so
 * server-rendered data stays in sync across teammates.
 */
export function useRealtime(tables: string[]) {
  const router = useRouter();

  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel("teamflow-realtime");

    for (const table of tables) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => router.refresh(),
      );
    }

    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(",")]);
}
