import { redirect } from "next/navigation";
import { format } from "date-fns";
import { Clock4, CalendarDays } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SignatureCard } from "@/components/profile/SignatureCard";

const SIGNATURE_REF_TYPE = "staff_signature";

export const dynamic = "force-dynamic";

function fmtDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return format(date, "d MMM yyyy");
}

function fmtDateTime(date: Date | null | undefined): string {
  if (!date) return "—";
  return format(date, "d MMM yyyy, HH:mm");
}

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .slice(0, 2)
      .join("") || "?"
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-baseline gap-4 border-t py-3 first:border-t-0 first:pt-0 last:pb-0">
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className="text-sm">
        {value || <span className="text-muted-foreground">—</span>}
      </div>
    </div>
  );
}

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const staff = await prisma.staff.findUnique({
    where: { id: session.user.id },
    include: { roles: { select: { id: true, name: true } } },
  });
  if (!staff) redirect("/login");

  const signature = await prisma.attachment.findFirst({
    where: { reference_type: SIGNATURE_REF_TYPE, reference_id: staff.id },
    orderBy: { createdAt: "desc" },
    select: { updatedAt: true },
  });

  return (
    <div className="font-poppins h-full">
      {/* Header */}
      <header className="flex flex-col gap-5 border-b pb-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div
            className="flex size-14 shrink-0 items-center justify-center rounded-full bg-foreground text-base font-semibold text-background"
            aria-hidden="true"
          >
            {initialsOf(staff.name)}
          </div>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Profile
            </div>
            <h1 className="mt-1 truncate text-3xl font-semibold tracking-tight">
              {staff.name}
            </h1>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {[staff.designation, staff.department].filter(Boolean).join(" · ") ||
                "—"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground md:justify-end">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-3.5" />
            Joined {fmtDate(staff.createdAt)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock4 className="size-3.5" />
            Last seen {fmtDateTime(staff.lastLoginAt)}
          </span>
        </div>
      </header>

      {/* Body */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="profile-fade-up" style={{ animationDelay: "0ms" }}>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Details</CardTitle>
            <p className="text-sm text-muted-foreground">
              These details come from your sign-in. Ask IT if anything looks
              wrong.
            </p>
          </CardHeader>
          <CardContent>
            <DetailRow label="Name" value={staff.name} />
            <DetailRow label="Email" value={staff.email} />
            <DetailRow label="Designation" value={staff.designation} />
            <DetailRow label="Job title" value={staff.jobTitle} />
            <DetailRow label="Department" value={staff.department} />
            <DetailRow
              label="Roles"
              value={
                staff.roles.length === 0 ? (
                  <span className="italic text-muted-foreground">
                    No roles assigned yet
                  </span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {staff.roles.map((r) => (
                      <Badge
                        key={r.id}
                        variant="secondary"
                        className="font-normal"
                      >
                        {r.name}
                      </Badge>
                    ))}
                  </div>
                )
              }
            />
          </CardContent>
        </Card>

        <Card className="profile-fade-up" style={{ animationDelay: "80ms" }}>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Signature</CardTitle>
            <p className="text-sm text-muted-foreground">
              Appears on documents you approve. Use a transparent PNG for the
              best result.
            </p>
          </CardHeader>
          <CardContent>
            <SignatureCard
              hasSignature={Boolean(signature)}
              signatureUpdatedAt={signature?.updatedAt.toISOString() ?? null}
            />
          </CardContent>
        </Card>
      </div>

      <style>{`
        @keyframes profileFade {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .profile-fade-up {
          opacity: 0;
          animation: profileFade 600ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}
