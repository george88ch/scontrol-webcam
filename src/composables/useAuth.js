// composables/useAuth.js
import { ref, computed, readonly } from "vue";
import { auth, db } from "src/boot/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";

// Singleton state shared by all composable callers.
const authState = ref("initializing");
const user = ref(null);
const profile = ref(null);

let profileUnsubscribe = null;
let initialized = false;

function isPermissionDenied(error) {
  return error?.code === "permission-denied";
}

function cleanup() {
  if (profileUnsubscribe) {
    profileUnsubscribe();
    profileUnsubscribe = null;
  }
  profile.value = null;
}

function subscribeToProfile(uid) {
  return new Promise((resolve, reject) => {
    let initialLoad = true;

    profileUnsubscribe = onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        profile.value = snap.exists()
          ? { id: snap.id, ...snap.data().profile }
          : null;

        if (initialLoad) {
          initialLoad = false;
          resolve(profile.value);
        }
      },
      (error) => {
        if (isPermissionDenied(error)) {
          profile.value = null;
          if (initialLoad) {
            initialLoad = false;
            resolve(null);
          }
          return;
        }

        console.error("Profile listener error:", error);
        if (initialLoad) reject(error);
      },
    );
  });
}

function initAuth() {
  if (initialized) return Promise.resolve();
  initialized = true;

  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (firebaseUser) => {
      cleanup();

      if (firebaseUser) {
        user.value = firebaseUser;

        try {
          await subscribeToProfile(firebaseUser.uid);
          authState.value = "authenticated";
        } catch (error) {
          if (!isPermissionDenied(error)) {
            console.error("Failed to load profile:", error);
          }
          authState.value = "authenticated";
        }
      } else {
        user.value = null;
        authState.value = "unauthenticated";
      }

      resolve();
    });
  });
}

async function logout() {
  await signOut(auth);
}

export function useAuth() {
  return {
    authState: readonly(authState),
    user: readonly(user),
    profile: readonly(profile),

    isReady: computed(() => authState.value !== "initializing"),
    isAuthenticated: computed(() => authState.value === "authenticated"),
    userRole: computed(() => profile.value?.role ?? null),
    uid: computed(() => user.value?.uid ?? null),

    initAuth,
    logout,
  };
}
