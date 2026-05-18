import React from "react";
import { format } from "date-fns";
import type { ApprovalEventKind } from "@prisma/client";
import {
  KIND_LABEL,
  KIND_ICON,
  KIND_TONE,
  PC_ROLE_LABEL,
} from "./event-display";

interface TimelineEvent {
  id: string;
  kind: ApprovalEventKind;
  pettyCashRole?: string | null;
  comment?: string | null;
  createdAt: Date | string;
  actor: { id: string; name: string; designation: string };
}

interface ApprovalTimelineProps {
  events: TimelineEvent[];
}

export function ApprovalTimeline({ events }: ApprovalTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-md border border-dashed bg-card/50 p-6 text-center text-sm text-muted-foreground">
        No activity yet.
      </div>
    );
  }

  return (
    <ol className="relative space-y-4 pl-6">
      <span
        aria-hidden
        className="absolute left-[11px] top-2 bottom-2 w-px bg-border"
      />
      {events.map((event) => {
        const Icon = KIND_ICON[event.kind];
        const tone = KIND_TONE[event.kind];
        const roleSuffix = event.pettyCashRole
          ? ` · ${PC_ROLE_LABEL[event.pettyCashRole] ?? event.pettyCashRole}`
          : "";
        return (
          <li key={event.id} className="relative">
            <span
              className={`absolute -left-6 top-0 flex h-6 w-6 items-center justify-center rounded-full ring-2 ${tone.bg} ${tone.ring}`}
            >
              <Icon className={`h-3.5 w-3.5 ${tone.icon}`} />
            </span>
            <div className="ml-2 rounded-md border bg-card p-3">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-sm font-medium">
                  {KIND_LABEL[event.kind]}
                  {roleSuffix}
                </span>
                <span className="text-xs text-muted-foreground">
                  by {event.actor.name}
                </span>
                <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
                  {format(new Date(event.createdAt), "d MMM yyyy, HH:mm")}
                </span>
              </div>
              {event.comment && (
                <p className="mt-1.5 whitespace-pre-wrap rounded bg-muted/40 p-2 text-xs text-foreground">
                  {event.comment}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
