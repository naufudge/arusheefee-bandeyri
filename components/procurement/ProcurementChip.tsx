"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ShoppingBag } from "lucide-react";
import { useTRPC } from "@/lib/trpc";
import { useHasPermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";

/**
 * "Procurement: Printer Servicing" on a document's own page, linking back
 * to the procurement it belongs to. Plain text for users who can't open
 * procurements.
 */
export function ProcurementChip({
  procurement,
}: {
  procurement: { id: string; title: string } | null | undefined;
}) {
  const canOpen = useHasPermission(PERMISSIONS.PROCUREMENT_READ);
  if (!procurement) return null;
  const body = (
    <>
      <ShoppingBag className="size-3 text-muted-foreground" />
      <span className="text-muted-foreground">Procurement:</span>
      <span className="max-w-[16rem] truncate font-medium text-foreground">{procurement.title}</span>
    </>
  );
  const cls =
    "inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-0.5 text-[11px]";
  return canOpen ? (
    <Link href={`/procurement/${procurement.id}`} className={`${cls} transition hover:bg-muted`}>
      {body}
    </Link>
  ) : (
    <span className={cls}>{body}</span>
  );
}

/**
 * Shown above a create form opened from a procurement: the new document will
 * be added to it.
 */
export function ProcurementContextBanner({ procurementId }: { procurementId: string | undefined }) {
  const trpc = useTRPC();
  const canOpen = useHasPermission(PERMISSIONS.PROCUREMENT_READ);
  const { data } = useQuery({
    ...trpc.procurement.getById.queryOptions({ id: procurementId ?? "" }),
    enabled: Boolean(procurementId) && canOpen,
  });
  if (!procurementId) return null;
  return (
    <div className="mb-6 flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
      <ShoppingBag className="size-4 shrink-0 text-primary" />
      <span>
        Will be added to procurement{" "}
        {data ? (
          <Link href={`/procurement/${procurementId}`} className="font-medium underline-offset-4 hover:underline">
            {data.title}
          </Link>
        ) : (
          "…"
        )}
        .
      </span>
    </div>
  );
}
