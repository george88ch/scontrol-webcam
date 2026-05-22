<script setup>
import { computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useAuth } from "src/composables/useAuth";

const router = useRouter();
const route = useRoute();
const { isAuthenticated, userRole, logout } = useAuth();

const menuItems = computed(() => {
  const allRoutes = router.getRoutes();

  return allRoutes
    .filter((r) => r.meta?.menu)
    .filter((r) => {
      // Hide when authenticated
      if (r.meta.hideWhenAuth && isAuthenticated.value) return false;

      // Show only when authenticated
      if (r.meta.requiresAuth && !isAuthenticated.value) return false;

      // Role check
      if (r.meta.requiredRole) {
        const roles = Array.isArray(r.meta.requiredRole)
          ? r.meta.requiredRole
          : [r.meta.requiredRole];
        if (!roles.includes(userRole.value)) return false;
      }

      return true;
    })
    .map((r) => ({
      path: r.path,
      name: r.name,
      label: r.meta.label || r.name,
      icon: r.meta.icon || "circle",
      order: r.meta.order ?? 99,
    }))
    .sort((a, b) => a.order - b.order);
});

function isActive(path) {
  return route.path === path;
}

async function handleLogout() {
  await logout();
}
</script>

<template>
  <q-list>
    <q-item
      v-for="item in menuItems"
      :key="item.path"
      :to="item.path"
      clickable
      :active="isActive(item.path)"
      active-class="bg-primary text-white"
    >
      <q-item-section avatar>
        <q-icon :name="item.icon" />
      </q-item-section>
      <q-item-section>
        {{ item.label }}
      </q-item-section>
    </q-item>

    <template v-if="isAuthenticated">
      <q-separator spaced />
      <q-item clickable @click="handleLogout">
        <q-item-section avatar>
          <q-icon name="logout" />
        </q-item-section>
        <q-item-section> Sign out </q-item-section>
      </q-item>
    </template>
  </q-list>
</template>
