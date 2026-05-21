<template>
  <q-layout view="lHh Lpr lFf">
    <q-header bordered class="bg-white text-dark">
      <q-toolbar class="q-px-md">
        <q-btn
          flat
          dense
          round
          icon="menu"
          @click="drawer = !drawer"
          class="q-mr-sm"
        />
        <div class="text-h6">BECC Framework</div>
        <q-space />
        <q-btn v-if="!isAuthenticated" to="/login">Login/Register</q-btn>
      </q-toolbar>
      <ProfileComp />
    </q-header>

    <q-drawer v-model="drawer" side="left" bordered>
      <DrawerMenu />
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>

    <q-footer bordered class="bg-white text-dark">
      <div class="row items-center justify-between">
        <div>BECC Framework Starter</div>
        <div class="text-caption">&copy;george88ch@gmail.com</div>
      </div>
    </q-footer>
  </q-layout>
</template>

<script setup>
import { useAuth } from "src/composables/useAuth";
import ProfileComp from "src/components/ProfileComp.vue";
import { ref } from "vue";
import DrawerMenu from "src/components/DrawerMenu.vue";

const { isAuthenticated } = useAuth();

const drawer = ref(false);
</script>
