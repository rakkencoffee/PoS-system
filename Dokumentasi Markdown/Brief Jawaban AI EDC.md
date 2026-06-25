Sekarang saya punya gambaran lengkap. Ada beberapa hal yang perlu diluruskan dari jawaban AI sebelumnya karena konteks Indonesia sangat berbeda. Mari saya jelaskan secara menyeluruh.

---

## 🚨 Koreksi Mendasar: Konteks Indonesia yang Diabaikan AI Sebelumnya

Mesin EDC BRI Android Verifone X990 yang beredar di Indonesia dikelola sepenuhnya oleh bank acquirer (BRI, BCA, BNI, Mandiri) yang meng-install aplikasi pembayaran mereka ke terminal tersebut. EDC BRI Merchant hanya bisa digunakan untuk melakukan pembayaran saja.

Dari label belakang device Anda, terlihat jelas: **P/N: M550-104-22-IDC-6** — kode `IDC` mengindikasikan ini adalah varian untuk kawasan Indonesia/Southeast Asia, bukan unit ISV global. Device ini kemungkinan besar issued oleh BRI (yang paling banyak pakai X990 di Indonesia) atau bank lain.

**AI sebelumnya salah kaprah** karena mencampurkan dua dunia yang berbeda total:
- **Jalur A (WebView Wrapper)** dan **Jalur B (Verifone Cloud)** = untuk **ISV global** yang membangun payment app mereka sendiri di atas hardware X990 kosongan
- **X990 bank-issued Indonesia** = device sudah dikunci oleh bank, tidak bisa disentuh via Verifone SDK oleh merchant biasa

---

## 3 Jalur Nyata untuk Coffee Shop di Indonesia---

## 🛠️ Implementasi Konkret — Jalur 1 (Yang Langsung Bisa Dikerjakan)

Ini yang perlu Anda tambahkan ke kode yang sudah ada. Berdasarkan dokumen implementation plan yang Anda paste, sebagian besar kerangka sudah ada — tinggal disambungkan dengan benar.

### 1. Update UI Checkout — Tambah Tab Pemilihan Metode Bayar

```tsx
// src/app/(kiosk)/checkout/page.tsx
// Tambahkan state untuk EDC flow
type PaymentMethod = 'online' | 'edc_card' | 'edc_qris';
type EDCFlowStep = 'idle' | 'waiting_edc' | 'confirm_approval' | 'done';

// UI: kasir lihat ini setelah pilih "Bayar Kartu EDC"
function EDCPaymentFlow({ total, onConfirm, onCancel }: {
  total: number;
  onConfirm: (approvalCode: string) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<EDCFlowStep>('waiting_edc');
  const [approvalCode, setApprovalCode] = useState('');

  return (
    <div className="flex flex-col items-center gap-6 p-6">
      {step === 'waiting_edc' && (
        <>
          {/* Instruksi kasir — display jelas di tablet */}
          <div className="text-center space-y-2">
            <div className="text-4xl">💳</div>
            <h2 className="text-xl font-semibold">Proses di Mesin EDC</h2>
            <p className="text-muted-foreground">
              Input nominal <strong>Rp {total.toLocaleString('id-ID')}</strong>
              <br />di mesin EDC, lalu minta pelanggan tap/swipe kartu
            </p>
          </div>

          {/* Countdown atau spinner menunggu */}
          <div className="w-full max-w-xs space-y-3">
            <Button
              className="w-full"
              onClick={() => setStep('confirm_approval')}
            >
              EDC Approved — Masukkan Kode
            </Button>
            <Button variant="outline" className="w-full" onClick={onCancel}>
              EDC Gagal / Batalkan
            </Button>
          </div>
        </>
      )}

      {step === 'confirm_approval' && (
        <>
          <h2 className="text-xl font-semibold">Masukkan Kode Approval</h2>
          <p className="text-sm text-muted-foreground text-center">
            Lihat struk EDC — masukkan kode approval yang tertera
          </p>
          <Input
            placeholder="Contoh: 123456"
            value={approvalCode}
            onChange={e => setApprovalCode(e.target.value.toUpperCase())}
            maxLength={8}
            className="text-center text-xl tracking-widest font-mono w-40"
            autoFocus
          />
          <Button
            className="w-full max-w-xs"
            disabled={approvalCode.length < 4}
            onClick={() => onConfirm(approvalCode)}
          >
            Konfirmasi Pembayaran
          </Button>
        </>
      )}
    </div>
  );
}
```

### 2. Handler di Checkout — Alur EDC Card

