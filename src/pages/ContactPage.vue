<template>
  <q-page class="q-pa-md flex flex-center bg-grey-1">
    <q-card class="q-pa-md rounded-card" style="max-width: 600px; width: 100%">
      <div class="text-h5 q-mb-sm">Contact</div>
      <q-input filled v-model="message" label="Message" type="textarea" autogrow />
      <q-btn color="primary" label="Send" class="full-width q-mt-md" unelevated />
    </q-card>
  </q-page>
</template>

<script setup>
import { ref } from "vue";

const message = ref("");
</script>
