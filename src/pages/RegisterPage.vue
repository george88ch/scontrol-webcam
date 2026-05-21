<template>
  <q-page class="flex flex-center bg-grey-1">
    <q-card class="q-pa-lg rounded-card" style="width: 360px">
      <div class="text-h6 q-mb-md text-center">Register</div>
      <q-input filled v-model="email" label="Email" class="q-mb-sm" />
      <q-input
        filled
        v-model="pw"
        label="Passwort"
        type="password"
        class="q-mb-sm"
      />
      <q-input
        filled
        v-model="pw2"
        label="Passwort wiederholen"
        type="password"
        class="q-mb-md"
      />
      <q-btn
        color="primary"
        label="Account erstellen"
        class="full-width"
        unelevated
        @click="onRegister"
      />
    </q-card>
  </q-page>
</template>

<script setup>
import { ref } from "vue";
import { register } from "src/boot/firebase";

const email = ref("");
const pw = ref("");
const pw2 = ref("");

async function onRegister() {
  if (!email.value || !pw.value || pw.value !== pw2.value) return;
  try {
    await register(email.value, pw.value);
  } catch (e) {
    console.error("Register failed", e);
  }
}
</script>
