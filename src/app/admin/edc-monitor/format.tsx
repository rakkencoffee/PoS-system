import { Badge } from "@/components/ui/badge";

export function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(
    amount
  );
}

export function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

export function formatTime(date: Date) {
  return new Intl.DateTimeFormat("id-ID", { timeStyle: "short", timeZone: "Asia/Jakarta" }).format(date);
}

export function edcStatusBadge(status: string) {
  switch (status) {
    case "APPROVED":
      return <Badge variant="destructive">APPROVED (tapi order batal!)</Badge>;
    case "FAILED":
      return <Badge variant="warning">FAILED</Badge>;
    case "PROCESSING":
      return <Badge variant="warning">PROCESSING (macet)</Badge>;
    case "PENDING":
      return <Badge variant="secondary">PENDING (belum diambil daemon)</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
