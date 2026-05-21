<template>
  <q-page class="flex flex-center bg-grey-1">
    <q-card class="q-pa-lg rounded-card" style="width: 360px">
      <div class="text-h6 q-mb-md text-center">Login</div>
      <q-input filled v-model="email" label="Email" class="q-mb-sm" />
      <q-input
        filled
        v-model="pw"
        label="Passwort"
        type="password"
        class="q-mb-md"
      />
      <q-btn
        color="primary"
        label="Login"
        class="full-width q-mb-sm"
        unelevated
        @click="onLogin"
      />
      <q-btn
        flat
        dense
        label="Passwort vergessen?"
        class="full-width text-caption"
        @click="onResetPassword"
      />
    </q-card>
  </q-page>
</template>

<script setup>
import { ref } from "vue";
import { login, resetPw } from "src/boot/firebase";

const email = ref("");
const pw = ref("");

async function onLogin() {
  if (!email.value || !pw.value) return;
  try {
    await login(email.value, pw.value);
  } catch (e) {
    console.error("Login failed", e);
  }
}

async function onResetPassword() {
  if (!email.value) return;
  try {
    await resetPw(email.value);
  } catch (e) {
    console.error("Reset failed", e);
  }
}
</script>
