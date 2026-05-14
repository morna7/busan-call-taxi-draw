export function getAdminRedirect(pathname: string, hasUser: boolean): {
  pathname: string;
  next?: string;
} | null {
  const isAdminPath = pathname.startsWith("/admin");
  const isLoginPage = pathname === "/admin/login";

  if (isAdminPath && !isLoginPage && !hasUser) {
    return { pathname: "/admin/login", next: pathname };
  }

  if (isLoginPage && hasUser) {
    return { pathname: "/admin" };
  }

  return null;
}
