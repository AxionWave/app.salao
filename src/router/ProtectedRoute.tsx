import { Navigate } from 'react-router-dom';
import { authService } from '@core/services';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
    if (!authService.isAuthenticated()) {
        return <Navigate to="/login" replace />;
    }
    return <>{children}</>;
}
