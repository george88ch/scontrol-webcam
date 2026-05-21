<template>
  <div v-if="isAuthenticated" class="row items-center justify-between q-pa-md">
    <div class="row q-gutter-sm">
      <q-avatar size="32px" class="q-mb-md">
        <img v-if="profile.avatarUrl" :src="profile.avatarUrl" />
        <q-icon v-else name="person" size="48px" />
      </q-avatar>
      <span class="q-pa-sm">
        Willkommen, {{ profile?.displayName }} ({{ profile?.role }})
      </span>
    </div>
    <q-btn v-if="!isAuthenticated" to="/login">Login/Register</q-btn>
    <q-btn v-if="isAuthenticated" @click="onLogout">Logout</q-btn>
  </div>
</template>
<script setup>
import { useAuth } from "src/composables/useAuth";
import { useRouter } from "vue-router";
const router = useRouter();

const { profile, isAuthenticated, logout } = useAuth();

function onLogout() {
  logout();
  router.push("/");
}
</script>
