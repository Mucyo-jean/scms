import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState } from '../components/ui';

export default function NotFound() {
  return (
    <div className="auth-page">
      <EmptyState icon={Compass} title="Page not found">
        <p>The page you're looking for doesn't exist.</p>
        <Link to="/" className="btn btn-primary">Back to home</Link>
      </EmptyState>
    </div>
  );
}
