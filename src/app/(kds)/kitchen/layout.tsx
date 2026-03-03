export default function KDSLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-coffee">
      {children}
    </div>
  );
}