```tsx
// src/app/(kiosk)/checkout/page.tsx
async function handleCheckoutEDC(approvalCode: string) {
  setIsLoading(true);

  try {
    // 1. Buat order dulu
    const orderId = await generateOrderId(stationId);

    const orderRes = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stationId,
        items: cartItems,
        total: cartTotal,
        paymentMethod: 'CARD',
        approvalCode,      // dari input kasir
        edcType: 'VERIFONE_X990',
      }),
    });

    const order = await orderRes.json();
    if (!order.success) throw new Error(order.error);

    // 2. Print struk dari Print Bridge (Print Bridge lokal, bukan EDC)
    // EDC sudah print struk sendiri — ini print struk tambahan dari POS
    await printReceipt({
      orderId: order.data.id,
      items: cartItems,
      total: cartTotal,
      paymentMethod: 'KARTU DEBIT/KREDIT',
      approvalCode,
      cashierName: session?.user?.name ?? 'Kasir',
      timestamp: new Date().toISOString(),
    });

    // 3. Redirect ke success page
    router.push(
      `/success?orderId=${order.data.id}&method=edc&approvalCode=${approvalCode}`
    );
  } catch (err) {
    toast.error('Gagal memproses order. Coba lagi.');
    setIsLoading(false);
  }
}
```

### 3. Update API Route `/api/orders` — Terima Approval Code

```typescript
// app/api/orders/route.ts — tambahkan field ke schema Zod
const CreateOrderSchema = z.object({
  stationId: z.enum(['A', 'B', 'C']),
  items: z.array(OrderItemSchema).min(1),
  tableNumber: z.string().optional(),
  offline: z.boolean().default(false),
  // Fields baru untuk EDC:
  paymentMethod: z.enum(['CASH', 'CARD', 'QRIS', 'TRANSFER']).default('CASH'),
  approvalCode: z.string().max(8).optional(),  // dari struk EDC
  edcType: z.literal('VERIFONE_X990').optional(),
  cashReceived: z.number().int().positive().optional(),
});

// Di dalam handler, simpan approval code ke Order
const order = await prisma.$transaction(async (tx) => {
  // ... existing lock & stock deduction ...
  return tx.order.create({
    data: {
      id: orderId,
      stationId,
      cashierId: session.user.id,
      total,
      status: 'PAID',  // Langsung PAID untuk EDC — tidak ada pending bayar
      paymentMethod: parsed.data.paymentMethod,
      edcTransactionId: parsed.data.approvalCode, // simpan approval code
      items: { create: mappedItems },
    },
    include: { items: true }
  });
});
```

### 4. Update Prisma Schema — Tambah Field EDC

```prisma
// prisma/schema.prisma — Order model
model Order {
  // ... existing fields ...
  paymentMethod     String?
  edcTransactionId  String?   // Approval code dari struk EDC (untuk CARD)
  edcDeviceType     String?   // "VERIFONE_X990" untuk tracking
  cashReceived      Int?
  changeAmount      Int?
  // ... rest of fields ...
}
```

### 5. Update Print Bridge — Struk Mencantumkan Info Kartu

```typescript
// print-bridge/src/index.ts — update receipt untuk payment CARD
if (data.paymentMethod === 'KARTU DEBIT/KREDIT') {
  printer.drawLine();
  printer.alignLeft();
  printer.println(`Metode  : ${data.paymentMethod}`);
  if (data.approvalCode) {
    printer.println(`Approval: ${data.approvalCode}`);
  }
  printer.println('* Struk EDC adalah bukti sah transaksi');
}
```

---

## ❓ 4 Pertanyaan Wajib Dijawab (Versi yang Tepat)

Pertanyaan dari AI sebelumnya sudah cukup baik, tapi framing-nya perlu dikoreksi:

| Pertanyaan | Kenapa Penting |
|---|---|
| **Bank acquirer mana yang issued X990 ini?** (BRI/BCA/BNI/Mandiri) | Menentukan apakah ada bank API yang bisa dipakai untuk QRIS |
| **Apakah EDC sudah aktif dan bisa terima pembayaran sekarang?** | Jika ya → Jalur 1 bisa langsung jalan tanpa coding |
| **Apakah Anda sudah punya Merchant ID (MID) dari bank?** | Diperlukan jika ingin Jalur 2 (QRIS Dynamic API) |
| **Skenario fisik: X990 di meja kasir yang sama dengan tablet POS, atau terpisah?** | Menentukan apakah kasir bisa mudah lihat layar EDC saat konfirmasi approval code |

---

## ✅ Langkah Konkret yang Bisa Dikerjakan Sekarang

**Tanpa perlu jawab pertanyaan apapun**, Jalur 1 bisa langsung dikerjakan:

1. Update UI checkout — tambah tab/tombol "Bayar Kartu EDC" di samping "Bayar Online"
2. Implementasikan `EDCPaymentFlow` component di atas
3. Update `handleCheckoutEDC` handler dengan input approval code
4. Update Prisma schema — tambah `edcTransactionId` dan `edcDeviceType`
5. Jalankan `npx prisma migrate dev`
6. Test: buat order dummy, pilih EDC, input dummy approval code `TEST01`, konfirmasi

Setelah kasir terbiasa dengan flow ini di lapangan, **baru** pertimbangkan upgrade ke QRIS Dynamic API (Jalur 2) jika traffic QRIS tinggi dan kasir keberatan scan manual.

> **Catatan penting tentang PLAN.MD**: Bagian `print-bridge/src/edc.ts` yang sebelumnya menggunakan koneksi TCP langsung ke EDC (`net.Socket`) perlu **dihapus** — pendekatan itu tidak berlaku untuk bank-issued EDC di Indonesia. Gantinya adalah flow konfirmasi manual yang dijelaskan di atas.