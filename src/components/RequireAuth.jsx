import { Navigate, Outlet, useLocation } from "react-router-dom";

/**
 * Route guard that checks if a user is authenticated and optionally if they have the right role.
 *
 * Usage in route config:
 *   <Route element={<RequireAuth user={user} roles={['SHOP_OWNER']} />}>
 *     <Route path="/dashboard" element={<Dashboard />} />
 *   </Route>
 */
export function RequireAuth({ user, roles }) {
  const location = useLocation();

  // Not authenticated → redirect to login with return URL
  if (!user) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${returnTo}`} replace />;
  }

  // Role check (if specified)
  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    // Logged in but wrong role → redirect to their default home
    const home = getDefaultRoute(user.role);
    return <Navigate to={home} replace />;
  }

  return <Outlet />;
}

/** Get the default landing page for a given role */
export function getDefaultRoute(role) {
  if (role === "SHOP_OWNER") return "/dashboard";
  if (role === "PLATFORM_ADMIN") return "/admin";
  return "/marketplace";
}
