<template>
  <q-page padding class="q-pa-md row justify-center">
    <div class="col-12 col-md-6">
      <!-- AVATAR -->
      <q-card flat bordered class="q-pa-md q-mb-md">
        <div class="text-h6 q-mb-md">Avatar</div>

        <q-avatar size="96px" class="q-mb-md">
          <img v-if="profile.avatarUrl" :src="profile.avatarUrl" />
          <q-icon v-else name="person" size="48px" />
        </q-avatar>

        <q-uploader
          label="Avatar hochladen (JPG/PNG)"
          accept=".jpg,.jpeg,.png"
          max-file-size="2000000"
          @added="uploadAvatar"
          :auto-upload="false"
        />
      </q-card>

      <!-- PROFILE FIELDS -->
      <q-card flat bordered class="q-pa-md">
        <q-form @submit.prevent="onSave">
          <q-input
            v-model="profile.firstName"
            label="Vorname"
            dense
            outlined
            class="q-mb-md"
          />
          <q-input
            v-model="profile.lastName"
            label="Nachname"
            dense
            outlined
            class="q-mb-md"
          />
          <q-input
            v-model="profile.displayName"
            label="Anzeigename"
            dense
            outlined
            class="q-mb-md"
          />
          <q-input
            v-model="profile.phone"
            label="Telefon"
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
            label="Newsletter Opt-In"
            class="q-mb-md"
          />

          <div class="row justify-end">
            <q-btn
              :loading="saving"
              :disable="saving"
              type="submit"
              label="Speichern"
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
import { ref } from "vue";
import { Notify } from "quasar";
import { upload, getUrl, read, write, auth, storage } from "src/boot/firebase";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { db } from "src/boot/firebase";

const saving = ref(false);

function createEmptyProfile() {
  return {
    firstName: "",
    lastName: "",
    displayName: "",
    phone: "",
    bio: "",
    newsletterOptIn: false,
    isPublic: false,
    role: "trainee",
    avatarUrl: "",
  };
}

const profile = ref(createEmptyProfile());

/*
   load profile
*/

const originalProfile = ref(null);

// Firestore profile laden
async function readCurrentProfile(uid) {
  try {
    const retVal = await read("users/" + uid);
    return retVal;
  } catch (e) {
    console.error("🔥 readCurrentProfile: Fehler beim Lesen:", e);
    throw e;
  }
}

async function loadProfile() {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    console.warn("⚠️ loadProfile: Kein eingeloggter User – Abbruch");
    return;
  }

  try {
    const docData = await readCurrentProfile(uid);

    if (docData?.profile) {
      // Bestehendes Profil übernehmen
      profile.value = { ...createEmptyProfile(), ...docData.profile };
      originalProfile.value = JSON.parse(JSON.stringify(profile.value));
      console.log("✅ Profil geladen.");
    } else {
      // Noch kein Profil → leeres Profil erzeugen
      profile.value = createEmptyProfile();
      originalProfile.value = JSON.parse(JSON.stringify(profile.value));
      console.log("ℹ️ Noch kein Profil vorhanden – default geladen");
    }
  } catch (e) {
    console.error("🔥 loadProfile: Fehler beim Lesen:", e);
    Notify.create({
      type: "negative",
      message: "Profil konnte nicht geladen werden",
    });
  }
}

// Automatisch laden sobald auth ready ist
onAuthStateChanged(auth, (user) => {
  if (user?.uid) {
    loadProfile();
  }
});

// ---- UPLOADER FACTORY ----
async function uploadAvatar(files) {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    Notify.create({ type: "negative", message: "Nicht eingeloggt." });
    return;
  }

  const file = files[0];
  const ext = file.name.split(".").pop().toLowerCase();
  const path = `users/${uid}/avatar_${uid}.${ext}`;

  try {
    // upload to Storage, get url
    const url = await upload(path, file);
    profile.value.avatarUrl = url;
    console.log("✅ Avatar uploaded → URL:", url);

    // URL in Firestore speichern (nur Feld, ohne rest zu überschreiben)
    await updateDoc(doc(db, `users/${uid}`), {
      "profile.avatarUrl": url,
    });

    Notify.create({ type: "positive", message: "Avatar gespeichert." });
  } catch (e) {
    console.error("🔥 Avatar upload failed:", e);
    Notify.create({
      type: "negative",
      message: "Avatar-Upload fehlgeschlagen.",
    });
  }
}

// ---- EVENTS ----
async function onAvatarUploaded(info) {
  const apiUid = auth.currentUser?.uid;
  const uploaderUrl =
    info.response?.url || info.files?.[0]?.__displayUrl || info.response;
  if (!uploaderUrl) {
    Notify.create({
      type: "negative",
      message: "Keine URL im Upload-Response erhalten",
    });
    return;
  }

  profile.value.avatarUrl = uploaderUrl;

  // URL direkt in Firestore in der Map 'profile' persistieren
  try {
    const userDoc = doc(db, "users", apiUid);
    await updateDoc(userDoc, { "profile.avatarUrl": uploaderUrl });

    Notify.create({ type: "positive", message: "Avatar gespeichert." });
  } catch (e) {
    Notify.create({ type: "negative", message: "Firestore update failed." });
  }
}

function onAvatarFailed(err) {
  console.error(err);
  Notify.create({ type: "negative", message: "Avatar-Upload fehlgeschlagen." });
}

// ---- SAVE PROFILE ----
async function onSave() {
  const uid = auth.currentUser?.uid;
  if (!uid) return;

  saving.value = true;
  try {
    await write(`users/${uid}`, { profile: profile.value });
    Notify.create({ type: "positive", message: "Profil gespeichert." });
  } catch (e) {
    Notify.create({ type: "negative", message: "Speichern fehlgeschlagen." });
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
img {
  object-fit: cover;
}
</style>
