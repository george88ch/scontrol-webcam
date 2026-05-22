<template>
  <q-page class="flex flex-center bg-grey-1 q-pa-md">
    <q-card flat bordered class="q-pa-lg text-center" style="max-width: 420px; width: 100%">
      <q-icon name="lock" size="48px" color="grey-7" class="q-mb-md" />
      <div class="text-h5 q-mb-sm">Access denied</div>
      <p class="text-body2 text-grey-7 q-mb-lg">
        Your account does not have permission to open this page.
      </p>
      <q-btn color="primary" unelevated to="/" label="Go home" />
    </q-card>
  </q-page>
</template>
