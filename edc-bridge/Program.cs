using System.Windows.Forms;
using EdcBridge;

// Usage: EdcBridge.exe                              (daemon — polls Vercel forever)
//        EdcBridge.exe daemon                        (same, explicit)
//        EdcBridge.exe <amount_in_rupiah>            (one-shot manual test — card Purchase)
//        EdcBridge.exe qris <amount_in_rupiah>        (one-shot manual test — QRIS Generate)
//        EdcBridge.exe qris-inquiry                   (one-shot manual test — QRIS Inquiry Last Trans,
//                                                       call after qris to check if the customer paid)
//        EdcBridge.exe last-transaction                (one-shot manual test — Resend Last Transaction,
//                                                       call after a card Purchase that timed out to see
//                                                       if the real APPROVED/DECLINED result is retrievable)
//
// Why a hidden WinForms host: POS4CAT_Ctl.dll drives its request/COMStatus state machine
// with Win32 SetTimer/WM_TIMER (confirmed via catlog — POS4EDC_Test.exe, a WinForms app
// with an always-running message pump, always logs TIMER_COMM_START right after COMCreate;
// a plain console Main() never did, across 7 runs, even with [STAThread]). Windows delivers
// WM_TIMER only to the thread that owns the timer's window, via that thread's own
// GetMessage/PeekMessage loop — so every EDC call must run ON the same thread that is
// actively pumping messages, not just any STA thread. Running them from a hidden Form's
// Shown handler (dispatched by Application.Run()'s loop) satisfies that, for both the
// one-shot test calls and the daemon's repeated polling calls.
internal static class Program
{
    [STAThread]
    private static int Main(string[] args)
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);

        var isDaemon = args.Length == 0 || args[0].Equals("daemon", StringComparison.OrdinalIgnoreCase);
        return isDaemon ? RunDaemon() : RunOneShotTest(args);
    }

    private static int RunDaemon()
    {
        DaemonConfig config;
        try
        {
            config = DaemonConfig.Load();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[EdcDaemon] Config error: {ex.Message}");
            return 1;
        }

        using var cts = new CancellationTokenSource();
        Console.CancelKeyPress += (_, e) =>
        {
            Console.WriteLine("[EdcDaemon] Stop requested...");
            e.Cancel = true;
            cts.Cancel();
        };

        using var hiddenForm = CreateHiddenForm();
        using var dialogCloser = config.AutoCloseDialogs ? new DialogAutoCloser(hiddenForm) : null;
        hiddenForm.Shown += async (_, _) =>
        {
            var daemon = new EdcDaemon(config, new EdcClient());
            await daemon.RunAsync(cts.Token);
            Application.Exit();
        };

        Application.Run(hiddenForm);
        return 0;
    }

    private static int RunOneShotTest(string[] args)
    {
        var isQris = args[0].Equals("qris", StringComparison.OrdinalIgnoreCase);
        var isQrisInquiry = args[0].Equals("qris-inquiry", StringComparison.OrdinalIgnoreCase);
        var isLastTransaction = args[0].Equals("last-transaction", StringComparison.OrdinalIgnoreCase);
        var isEcho = args[0].Equals("echo", StringComparison.OrdinalIgnoreCase);
        var isVoid = args[0].Equals("void", StringComparison.OrdinalIgnoreCase);
        var isRefund = args[0].Equals("refund", StringComparison.OrdinalIgnoreCase);
        var isRefundQris = args[0].Equals("refund-qris", StringComparison.OrdinalIgnoreCase);
        // qris-inquiry-any (POS4EDC_QRISInqAnyTrans) is deliberately NOT wired up here --
        // confirmed live 2026-09-10 to crash the whole process with a native access
        // violation. See the DANGER comment on Pos4CatNative.POS4EDC_QRISInqAnyTrans.
        var needsNoAmount = isQrisInquiry || isLastTransaction || isEcho;
        var needsStringArg = isVoid || isRefund || isRefundQris;

        int amount = 0;
        string? stringArg = null;
        if (needsStringArg)
        {
            stringArg = args.ElementAtOrDefault(1);
            if (string.IsNullOrWhiteSpace(stringArg))
            {
                Console.WriteLine("Usage: EdcBridge.exe void <trace_number>       (Purchase Void test, trace number from a prior test's own output)");
                Console.WriteLine("       EdcBridge.exe refund <amount_in_rupiah> (Refund test)");
                Console.WriteLine("       EdcBridge.exe refund-qris <reff_no>     (QRIS Refund test, reff number from a prior QRIS test's own output)");
                return 1;
            }
        }
        else if (!needsNoAmount)
        {
            var amountArg = isQris ? args.ElementAtOrDefault(1) : args.ElementAtOrDefault(0);
            if (amountArg is null || !int.TryParse(amountArg, out amount) || amount <= 0)
            {
                Console.WriteLine("Usage: EdcBridge.exe                          (daemon)");
                Console.WriteLine("       EdcBridge.exe <amount_in_rupiah>       (card Purchase test)");
                Console.WriteLine("       EdcBridge.exe qris <amount_in_rupiah>  (QRIS Generate test)");
                Console.WriteLine("       EdcBridge.exe qris-inquiry             (QRIS Inquiry Last Trans test)");
                Console.WriteLine("       EdcBridge.exe last-transaction         (Resend Last Transaction test)");
                Console.WriteLine("       EdcBridge.exe echo                     (Echo Test -- no money involved)");
                Console.WriteLine("       EdcBridge.exe void <trace_number>      (Purchase Void test)");
                Console.WriteLine("       EdcBridge.exe refund <amount_in_rupiah> (Refund test)");
                Console.WriteLine("       EdcBridge.exe refund-qris <reff_no>    (QRIS Refund test)");
                return 1;
            }
        }

        EdcResult? cardResult = null;
        EdcQrisResult? qrisResult = null;
        EdcSimpleResult? simpleResult = null;

        using var hiddenForm = CreateHiddenForm();
        // No DialogAutoCloser here (unlike the daemon) -- one-shot manual tests are
        // for developer debugging, so every native dialog stays fully visible and
        // un-clicked. This matters especially for QRIS right now: the "safe to
        // auto-click" finding for "Initialize EDC communicate" was only ever
        // validated against the Purchase (card) flow, never QRIS -- if that click
        // fires at the wrong point in QRIS's own state machine it could be exactly
        // what's corrupting the QR render, the same way clicking "Please check EDC
        // display" once broke real card transactions.
        hiddenForm.Shown += (_, _) =>
        {
            var client = new EdcClient();
            if (isVoid)
            {
                Console.WriteLine($"Void transaksi trace={stringArg}...");
                simpleResult = client.Void(stringArg!);
            }
            else if (isRefund)
            {
                Console.WriteLine($"Refund amount={stringArg}...");
                simpleResult = client.Refund(stringArg!);
            }
            else if (isRefundQris)
            {
                Console.WriteLine($"QRIS Refund reff={stringArg}...");
                qrisResult = client.RefundQris(stringArg!);
            }
            else if (isEcho)
            {
                Console.WriteLine("Mengirim Echo Test ke EDC (tanpa nominal, tanpa efek finansial)...");
                simpleResult = client.EchoTest();
            }
            else if (isLastTransaction)
            {
                Console.WriteLine("Mengambil ulang hasil transaksi terakhir (Resend Last Transaction)...");
                cardResult = client.GetLastTransaction();
            }
            else if (isQrisInquiry)
            {
                Console.WriteLine("Mengecek status transaksi QRIS terakhir...");
                qrisResult = client.InquiryQrisLastTransaction();
            }
            else if (isQris)
            {
                Console.WriteLine($"Generate QRIS amount={amount} di EDC...");
                Console.WriteLine("(cek layar EDC — minta pelanggan scan QR pakai e-wallet/m-banking)");
                qrisResult = client.GenerateQris(amount.ToString());
            }
            else
            {
                Console.WriteLine($"Mengirim Purchase amount={amount} ke EDC...");
                Console.WriteLine("(cek layar EDC — minta pelanggan tap/insert/swipe kartu)");
                cardResult = client.Purchase(amount.ToString());
            }

            Application.Exit();
        };

        Application.Run(hiddenForm);

        Console.WriteLine();
        if (isEcho || isVoid || isRefund) return PrintSimpleResult(simpleResult);
        return isQris || isQrisInquiry || isRefundQris ? PrintQrisResult(qrisResult) : PrintCardResult(cardResult);
    }

    private static Form CreateHiddenForm() => new()
    {
        ShowInTaskbar = false,
        WindowState = FormWindowState.Minimized,
        Opacity = 0,
        FormBorderStyle = FormBorderStyle.None,
        StartPosition = FormStartPosition.Manual,
        Location = new System.Drawing.Point(-2000, -2000),
        Size = new System.Drawing.Size(1, 1),
    };

    private static int PrintCardResult(EdcResult? result)
    {
        if (result is null)
        {
            Console.WriteLine("=== TIDAK ADA HASIL (unexpected) ===");
            return 1;
        }

        if (result.Approved)
        {
            Console.WriteLine("=== APPROVED ===");
            Console.WriteLine($"ApprovalCode : {result.ApprovalCode}");
            Console.WriteLine($"TraceNumber  : {result.TraceNumber}");
            Console.WriteLine($"CardType     : {result.CardType}");
            Console.WriteLine($"PAN          : {result.Pan}");
            Console.WriteLine($"TotalAmount  : {result.TotalAmount}");
            Console.WriteLine($"Date/Time    : {result.TransactionDate} {result.TransactionTime}");
        }
        else
        {
            Console.WriteLine("=== GAGAL / DITOLAK ===");
            Console.WriteLine($"ResponseCode : {result.ResponseCode}");
            Console.WriteLine($"Error        : {result.ErrorMessage}");
        }

        Console.WriteLine();
        Console.WriteLine($"Raw response data: {result.RawResponseData}");
        return result.Approved ? 0 : 1;
    }

    private static int PrintSimpleResult(EdcSimpleResult? result)
    {
        if (result is null)
        {
            Console.WriteLine("=== TIDAK ADA HASIL (unexpected) ===");
            return 1;
        }

        Console.WriteLine(result.Approved ? "=== SUCCESS ===" : "=== GAGAL / DITOLAK ===");
        Console.WriteLine($"ResponseCode : {result.ResponseCode}");
        if (result.ErrorMessage is not null) Console.WriteLine($"Error        : {result.ErrorMessage}");
        Console.WriteLine();
        Console.WriteLine($"Raw response data: {result.RawResponseData}");
        return result.Approved ? 0 : 1;
    }

    private static int PrintQrisResult(EdcQrisResult? result)
    {
        if (result is null)
        {
            Console.WriteLine("=== TIDAK ADA HASIL (unexpected) ===");
            return 1;
        }

        if (result.Approved)
        {
            Console.WriteLine("=== APPROVED (QRIS) ===");
            Console.WriteLine($"StatusTransaksi : {result.StatusTransaksi}");
            Console.WriteLine($"ReferenceNumber : {result.ReferenceNumber}");
            Console.WriteLine($"ReferenceId     : {result.ReferenceId}");
            Console.WriteLine($"CustomerName    : {result.CustomerName}");
            Console.WriteLine($"SaleAmount      : {result.SaleAmount}");
            Console.WriteLine($"TIP             : {result.Tip}");
            Console.WriteLine($"TotalAmount     : {result.TotalAmount}");
            Console.WriteLine($"Date/Time       : {result.TransactionDate} {result.TransactionTime}");
        }
        else
        {
            Console.WriteLine("=== GAGAL / DITOLAK (QRIS) ===");
            Console.WriteLine($"ResponseCode : {result.ResponseCode}");
            Console.WriteLine($"Error        : {result.ErrorMessage}");
        }

        Console.WriteLine();
        Console.WriteLine($"Raw response data: {result.RawResponseData}");
        return result.Approved ? 0 : 1;
    }
}
