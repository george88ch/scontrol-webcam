import { db } from "src/boot/firebase";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import {
  consequenceSequence,
  teaseSequence,
} from "src/composables/soundDefaults.js";

export const SOUND_SEQUENCES_COLLECTION = "soundSequences";
export const SOUND_DEFAULTS_DOC = "config/soundDefaults";

export function localDefaultSequences() {
  return [teaseSequence, consequenceSequence].map((sequence, index) => ({
    ...JSON.parse(JSON.stringify(sequence)),
    order: index + 1,
    active: true,
  }));
}

export function validateSequence(sequence) {
  if (!sequence || typeof sequence !== "object") {
    throw new Error("Sequence must be an object.");
  }

  if (!sequence.id || typeof sequence.id !== "string") {
    throw new Error("Sequence requires a string id.");
  }

  if (!sequence.name || typeof sequence.name !== "string") {
    throw new Error("Sequence requires a string name.");
  }

  if (!Array.isArray(sequence.steps)) {
    throw new Error("Sequence requires a steps array.");
  }

  let previousStart = -1;
  const allowedMoods = ["neutral", "soft", "strict", "stare", "laugh", "pressure"];

  sequence.steps.forEach((step, index) => {
    for (const key of ["t", "dur", "freq", "volume", "pan"]) {
      if (typeof step[key] !== "number") {
        throw new Error(`Step ${index + 1} requires numeric ${key}.`);
      }
    }

    if (step.t < previousStart) {
      throw new Error(`Step ${index + 1} must be chronological.`);
    }

    if (step.dur <= 0) {
      throw new Error(`Step ${index + 1} requires dur > 0.`);
    }

    if (step.freq < 220 || step.freq > 800) {
      throw new Error(`Step ${index + 1} freq must be between 220 and 800.`);
    }

    if (step.volume < 1 || step.volume > 5) {
      throw new Error(`Step ${index + 1} volume must be between 1 and 5.`);
    }

    if (step.pan < -1 || step.pan > 1) {
      throw new Error(`Step ${index + 1} pan must be between -1 and 1.`);
    }

    if (!allowedMoods.includes(step.mood)) {
      throw new Error(`Step ${index + 1} has an invalid mood.`);
    }

    previousStart = step.t;
  });
}

export async function loadSoundDefaultsDoc() {
  const snap = await getDoc(doc(db, SOUND_DEFAULTS_DOC));
  if (!snap.exists()) {
    return {
      id: "soundDefaults",
      sequences: localDefaultSequences(),
    };
  }

  return { id: snap.id, ...snap.data() };
}

export async function saveSoundDefaultsDoc(defaults) {
  await setDoc(
    doc(db, SOUND_DEFAULTS_DOC),
    {
      ...defaults,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function loadSoundSequences() {
  const snap = await getDocs(
    query(collection(db, SOUND_SEQUENCES_COLLECTION), orderBy("order", "asc")),
  );

  const sequences = snap.docs
    .map((item) => ({ firestoreId: item.id, ...item.data() }))
    .filter((sequence) => sequence.active !== false);

  return sequences.length > 0 ? sequences : localDefaultSequences();
}

export async function loadAdminSoundSequences() {
  const snap = await getDocs(
    query(collection(db, SOUND_SEQUENCES_COLLECTION), orderBy("order", "asc")),
  );

  return snap.docs.map((item) => ({ firestoreId: item.id, ...item.data() }));
}

export async function saveSoundSequence(sequence) {
  validateSequence(sequence);

  await setDoc(
    doc(db, SOUND_SEQUENCES_COLLECTION, sequence.id),
    {
      ...sequence,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function deleteSoundSequence(sequenceId) {
  await deleteDoc(doc(db, SOUND_SEQUENCES_COLLECTION, sequenceId));
}

export async function seedSoundSequencesFromDefaults(defaults) {
  const sequences = defaults?.sequences || localDefaultSequences();

  for (const sequence of sequences) {
    await saveSoundSequence(sequence);
  }
}
