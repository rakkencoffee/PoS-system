export default function KDSLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen relative"
      style={{
        backgroundImage: "url('/images/bg.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="fixed inset-0 bg-black/50 pointer-events-none" aria-hidden="true" />
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
