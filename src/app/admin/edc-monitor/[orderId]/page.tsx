import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatRupiah, formatTime } from "../format";
import { OrderActions } from "./order-actions";

const ALLOWED_ROLES = ["ADMIN", "MANAGER"];
const PAID_STATUSES = ["PAID", "PREPARING", "READY", "COMPLETED"] as const;
const DUPLICATE_WINDOW_MS = 3 * 60 * 60 * 1000;

function jobStatusBadge(status: string) {
  if (status === "APPROVED") return <Badge variant="success">APPROVED</Badge>;
  if (status === "FAILED" || status === "REJECTED") return <Badge variant="warning">{status}</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

function orderStatusBadge(status: string) {
  if (status === "PENDING") return <Badge variant="warning">PENDING</Badge>;
  if (status === "CANCELLED") return <Badge variant="destructive">CANCELLED</Badge>;
  return <Badge variant="success">{status}</Badge>;
}

// Possible re-orders by the same customer that DID go through -- marking this
// one paid too would make the kitchen prepare the order twice.
async function findLikelyDuplicates(order: { id: string; customerName: string | null; total: number; createdAt: Date }) {
  const around = {
    gte: new Date(order.createdAt.getTime() - DUPLICATE_WINDOW_MS),
    lte: new Date(order.createdAt.getTime() + DUPLICATE_WINDOW_MS),
  };
  return prisma.order.findMany({
    where: {
      id: { not: order.id },
      status: { in: [...PAID_STATUSES] },
      createdAt: around,
      ...(order.customerName
        ? { customerName: { equals: order.customerName, mode: "insensitive" as const } }
        : { total: order.total }),
    },
    select: { id: true, queueNumber: true, customerName: true, total: true, status: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    take: 10,
  });
}

export default async function EdcOrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId: rawId } = await params;
  const orderId = decodeURIComponent(rawId);

  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || !role || !ALLOWED_ROLES.includes(role)) {
    redirect(`/admin/login?callbackUrl=${encodeURIComponent(`/admin/edc-monitor/${rawId}`)}`);
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { orderBy: { createdAt: "asc" } },
      edcJobs: { orderBy: { createdAt: "desc" } },
      statusLogs: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) notFound();

  const duplicates = await findLikelyDuplicates(order);
  const latestJob = order.edcJobs[0];
  const canAct = order.status === "PENDING" && /^OLSERA-\d+$/.test(order.id);
  const chargedAmount = latestJob?.amount ?? order.total;

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8 text-zinc-900 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/admin/edc-monitor" className="text-sm text-zinc-500 hover:text-zinc-900">
          Kembali ke monitor
        </Link>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              #{String(order.queueNumber ?? 0).padStart(3, "0")}{" "}
              <span className="font-normal text-zinc-500">{order.customerName || "(tanpa nama)"}</span>
            </h1>
            <p className="mt-1 font-mono text-xs text-zinc-400">{order.id}</p>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-2">{orderStatusBadge(order.status)}</div>
            <p className="mt-1 text-lg font-semibold">{formatRupiah(chargedAmount)}</p>
            <p className="text-sm text-zinc-500">{formatDateTime(order.createdAt)}</p>
          </div>
        </div>

        {duplicates.length > 0 && (
          <Card className="border-amber-300 bg-amber-50">
            <CardHeader>
              <CardTitle className="text-amber-900">Hati-hati, kemungkinan customer udah order ulang</CardTitle>
              <CardDescription className="text-amber-900/80">
                Ada order lain {order.customerName ? "atas nama yang sama" : "dengan nominal yang sama"} di sekitar jam ini yang
                udah lunas. Kalau itu pesanan yang sama, jangan tandai order ini lunas, nanti pesanannya dibikin 2 kali.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm text-amber-950">
                {duplicates.map((d) => (
                  <li key={d.id}>
                    <Link href={`/admin/edc-monitor/${encodeURIComponent(d.id)}`} className="font-mono font-semibold underline underline-offset-2">
                      #{String(d.queueNumber ?? 0).padStart(3, "0")}
                    </Link>{" "}
                    {d.customerName || "(tanpa nama)"} &middot; {formatRupiah(d.total)} &middot; {d.status} &middot; jam {formatTime(d.createdAt)}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Tindakan</CardTitle>
            <CardDescription>
              Cocokkan dulu dengan struk fisik di mesin EDC sebelum memilih.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canAct ? (
              <OrderActions
                orderId={order.id}
                amountLabel={formatRupiah(chargedAmount)}
                timeLabel={formatTime(latestJob?.createdAt ?? order.createdAt)}
              />
            ) : order.status === "CANCELLED" ? (
              <p className="text-sm text-zinc-600">
                Order ini udah dibatalkan dan di-void di Olsera, jadi belum bisa ditandai lunas dari sini. Kalau struk EDC-nya
                ternyata sukses, catat nomor antrian dan Reff No-nya, lalu buatkan pesanannya manual di kasir.
              </p>
            ) : order.status === "PENDING" ? (
              <p className="text-sm text-zinc-600">
                Order ini nggak punya pasangan di Olsera, jadi belum bisa diproses dari sini.
              </p>
            ) : (
              <p className="text-sm text-zinc-600">Order ini udah berstatus {order.status}, nggak perlu tindakan lagi.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Item pesanan</CardTitle>
          </CardHeader>
          <CardContent>
            {order.items.length === 0 ? (
              <p className="text-sm text-zinc-500">Item order ini belum tersimpan di sistem.</p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {order.items.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-4 py-3">
                    <div>
                      <p className="font-medium">
                        {item.quantity}x {item.name}
                      </p>
                      {item.notes && <p className="mt-0.5 text-sm text-zinc-500">{item.notes}</p>}
                    </div>
                    <p className="shrink-0 text-sm tabular-nums">{formatRupiah(item.subtotal)}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Percobaan bayar EDC ({order.edcJobs.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {order.edcJobs.length === 0 ? (
              <p className="text-sm text-zinc-500">Belum ada percobaan bayar lewat EDC.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Jam</TableHead>
                    <TableHead>Metode</TableHead>
                    <TableHead>Nominal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Approval</TableHead>
                    <TableHead>Pesan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.edcJobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="text-xs">{formatDateTime(job.createdAt)}</TableCell>
                      <TableCell>{job.method}</TableCell>
                      <TableCell>{formatRupiah(job.amount)}</TableCell>
                      <TableCell>{jobStatusBadge(job.status)}</TableCell>
                      <TableCell className="font-mono text-xs">{job.approvalCode || "-"}</TableCell>
                      <TableCell className="text-xs text-zinc-500">{job.errorMessage || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Riwayat status</CardTitle>
          </CardHeader>
          <CardContent>
            {order.statusLogs.length === 0 ? (
              <p className="text-sm text-zinc-500">Belum ada catatan perubahan status.</p>
            ) : (
              <ol className="space-y-2 text-sm">
                {order.statusLogs.map((log) => (
                  <li key={log.id} className="flex flex-wrap gap-x-3">
                    <span className="w-44 shrink-0 text-zinc-500">{formatDateTime(log.createdAt)}</span>
                    <span>
                      <span className="font-medium">{log.statusField}</span>: {log.fromStatus ?? "(baru)"} ke{" "}
                      <span className="font-medium">{log.toStatus}</span>
                    </span>
                    <span className="font-mono text-xs text-zinc-400">{log.source}</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
