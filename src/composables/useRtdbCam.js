// Adaptive RTDB sync for a single webcam.
//
// Write intervals:
//   Movement active  → max 1 write per 200 ms
//   Movement idle    → max 1 write per 3 000 ms
//   Boolean edge     → immediate extra write
//
// Presence: online flag is set on enable, cleared via onDisconnect on
// network loss and by explicit goOffline() when the user stops the cam.

import { ref, watch, isRef, onUnmounted } from "vue";
import { rtdb } from "src/boot/firebase";
import { ref as dbRef, update, set, onDisconnect } from "firebase/database";

export const CAM_TYPES = ["face", "body", "room"];
export const CAM_LABELS = {
  face: "Face Cam",
  body: "Body Cam",
  room: "Room Cam",
};
export const CAM_ICONS = {
  face: "face",
  body: "accessibility_new",
  room: "meeting_room",
};
export const CAM_COLORS = { face: "blue-7", body: "green-7", room: "orange-7" };

const INTERVAL_ACTIVE = 200; // ms – when movement.visible
const INTERVAL_IDLE = 3000; // ms – when no movement
const TICK_MS = 100; // internal poll tick

function resolve(val) {
  return isRef(val) ? val.value : val;
}

function camPath(uid, camType) {
  return `cams/${uid}/${camType}`;
}

/** Extract only the fields we want to persist (no internal meta). */
function extractState(analysis) {
  return {
    face: {
      visible: analysis.face.visible,
      mouthOpen: analysis.face.mouthOpen,
      gazeDirection: analysis.face.gazeDirection,
      lookingAtTarget: analysis.face.lookingAtTarget,
    },
    pose: {
      upperBodyVisible: analysis.pose.upperBodyVisible,
      fullBodyVisible: analysis.pose.fullBodyVisible,
      rightHandRaised: analysis.pose.rightHandRaised,
      leftHandRaised: analysis.pose.leftHandRaised,
      bothHandsRaised: analysis.pose.bothHandsRaised,
      legsSpread: analysis.pose.legsSpread,
      posture: analysis.pose.posture,
    },
    movement: {
      visible: analysis.movement.visible,
      level: analysis.movement.level,
      regionVisible: analysis.movement.regionVisible,
      regionLevel: analysis.movement.regionLevel,
    },
  };
}

/**
 * Build a flat delta object for RTDB update().
 * Keys are "section/field" strings; only changed values are included.
 * Pass prev=null to include everything (full write).
 */
function buildDelta(prev, current) {
  const delta = {};
  for (const section of ["face", "pose", "movement"]) {
    for (const [key, value] of Object.entries(current[section])) {
      if (!prev || prev[section][key] !== value) {
        delta[`${section}/${key}`] = value;
      }
    }
  }
  return delta;
}

/**
 * Composable – call inside <script setup> of the WebcamPage.
 *
 * @param {{ uid: Ref<string>|string, camType: Ref<string>|string, analysis: object, enabled: Ref<boolean> }} opts
 */
export function useRtdbCam({ uid, camType, analysis, enabled }) {
  const writeCount = ref(0);
  const lastWrittenAt = ref(null);
  const syncError = ref("");

  let tickTimer = null;
  let lastWrittenState = null;
  let lastWriteMs = 0;
  let presenceRef = null;

  // ── helpers ─────────────────────────────────────────────────────────────

  function threshold() {
    return analysis.movement.visible ? INTERVAL_ACTIVE : INTERVAL_IDLE;
  }

  async function doWrite(forceFull = false) {
    const uidVal = resolve(uid);
    const camVal = resolve(camType);
    if (!uidVal || !camVal) return;

    const current = extractState(analysis);
    const delta = buildDelta(forceFull ? null : lastWrittenState, current);
    if (Object.keys(delta).length === 0) return;

    delta["updatedAt"] = Date.now();

    try {
      await update(dbRef(rtdb, camPath(uidVal, camVal)), delta);
      lastWrittenState = current;
      lastWriteMs = Date.now();
      lastWrittenAt.value = new Date().toISOString();
      writeCount.value += 1;
      syncError.value = "";
    } catch (err) {
      syncError.value =
        err instanceof Error ? err.message : "Write fehlgeschlagen.";
    }
  }

  // ── tick ────────────────────────────────────────────────────────────────

  function startTick() {
    if (tickTimer) return;
    tickTimer = setInterval(() => {
      if (!resolve(enabled)) return;
      if (Date.now() - lastWriteMs >= threshold()) {
        void doWrite();
      }
    }, TICK_MS);
  }

  function stopTick() {
    clearInterval(tickTimer);
    tickTimer = null;
  }

  // ── presence ────────────────────────────────────────────────────────────

  async function goOnline() {
    const uidVal = resolve(uid);
    const camVal = resolve(camType);
    if (!uidVal || !camVal) return;

    const path = camPath(uidVal, camVal);
    presenceRef = dbRef(rtdb, `${path}/online`);

    // If the browser closes / network drops, Firebase clears online automatically.
    await onDisconnect(presenceRef).set(false);
    await set(presenceRef, true);

    // Full initial write so RTDB is in sync from the start.
    lastWrittenState = null;
    lastWriteMs = 0;
    void doWrite(true);
    startTick();
  }

  async function goOffline() {
    stopTick();
    const uidVal = resolve(uid);
    const camVal = resolve(camType);

    if (uidVal && camVal) {
      try {
        if (presenceRef) await onDisconnect(presenceRef).cancel();
        await update(dbRef(rtdb, camPath(uidVal, camVal)), {
          online: false,
          updatedAt: Date.now(),
        });
      } catch (_) {
        // Ignore – may already be offline.
      }
    }

    presenceRef = null;
    lastWrittenState = null;
  }

  // ── edge watchers ────────────────────────────────────────────────────────
  // Immediate write on any boolean state change.

  const edgeGetters = [
    () => analysis.face.visible,
    () => analysis.face.mouthOpen,
    () => analysis.face.lookingAtTarget,
    () => analysis.pose.rightHandRaised,
    () => analysis.pose.leftHandRaised,
    () => analysis.pose.bothHandsRaised,
    () => analysis.pose.upperBodyVisible,
    () => analysis.pose.fullBodyVisible,
    () => analysis.pose.posture,
    () => analysis.movement.visible,
    () => analysis.movement.regionVisible,
  ];

  const stopEdgeWatchers = edgeGetters.map((getter) =>
    watch(getter, () => {
      if (resolve(enabled)) void doWrite();
    }),
  );

  // ── enabled toggle ───────────────────────────────────────────────────────

  const stopEnabledWatch = watch(
    () => resolve(enabled),
    (active) => {
      if (active) void goOnline();
      else void goOffline();
    },
    { immediate: true },
  );

  // ── cleanup ──────────────────────────────────────────────────────────────

  onUnmounted(() => {
    stopEdgeWatchers.forEach((s) => s());
    stopEnabledWatch();
    void goOffline();
  });

  return { writeCount, lastWrittenAt, syncError };
}
