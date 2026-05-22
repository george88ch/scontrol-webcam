<template>
  <div v-if="isAuthenticated" class="row items-center justify-between q-pa-md">
    <div class="row q-gutter-sm">
      <q-avatar size="32px" class="q-mb-md">
        <img v-if="profile?.avatarUrl" :src="profile.avatarUrl" />
        <q-icon v-else name="person" size="48px" />
      </q-avatar>
      <span class="q-pa-sm">
        Welcome, {{ displayName }}
      </span>
    </div>
    <q-btn v-if="!isAuthenticated" to="/login">Login/Register</q-btn>
    <q-btn v-if="isAuthenticated" @click="onLogout">Logout</q-btn>
  </div>
</template>
<script setup>
import { computed } from "vue";
import { useAuth } from "src/composables/useAuth";
import { useRouter } from "vue-router";
const router = useRouter();

const { user, profile, isAuthenticated, logout } = useAuth();

const displayName = computed(() => {
  return profile.value?.displayName || user.value?.email || "User";
});

function onLogout() {
  logout();
  router.push("/");
}
</script>
