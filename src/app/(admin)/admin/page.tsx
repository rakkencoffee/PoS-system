import { redirect } from 'next/navigation';

export default function AdminPage() {
  // Since this page is within the (admin) route group which is protected by middleware,
  // we just redirect to the dashboard. The middleware will handle authentication.
  redirect('/admin/dashboard');
}
