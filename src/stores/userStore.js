import { reactive, computed } from "vue";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "src/boot/firebase";

/*
     Globals
*/
const _profile = {
  userId: "",
  email: "",
  userName: "",
  salutation: "",
  gender: "",
  age: "",
  avatarUrl: "",
  createdAt: null,
  updatedAt: null,
};

/*
   User Store
*/

export const profile = reactive(_profile);

let unsub = null;
const coll = `users`;

/*
   central function to check if any user is logged in
*/
export const isUserLoggedIn = computed(() => {
  return auth.currentUser !== null;
});

/*
     Create new user profile
  */
export const createProfile = async (userData) => {
  try {
    const userProfile = {
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await setDoc(doc(db, coll, userData.userId), userProfile);
    return userProfile;
  } catch (error) {
    console.error("Error creating user profile:", error);
    throw error;
  }
};

/*
     Update profile data
  */
export const setProfile = async (newData) => {
  try {
    const userId = auth.currentUser.uid;
    const updatedData = {
      ...newData,
      updatedAt: new Date(),
    };
    await updateDoc(doc(db, coll, userId), updatedData);
    Object.assign(profile, updatedData);
  } catch (error) {
    console.error("Error updating profile:", error);
    throw error;
  }
};

/*
     Delete profile
  */
export const deleteProfile = async () => {
  try {
    const userId = auth.currentUser.uid;
    await deleteDoc(doc(db, coll, userId));
    Object.keys(profile).forEach((key) => {
      profile[key] = _profile[key];
    });
  } catch (error) {
    console.error("Error deleting profile:", error);
    throw error;
  }
};

/*
     get profile by userId
*/
export const getUserProfile = async (userId) => {
  try {
    const docRef = doc(db, coll, userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      console.log("No such document!");
      return null;
    }
  } catch (error) {
    console.error("Error getting user profile:", error);
    throw error;
  }
};

/*
     Listen for Profile
  */
export const listenForProfile = () => {
  // stop previous listener
  cleanUp();

  // start new listener
  unsub = onSnapshot(doc(db, coll, auth.currentUser.uid), (docSnap) => {
    if (docSnap.exists()) {
      Object.assign(profile, docSnap.data().profile);
    } else {
      console.log("No such document!");
    }
  });
};

/*
     Clean Up
  */
export const cleanUp = () => {
  if (unsub) {
    unsub();
    unsub = null;
    Object.assign(profile, _profile);
  }
};
