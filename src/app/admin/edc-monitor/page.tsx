import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { edcStatusBadge, formatDateTime, formatRupiah, orderStatusBadge } from "./format";

const ALLOWED_ROLES = ["ADMIN", "MANAGER"];
const MAX_ROWS = 200;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const ADMIN_SOURCES = ["admin_manual_paid", "admin_manual_cancel"];

// An order counts as "stuck" once the daemon has had time to finish
// (approved, rejected, or timed out) -- younger ones are probably still
// mid-payment, not lost.
const STUCK_AFTER_MS = 10 * 60 * 1000;

const TABS = [
  { key: "nyangkut", label: "Nyangkut" },
  { key: "ambigu", label: "EDC Ambigu" },
  { key: "batal", label: "Dibatalkan" },
  { key: "admin", label: "Diselesaikan admin" },
  { key: "semua", label: "Semua" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

type SearchParams = Record<string, string | string[] | undefined>;

function param(sp: SearchParams, key: string) {
  const v = sp[key];
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

function todayWIB() {
  return new Date(Date.now() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

function shiftDay(ymd: string, days: number) {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

// "YYYY-MM-DD" in WIB -> the UTC instant that day starts.
function wibDayStart(ymd: string) {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) - WIB_OFFSET_MS);
}

function validDate(v: string, fallback: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : fallback;
}

function tabWhere(tab: TabKey): Prisma.OrderWhereInput {
  const stuck: Prisma.OrderWhereInput = {
    status: "PENDING",
    createdAt: { lt: new Date(Date.now() - STUCK_AFTER_MS) },
    edcJobs: { some: {} },
  };
  const ambiguous: Prisma.OrderWhereInput = {
    status: "CANCELLED",
    edcJobs: { some: { status: { in: ["APPROVED", "PROCESSING", "PENDING"] } } },
  };
  const cancelled: Prisma.OrderWhereInput = { status: "CANCELLED" };
  const resolved: Prisma.OrderWhereInput = { statusLogs: { some: { source: { in: ADMIN_SOURCES } } } };
  switch (tab) {
    case "nyangkut":
      return stuck;
    case "ambigu":
      return ambiguous;
    case "batal":
      return cancelled;
    case "admin":
      return resolved;
    case "semua":
      return { OR: [stuck, ambiguous, cancelled, resolved] };
  }
}

function hrefWith(current: Record<string, string>, changes: Record<string, string>) {
  const next = new URLSearchParams({ ...current, ...changes });
  for (const [k, v] of [...next.entries()]) if (!v) next.delete(k);
  const qs = next.toString();
  return `/admin/edc-monitor${qs ? `?${qs}` : ""}`;
}

function resolvedNote(logs: { source: string; metadata: Prisma.JsonValue; createdAt: Date }[]) {
  const log = logs[0];
  if (!log) return null;
  const meta = (log.metadata ?? {}) as { reffNo?: string; actorName?: string };
  const action = log.source === "admin_manual_paid" ? "Ditandai lunas" : "Dibatalkan admin";
  const who = meta.actorName ? ` oleh ${meta.actorName}` : "";
  const reff = meta.reffNo ? ` · Reff ${meta.reffNo}` : "";
  return `${action}${who}${reff}`;
}

export default async function EdcMonitorPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || !role || !ALLOWED_ROLES.includes(role)) {
    redirect("/admin/login?callbackUrl=/admin/edc-monitor");
  }

  const sp = await searchParams;
  const today = todayWIB();
  const tabParam = param(sp, "tab");
  const tab: TabKey = TABS.some((t) => t.key === tabParam) ? (tabParam as TabKey) : "nyangkut";
  let from = validDate(param(sp, "dari"), today);
  let to = validDate(param(sp, "sampai"), from);
  if (to < from) [from, to] = [to, from];
  const q = param(sp, "q");
  const methodParam = param(sp, "metode").toUpperCase();
  const method = methodParam === "QRIS" || methodParam === "CARD" ? methodParam : "";

  const baseFilters: Prisma.OrderWhereInput[] = [
    { createdAt: { gte: wibDayStart(from), lt: wibDayStart(shiftDay(to, 1)) } },
  ];
  if (method) baseFilters.push({ edcJobs: { some: { method } } });
  if (q) {
    const or: Prisma.OrderWhereInput[] = [
      { customerName: { contains: q, mode: "insensitive" } },
      { id: { contains: q, mode: "insensitive" } },
    ];
    const queue = Number(q.replace(/^#/, ""));
    if (Number.isInteger(queue) && queue > 0) or.push({ queueNumber: queue });
    baseFilters.push({ OR: or });
  }

  const [counts, orders, approvedButCancelled] = await Promise.all([
    Promise.all(TABS.map((t) => prisma.order.count({ where: { AND: [...baseFilters, tabWhere(t.key)] } }))),
    prisma.order.findMany({
      where: { AND: [...baseFilters, tabWhere(tab)] },
      include: {
        edcJobs: { orderBy: { createdAt: "desc" } },
        statusLogs: {
          where: { source: { in: ADMIN_SOURCES } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { source: true, metadata: true, createdAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: MAX_ROWS,
    }),
    prisma.order.count({
      where: { AND: [...baseFilters, { status: "CANCELLED", edcJobs: { some: { status: "APPROVED" } } }] },
    }),
  ]);

  const current = { tab, dari: from, sampai: to, q, metode: method };
  const yesterday = shiftDay(today, -1);
  const quickRanges = [
    { label: "Hari ini", dari: today, sampai: today },
    { label: "Kemarin", dari: yesterday, sampai: yesterday },
    { label: "7 hari", dari: shiftDay(today, -6), sampai: today },
    { label: "30 hari", dari: shiftDay(today, -29), sampai: today },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8 text-zinc-900 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div>
          <h1 className="text-2xl font-bold">Monitor Order EDC</h1>
          <p className="mt-1 max-w-3xl text-sm text-zinc-500">
            Order yang pembayarannya lewat EDC tapi nggak beres dengan bersih. Cocokkan dengan struk fisik EDC, lalu
            buka Detail untuk menandai lunas atau membatalkan.
          </p>
        </div>

        {approvedButCancelled > 0 && (
          <Link
            href={hrefWith(current, { tab: "ambigu" })}
            className="block rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 hover:bg-red-100"
          >
            <span className="font-semibold">{approvedButCancelled} order dibatalkan padahal EDC-nya APPROVED</span> di
            rentang tanggal ini. Kemungkinan customer udah bayar. Cek tab EDC Ambigu dulu.
          </Link>
        )}

        <Card>
          <CardContent className="space-y-4 p-4">
            <form method="get" action="/admin/edc-monitor" className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="tab" value={tab} />
              <label className="space-y-1 text-sm">
                <span className="block font-medium text-zinc-700">Dari</span>
                <Input type="date" name="dari" defaultValue={from} max={today} className="w-40" />
              </label>
              <label className="space-y-1 text-sm">
                <span className="block font-medium text-zinc-700">Sampai</span>
                <Input type="date" name="sampai" defaultValue={to} max={today} className="w-40" />
              </label>
              <label className="min-w-[14rem] flex-1 space-y-1 text-sm">
                <span className="block font-medium text-zinc-700">Cari</span>
                <Input type="search" name="q" defaultValue={q} placeholder="No. antrian, nama customer, atau Order ID" />
              </label>
              <label className="space-y-1 text-sm">
                <span className="block font-medium text-zinc-700">Metode</span>
                <select
                  name="metode"
                  defaultValue={method}
                  className="flex h-10 w-32 rounded-lg border border-zinc-300 bg-white px-3 text-sm focus-visible:border-zinc-900 focus-visible:outline-none"
                >
                  <option value="">Semua</option>
                  <option value="QRIS">QRIS</option>
                  <option value="CARD">Kartu</option>
                </select>
              </label>
              <Button type="submit" className="h-10">
                Terapkan
              </Button>
              <Link
                href={hrefWith({}, { tab })}
                className="inline-flex h-10 items-center rounded-lg px-3 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
              >
                Reset
              </Link>
            </form>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-zinc-500">Cepat:</span>
              {quickRanges.map((r) => {
                const active = r.dari === from && r.sampai === to;
                return (
                  <Link
                    key={r.label}
                    href={hrefWith(current, { dari: r.dari, sampai: r.sampai })}
                    className={cn(
                      "rounded-full border px-3 py-1",
                      active ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white hover:bg-zinc-50"
                    )}
                  >
                    {r.label}
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <nav aria-label="Filter status" className="flex flex-wrap gap-1 border-b border-zinc-200">
          {TABS.map((t, i) => {
            const active = t.key === tab;
            return (
              <Link
                key={t.key}
                href={hrefWith(current, { tab: t.key })}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium",
                  active ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-900"
                )}
              >
                {t.label}
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs tabular-nums",
                    active ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-700"
                  )}
                >
                  {counts[i]}
                </span>
              </Link>
            );
          })}
        </nav>

        <Card>
          <CardContent className="p-0">
            {orders.length === 0 ? (
              <p className="px-4 py-16 text-center text-sm text-zinc-500">
                Nggak ada order di tab ini untuk filter yang dipilih.
              </p>
            ) : (
              <Table>
                <TableHeader className="bg-zinc-50">
                  <TableRow>
                    <TableHead className="pl-4">Antrian</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Metode</TableHead>
                    <TableHead>Status order</TableHead>
                    <TableHead>Status EDC</TableHead>
                    <TableHead className="text-center">Percobaan</TableHead>
                    <TableHead>Keterangan</TableHead>
                    <TableHead>Waktu</TableHead>
                    <TableHead className="pr-4">
                      <span className="sr-only">Aksi</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => {
                    const latestJob = order.edcJobs[0];
                    const note = resolvedNote(order.statusLogs) ?? latestJob?.errorMessage ?? "-";
                    return (
                      <TableRow key={order.id}>
                        <TableCell className="pl-4 font-mono text-sm font-semibold">
                          #{String(order.queueNumber ?? 0).padStart(3, "0")}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">
                            {order.customerName || <span className="font-normal text-zinc-400">(tanpa nama)</span>}
                          </p>
                          <p className="font-mono text-[11px] text-zinc-400">{order.id}</p>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatRupiah(latestJob?.amount ?? order.total)}
                        </TableCell>
                        <TableCell>{latestJob?.method === "CARD" ? "Kartu" : latestJob?.method ?? "-"}</TableCell>
                        <TableCell>{orderStatusBadge(order.status)}</TableCell>
                        <TableCell>{latestJob ? edcStatusBadge(latestJob.status, order.status) : "-"}</TableCell>
                        <TableCell className="text-center tabular-nums">{order.edcJobs.length}</TableCell>
                        <TableCell className="max-w-[260px] truncate text-xs text-zinc-500" title={note}>
                          {note}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-zinc-500">
                          {formatDateTime(order.createdAt)}
                        </TableCell>
                        <TableCell className="pr-4">
                          <Link
                            href={`/admin/edc-monitor/${encodeURIComponent(order.id)}`}
                            className="inline-flex h-8 items-center rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium hover:bg-zinc-50"
                          >
                            Detail
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {orders.length === MAX_ROWS && (
          <p className="text-center text-sm text-zinc-500">
            Menampilkan {MAX_ROWS} order terbaru. Persempit tanggal atau pakai pencarian untuk lihat sisanya.
          </p>
        )}
      </div>
    </div>
  );
}
