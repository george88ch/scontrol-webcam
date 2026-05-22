// RTDB listener for all cam types of a given user.
// Detects boolean edge transitions (rising / falling) and fires command events.
//
// Usage:
//   const { camStates, commandLog, subscribeAll, unsubscribeAll, onCommand, clearLog }
//     = useCamCommands(uid)
//   subscribeAll()
//   onCommand((cmd) => console.log(cmd))

import { ref, reactive, isRef, onUnmounted } from "vue";
import { rtdb } from "src/boot/firebase";
import { ref as dbRef, onValue } from "firebase/database";

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

/** All detectable boolean events with metadata. */
export const TRIGGER_EVENTS = [
  // face
  { key: "face.visible", label: "Gesicht sichtbar", icon: "face" },
  {
    key: "face.mouthOpen",
    label: "Mund geöffnet",
    icon: "sentiment_very_satisfied",
  },
  {
    key: "face.lookingAtTarget",
    label: "Blick auf Zielpunkt",
    icon: "visibility",
  },
  // pose
  {
    key: "pose.rightHandRaised",
    label: "Rechte Hand erhoben",
    icon: "pan_tool",
  },
  { key: "pose.leftHandRaised", label: "Linke Hand erhoben", icon: "pan_tool" },
  {
    key: "pose.bothHandsRaised",
    label: "Beide Hände erhoben",
    icon: "waving_hand",
  },
  {
    key: "pose.upperBodyVisible",
    label: "Oberkörper sichtbar",
    icon: "airline_seat_recline_normal",
  },
  {
    key: "pose.fullBodyVisible",
    label: "Ganzkörper sichtbar",
    icon: "directions_walk",
  },
  {
    key: "pose.legsSpread",
    label: "Beine gespreizt",
    icon: "sports_martial_arts",
  },
  // movement
  {
    key: "movement.visible",
    label: "Bewegung erkannt",
    icon: "motion_photos_on",
  },
  {
    key: "movement.regionVisible",
    label: "Bewegung in Region",
    icon: "crop_free",
  },
];

const MAX_LOG = 60;

function resolve(val) {
  return isRef(val) ? val.value : val;
}

function getNestedValue(obj, path) {
  return path.split(".").reduce((o, k) => o?.[k], obj);
}

function normalizeSnap(data) {
  return {
    online: data.online ?? false,
    updatedAt: data.updatedAt ?? null,
    face: data.face ?? {},
    pose: data.pose ?? {},
    movement: data.movement ?? {},
  };
}

/**
 * Composable – call once per view that needs to react to cam events.
 *
 * @param {import('vue').Ref<string> | string} uid  Firebase user UID to monitor.
 */
export function useCamCommands(uid) {
  /** Reactive snapshot of each cam's RTDB state. null = not yet received. */
  const camStates = reactive({ face: null, body: null, room: null });

  /** Shadow copy for edge detection – not reactive, internal only. */
  const prevStates = { face: null, body: null, room: null };

  /** Chronological command log, newest first. */
  const commandLog = ref([]);

  let commandHandlers = [];
  const listeners = {};

  // ── edge detection ────────────────────────────────────────────────────────

  function detectEdges(camType, newState) {
    const prev = prevStates[camType];
    if (!prev) return;

    for (const event of TRIGGER_EVENTS) {
      const newVal = getNestedValue(newState, event.key);
      const oldVal = getNestedValue(prev, event.key);

      if (typeof newVal !== "boolean") continue;

      const rising = newVal === true && oldVal !== true;
      const falling = newVal !== true && oldVal === true;
      if (!rising && !falling) continue;

      const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        camType,
        eventKey: event.key,
        eventLabel: event.label,
        icon: event.icon,
        value: newVal, // true = rising, false = falling
        triggeredAt: new Date().toISOString(),
        camState: JSON.parse(JSON.stringify(newState)),
      };

      commandLog.value = [entry, ...commandLog.value].slice(0, MAX_LOG);
      commandHandlers.forEach((h) => h(entry));
    }
  }

  // ── subscription ─────────────────────────────────────────────────────────

  function subscribeAll() {
    const uidVal = resolve(uid);
    if (!uidVal) return;

    for (const camType of CAM_TYPES) {
      // Tear down existing listener if re-subscribing.
      if (listeners[camType]) {
        listeners[camType]();
        delete listeners[camType];
      }

      const r = dbRef(rtdb, `cams/${uidVal}/${camType}`);
      listeners[camType] = onValue(r, (snap) => {
        if (!snap.exists()) {
          camStates[camType] = null;
          return;
        }

        const newState = normalizeSnap(snap.val());

        // Only run edge detection after first snapshot is in.
        if (camStates[camType] !== null) {
          detectEdges(camType, newState);
        }

        // Store previous state for next diff.
        prevStates[camType] = JSON.parse(JSON.stringify(newState));
        camStates[camType] = newState;
      });
    }
  }

  function unsubscribeAll() {
    for (const unsub of Object.values(listeners)) unsub();
    for (const k of CAM_TYPES) {
      delete listeners[k];
      camStates[k] = null;
      prevStates[k] = null;
    }
  }

  // ── command handler registry ─────────────────────────────────────────────

  /**
   * Register a function to be called on every edge event.
   * Returns an unregister function.
   */
  function onCommand(handler) {
    commandHandlers.push(handler);
    return () => {
      commandHandlers = commandHandlers.filter((h) => h !== handler);
    };
  }

  function clearLog() {
    commandLog.value = [];
  }

  // ── lifecycle ─────────────────────────────────────────────────────────────

  onUnmounted(() => {
    unsubscribeAll();
  });

  return {
    camStates,
    commandLog,
    subscribeAll,
    unsubscribeAll,
    onCommand,
    clearLog,
  };
}
