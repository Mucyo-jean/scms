import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { homeFor, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Verify from './pages/Verify';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import NotFound from './pages/NotFound';
import StudentDashboard from './pages/student/StudentDashboard';
import Apply from './pages/student/Apply';
import RequestDetail from './pages/student/RequestDetail';
import Payment from './pages/student/Payment';
import Certificate from './pages/student/Certificate';
import OfficerDashboard from './pages/officer/OfficerDashboard';
import Review from './pages/officer/Review';
import AdminOverview from './pages/admin/AdminOverview';
import AdminRequests from './pages/admin/AdminRequests';
import AdminUsers from './pages/admin/AdminUsers';
import AdminDepartments from './pages/admin/AdminDepartments';
import AdminAudit from './pages/admin/AdminAudit';
import { Spinner } from './components/ui';

function RequireAuth({ roles, children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user)} replace />;
  return children;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function GuestOnly({ children }) {
  const { user } = useAuth();
  return user ? <Navigate to={homeFor(user)} replace /> : children;
}

export default function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-page">
        <div className="card">
          <div className="card-body center">
            <Spinner />
            <p className="muted">Connecting to S-Clearance…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
        <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
        <Route path="/verify" element={<Verify />} />
        {/* Certificate renders outside the app shell so it prints cleanly. */}
        <Route path="/student/requests/:id/certificate" element={<RequireAuth roles={['student', 'admin']}><Certificate /></RequireAuth>} />

        <Route element={<RequireAuth><Layout /></RequireAuth>}>
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/profile" element={<Profile />} />

          <Route path="/student" element={<RequireAuth roles={['student']}><StudentDashboard /></RequireAuth>} />
          <Route path="/student/apply" element={<RequireAuth roles={['student']}><Apply /></RequireAuth>} />
          <Route path="/student/requests/:id" element={<RequireAuth roles={['student']}><RequestDetail /></RequireAuth>} />
          <Route path="/student/requests/:id/payment" element={<RequireAuth roles={['student']}><Payment /></RequireAuth>} />

          <Route path="/officer" element={<RequireAuth roles={['officer']}><OfficerDashboard /></RequireAuth>} />
          <Route path="/officer/requests/:id" element={<RequireAuth roles={['officer']}><Review /></RequireAuth>} />

          <Route path="/admin" element={<RequireAuth roles={['admin']}><AdminOverview /></RequireAuth>} />
          <Route path="/admin/requests" element={<RequireAuth roles={['admin']}><AdminRequests /></RequireAuth>} />
          <Route path="/admin/requests/:id" element={<RequireAuth roles={['admin']}><Review readOnly /></RequireAuth>} />
          <Route path="/admin/users" element={<RequireAuth roles={['admin']}><AdminUsers /></RequireAuth>} />
          <Route path="/admin/departments" element={<RequireAuth roles={['admin']}><AdminDepartments /></RequireAuth>} />
          <Route path="/admin/audit" element={<RequireAuth roles={['admin']}><AdminAudit /></RequireAuth>} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
