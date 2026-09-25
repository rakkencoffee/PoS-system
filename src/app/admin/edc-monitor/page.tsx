import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { edcStatusBadge, formatDateTime, formatRupiah } from "./format";

const ALLOWED_ROLES = ["ADMIN", "MANAGER"];

// An order counts as "stuck" once it's had enough time for the daemon to
// realistically have finished (approved, rejected, or timed out) -- anything
// younger than this is probably just a customer mid-payment right now, not a
// lost order yet.
const STUCK_AFTER_MS = 10 * 60 * 1000;

function startOfTodayWIB(): Date {
  const wibOffsetMs = 7 * 60 * 60 * 1000;
  const wibNow = new Date(Date.now() + wibOffsetMs);
  const wibMidnightAsUTC = Date.UTC(wibNow.getUTCFullYear(), wibNow.getUTCMonth(), wibNow.getUTCDate());
  return new Date(wibMidnightAsUTC - wibOffsetMs);
}

async function getStuckOrders() {
  const cutoff = new Date(Date.now() - STUCK_AFTER_MS);

  const stuckPending = await prisma.order.findMany({
    where: {
      status: "PENDING",
      createdAt: { lt: cutoff },
      edcJobs: { some: {} },
    },
    include: { edcJobs: { orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const cancelledAmbiguous = await prisma.order.findMany({
    where: {
      status: "CANCELLED",
      edcJobs: { some: { status: { in: ["APPROVED", "PROCESSING", "PENDING"] } } },
    },
    include: { edcJobs: { orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const cancelledToday = await prisma.order.findMany({
    where: { status: "CANCELLED", createdAt: { gte: startOfTodayWIB() } },
    select: { id: true, queueNumber: true, customerName: true, total: true, createdAt: true },
    orderBy: { queueNumber: "asc" },
  });

  return { stuckPending, cancelledAmbiguous, cancelledToday };
}

type StuckOrder = Awaited<ReturnType<typeof getStuckOrders>>["stuckPending"][number];

function OrderRow({ order }: { order: StuckOrder }) {
  const latestJob = order.edcJobs[0];
  return (
    <TableRow>
      <TableCell className="font-mono text-xs">#{order.queueNumber ?? "-"}</TableCell>
      <TableCell>{order.customerName || <span className="text-zinc-400">(tanpa nama)</span>}</TableCell>
      <TableCell>{formatRupiah(order.total)}</TableCell>
      <TableCell>{latestJob?.method}</TableCell>
      <TableCell>{latestJob ? edcStatusBadge(latestJob.status) : "-"}</TableCell>
      <TableCell className="max-w-[220px] truncate text-xs text-zinc-500" title={latestJob?.errorMessage ?? ""}>
        {latestJob?.errorMessage || "-"}
      </TableCell>
      <TableCell className="text-xs text-zinc-500">{formatDateTime(order.createdAt)}</TableCell>
      <TableCell className="font-mono text-xs text-zinc-400">{order.id}</TableCell>
      <TableCell>
        <Link
          href={`/admin/edc-monitor/${encodeURIComponent(order.id)}`}
          className="inline-flex h-8 items-center rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium hover:bg-zinc-50"
        >
          Detail
        </Link>
      </TableCell>
    </TableRow>
  );
}

function StuckOrdersTable({ orders, emptyLabel }: { orders: StuckOrder[]; emptyLabel: string }) {
  if (orders.length === 0) {
    return <p className="py-8 text-center text-sm text-zinc-500">{emptyLabel}</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Antrian</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>Metode</TableHead>
          <TableHead>Status EDC</TableHead>
          <TableHead>Error</TableHead>
          <TableHead>Dibuat</TableHead>
          <TableHead>Order ID</TableHead>
          <TableHead>
            <span className="sr-only">Aksi</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <OrderRow key={order.id} order={order} />
        ))}
      </TableBody>
    </Table>
  );
}

export default async function EdcMonitorPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || !role || !ALLOWED_ROLES.includes(role)) {
    redirect("/admin/login?callbackUrl=/admin/edc-monitor");
  }

  const { stuckPending, cancelledAmbiguous, cancelledToday } = await getStuckOrders();
  const approvedButCancelled = cancelledAmbiguous.filter((o) => o.edcJobs[0]?.status === "APPROVED");

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8 text-zinc-900 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Monitor Order Nyangkut (EDC)</h1>
          <p className="text-sm text-zinc-500">
            Order yang pembayarannya sempat diproses lewat EDC tapi nggak pernah beres jadi PAID atau CANCELLED
            dengan bersih. Cek struk fisik EDC buat mastiin uangnya beneran masuk sebelum diselesaikan manual.
          </p>
        </div>

        {approvedButCancelled.length > 0 && (
          <Card className="border-red-300 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-700">
                {approvedButCancelled.length} order dibatalkan padahal EDC-nya APPROVED
              </CardTitle>
              <CardDescription className="text-red-700/80">
                Ini paling kritis — kemungkinan besar customer udah kebayar tapi order-nya ke-void. Cek dulu sebelum
                yang lain.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Order Nyangkut di PENDING ({stuckPending.length})</CardTitle>
            <CardDescription>
              Status order masih PENDING lebih dari 10 menit, padahal ada percobaan bayar EDC — nggak pernah
              di-cancel maupun di-mark paid.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StuckOrdersTable orders={stuckPending} emptyLabel="Nggak ada order yang nyangkut di PENDING." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Order Dibatalkan tapi Status EDC Ambigu ({cancelledAmbiguous.length})</CardTitle>
            <CardDescription>
              Order-nya udah CANCELLED, tapi job EDC terakhirnya APPROVED/PROCESSING/PENDING — bukan FAILED/REJECTED
              yang bersih.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StuckOrdersTable orders={cancelledAmbiguous} emptyLabel="Nggak ada order CANCELLED yang ambigu." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nomor Antrian Batal Hari Ini ({cancelledToday.length})</CardTitle>
            <CardDescription>
              Pembayarannya dibatalkan atau gagal, jadi nomor ini sengaja nggak muncul di KDS. Wajar kalau customer
              mundur dari pembayaran. Kalau ada yang ngaku udah bayar, cek di tabel di atas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {cancelledToday.length === 0 ? (
              <p className="py-4 text-center text-sm text-zinc-500">Belum ada nomor antrian yang batal hari ini.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {cancelledToday.map((o) => (
                  <li
                    key={o.id}
                    title={`${formatRupiah(o.total)} · ${formatDateTime(o.createdAt)}`}
                    className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-sm"
                  >
                    <span className="font-mono font-semibold">#{String(o.queueNumber ?? 0).padStart(3, "0")}</span>
                    {o.customerName && <span className="ml-1.5 text-zinc-600">{o.customerName}</span>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
