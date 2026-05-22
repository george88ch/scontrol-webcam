<template>
  <q-page padding class="q-pa-md row justify-center">
    <div class="col-12 col-md-6">
      <q-card flat bordered class="q-pa-md q-mb-md">
        <div class="text-h6 q-mb-md">Avatar</div>

        <q-avatar size="96px" class="q-mb-md">
          <img v-if="profile.avatarUrl" :src="profile.avatarUrl" />
          <q-icon v-else name="person" size="48px" />
        </q-avatar>

        <q-uploader
          label="Upload avatar (JPG/PNG)"
          accept=".jpg,.jpeg,.png"
          max-file-size="2000000"
          :auto-upload="false"
          @added="uploadAvatar"
        />
      </q-card>

      <q-card flat bordered class="q-pa-md">
        <q-form @submit.prevent="onSave">
          <q-input
            v-model="profile.firstName"
            label="First name"
            dense
            outlined
            class="q-mb-md"
          />
          <q-input
            v-model="profile.lastName"
            label="Last name"
            dense
            outlined
            class="q-mb-md"
          />
          <q-input
            v-model="profile.displayName"
            label="Display name"
            dense
            outlined
            class="q-mb-md"
          />
          <q-input
            v-model="profile.phone"
            label="Phone"
            dense
            outlined
            class="q-mb-md"
          />
          <q-input
            v-model="profile.bio"
            label="Bio"
            type="textarea"
            dense
            outlined
            autogrow
            class="q-mb-md"
          />
          <q-toggle
            v-model="profile.newsletterOptIn"
            label="Newsletter opt-in"
            class="q-mb-md"
          />

          <div class="row justify-end">
            <q-btn
              :loading="saving"
              :disable="saving"
              type="submit"
              label="Save"
              color="primary"
              unelevated
              icon="save"
            />
          </div>
        </q-form>
      </q-card>
    </div>
  </q-page>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { Notify } from "quasar";
import { auth, read, upload, write } from "src/boot/firebase";

const saving = ref(false);
const profile = ref(createEmptyProfile());

function createEmptyProfile() {
  return {
    firstName: "",
    lastName: "",
    displayName: "",
    phone: "",
    bio: "",
    newsletterOptIn: false,
    isPublic: false,
    role: "user",
    avatarUrl: "",
    estimCalibration: {},
  };
}

async function loadProfile() {
  const uid = auth.currentUser?.uid;
  if (!uid) return;

  try {
    const docData = await read(`users/${uid}`);
    profile.value = { ...createEmptyProfile(), ...(docData?.profile || {}) };
  } catch (error) {
    console.error("Failed to load profile:", error);
    Notify.create({
      type: "negative",
      message: "Profile could not be loaded.",
    });
  }
}

async function uploadAvatar(files) {
  const uid = auth.currentUser?.uid;
  const file = files[0];

  if (!uid || !file) return;

  const ext = file.name.split(".").pop().toLowerCase();
  const path = `users/${uid}/avatar_${uid}.${ext}`;

  try {
    const url = await upload(path, file);
    profile.value.avatarUrl = url;

    await write(`users/${uid}`, { profile: profile.value });

    Notify.create({ type: "positive", message: "Avatar saved." });
  } catch (error) {
    console.error("Avatar upload failed:", error);
    Notify.create({
      type: "negative",
      message: "Avatar upload failed.",
    });
  }
}

async function onSave() {
  const uid = auth.currentUser?.uid;
  if (!uid) return;

  saving.value = true;
  try {
    await write(`users/${uid}`, { profile: profile.value });
    Notify.create({ type: "positive", message: "Profile saved." });
  } catch (error) {
    console.error("Profile save failed:", error);
    Notify.create({ type: "negative", message: "Save failed." });
  } finally {
    saving.value = false;
  }
}

onMounted(loadProfile);
</script>

<style scoped>
img {
  object-fit: cover;
}
</style>
