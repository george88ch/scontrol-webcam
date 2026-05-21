// boot/auth.js
import { useAuth } from "../composables/useAuth";

export default async ({ router }) => {
  const { initAuth, isAuthenticated, userRole } = useAuth();

  await initAuth();

  router.beforeEach((to, from, next) => {
    if (!to.meta.requiresAuth) return next();
    if (!isAuthenticated.value) {
      return next({ name: "login", query: { redirect: to.fullPath } });
    }
    if (to.meta.requiredRole && to.meta.requiredRole !== userRole.value) {
      return next({ name: "unauthorized" });
    }
    next();
  });
};
