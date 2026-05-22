<script setup>
import { ref, computed } from "vue";
import { useAuth } from "src/composables/useAuth";
import {
  useCamCommands,
  CAM_TYPES,
  CAM_LABELS,
  CAM_ICONS,
  CAM_COLORS,
  TRIGGER_EVENTS,
} from "src/composables/useCamCommands";

const { uid } = useAuth();

// The UID to monitor. Defaults to own uid when connected.
const monitorUid = ref("");
const connected = ref(false);

const {
  camStates,
  commandLog,
  subscribeAll,
  unsubscribeAll,
  onCommand,
  clearLog,
} = useCamCommands(monitorUid);

// Latest async command result (placeholder for future actions).
const actionLog = ref([]);

function connect() {
  if (!monitorUid.value) monitorUid.value = uid.value ?? "";
  if (!monitorUid.value) return;
  connected.value = true;
  subscribeAll();
}

function disconnect() {
  connected.value = false;
  unsubscribeAll();
}

function useSelf() {
  monitorUid.value = uid.value ?? "";
}

// Register a handler that could trigger async actions.
onCommand((cmd) => {
  // Placeholder: log as action.
  // In a real setup this would call a Cloud Function, RTDB action node, etc.
  actionLog.value = [
    {
      id: cmd.id,
      summary: `[${CAM_LABELS[cmd.camType]}] ${cmd.eventLabel} → ${cmd.value ? "aktiv" : "inaktiv"}`,
      at: cmd.triggeredAt,
    },
    ...actionLog.value,
  ].slice(0, 20);
});

// ── helpers for template ──────────────────────────────────────────────────

function formatTime(iso) {
  if (!iso) return "–";
  const d = new Date(iso);
  return d.toLocaleTimeString("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function boolField(state, path) {
  if (!state) return null;
  return path.split(".").reduce((o, k) => o?.[k], state);
}

/** Fields shown per cam card. */
const CARD_FIELDS = {
  face: [
    { path: "face.visible", label: "Gesicht" },
    { path: "face.mouthOpen", label: "Mund offen" },
    { path: "face.lookingAtTarget", label: "Blick Ziel" },
    { path: "face.gazeDirection", label: "Blickrichtung" },
  ],
  body: [
    { path: "pose.upperBodyVisible", label: "Oberkörper" },
    { path: "pose.fullBodyVisible", label: "Ganzkörper" },
    { path: "pose.rightHandRaised", label: "Rechte Hand" },
    { path: "pose.leftHandRaised", label: "Linke Hand" },
    { path: "pose.bothHandsRaised", label: "Beide Hände" },
    { path: "pose.legsSpread", label: "Beine gespreizt" },
    { path: "pose.posture", label: "Haltung" },
  ],
  room: [
    { path: "movement.visible", label: "Bewegung" },
    { path: "movement.level", label: "Level" },
    { path: "movement.regionVisible", label: "Region-Bewegung" },
    { path: "movement.regionLevel", label: "Region-Level" },
  ],
};

function fieldColor(val) {
  if (typeof val === "boolean") return val ? "positive" : "grey-6";
  return "grey-9";
}

function fieldDisplay(val) {
  if (val === null || val === undefined) return "–";
  if (typeof val === "boolean") return val ? "ja" : "nein";
  if (typeof val === "number") return val.toFixed(3);
  return String(val);
}

const onlineCams = computed(
  () => CAM_TYPES.filter((t) => camStates[t]?.online === true).length,
);
</script>

<template>
  <q-page class="q-pa-md command-page">
    <div class="page-shell">
      <!-- ── Header ────────────────────────────────────────────────────── -->
      <div class="header-row">
        <div>
          <h1 class="title">Command Center</h1>
          <p class="subtitle">
            Echtzeit-Listener auf RTDB-Cam-States. Reagiert auf Boolean-Edges
            (false → true / true → false) mit async Commands.
          </p>
        </div>

        <div class="actions q-gutter-sm">
          <template v-if="!connected">
            <q-input
              v-model="monitorUid"
              outlined
              dense
              label="User-ID überwachen"
              style="min-width: 260px"
              clearable
            >
              <template #append>
                <q-btn
                  flat
                  dense
                  icon="person"
                  title="Eigene UID verwenden"
                  :disable="!uid"
                  @click="useSelf"
                />
              </template>
            </q-input>
            <q-btn
              color="primary"
              icon="hub"
              label="Verbinden"
              :disable="!monitorUid"
              @click="connect"
            />
          </template>
          <template v-else>
            <q-chip
              v-for="n in onlineCams"
              :key="n"
              dense
              color="positive"
              text-color="white"
              icon="wifi"
            >
              {{ n }} Cam{{ n !== 1 ? "s" : "" }} online
            </q-chip>
            <q-chip dense color="blue-1" text-color="blue-9">
              {{ monitorUid }}
            </q-chip>
            <q-btn
              flat
              color="negative"
              icon="wifi_off"
              label="Trennen"
              @click="disconnect"
            />
          </template>
        </div>
      </div>

      <!-- ── Cam Status Cards ──────────────────────────────────────────── -->
      <div class="cam-grid q-mt-md">
        <q-card
          v-for="camType in CAM_TYPES"
          :key="camType"
          flat
          bordered
          class="cam-card"
        >
          <!-- Card header -->
          <q-item class="cam-card-header">
            <q-item-section avatar>
              <q-icon
                :name="CAM_ICONS[camType]"
                :color="CAM_COLORS[camType]"
                size="28px"
              />
            </q-item-section>
            <q-item-section>
              <q-item-label class="text-weight-bold">{{
                CAM_LABELS[camType]
              }}</q-item-label>
              <q-item-label caption>
                <q-badge
                  v-if="camStates[camType]?.online"
                  color="positive"
                  label="online"
                />
                <q-badge
                  v-else-if="connected && camStates[camType]"
                  color="grey"
                  label="offline"
                />
                <q-badge
                  v-else-if="connected"
                  color="warning"
                  label="kein Signal"
                />
                <q-badge
                  v-else
                  color="grey-4"
                  text-color="grey-8"
                  label="nicht verbunden"
                />
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <span class="text-caption text-grey-6">
                {{
                  formatTime(
                    camStates[camType]?.updatedAt
                      ? new Date(camStates[camType].updatedAt).toISOString()
                      : null,
                  )
                }}
              </span>
            </q-item-section>
          </q-item>

          <q-separator />

          <!-- Field list -->
          <q-card-section class="q-pa-sm">
            <q-list dense>
              <q-item
                v-for="field in CARD_FIELDS[camType]"
                :key="field.path"
                class="field-item q-py-none"
              >
                <q-item-section>
                  <span class="text-caption text-grey-7">{{
                    field.label
                  }}</span>
                </q-item-section>
                <q-item-section side>
                  <span
                    class="text-caption text-weight-medium"
                    :class="`text-${fieldColor(boolField(camStates[camType], field.path))}`"
                  >
                    {{
                      fieldDisplay(boolField(camStates[camType], field.path))
                    }}
                  </span>
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </q-card>
      </div>

      <!-- ── Command Log ───────────────────────────────────────────────── -->
      <q-card flat bordered class="q-mt-md log-card">
        <q-item>
          <q-item-section>
            <q-item-label class="text-h6">Command Log</q-item-label>
            <q-item-label caption>
              Edge-Transitions (false↔true) aller Boolean-Felder
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-btn
              flat
              dense
              icon="clear_all"
              label="Leeren"
              color="grey-7"
              @click="clearLog"
            />
          </q-item-section>
        </q-item>

        <q-separator />

        <q-scroll-area style="height: 360px">
          <q-list separator>
            <q-item
              v-if="commandLog.length === 0"
              class="text-grey-6 text-center q-py-lg"
            >
              <q-item-section>
                <q-icon name="inbox" size="32px" class="q-mb-xs" />
                <div class="text-caption">Noch keine Events empfangen.</div>
              </q-item-section>
            </q-item>

            <q-item v-for="cmd in commandLog" :key="cmd.id" class="log-item">
              <!-- Color bar -->
              <q-item-section
                avatar
                style="min-width: 4px; padding-right: 0"
                class="self-stretch"
              >
                <div
                  class="color-bar"
                  :style="`background: var(--q-${CAM_COLORS[cmd.camType]})`"
                />
              </q-item-section>

              <q-item-section avatar>
                <q-icon
                  :name="cmd.icon"
                  :color="CAM_COLORS[cmd.camType]"
                  size="22px"
                />
              </q-item-section>

              <q-item-section>
                <q-item-label>
                  <span class="text-weight-medium">{{ cmd.eventLabel }}</span>
                  <q-badge
                    class="q-ml-sm"
                    :color="cmd.value ? 'positive' : 'grey-5'"
                    :text-color="cmd.value ? 'white' : 'grey-9'"
                    :label="cmd.value ? '↑ aktiv' : '↓ inaktiv'"
                  />
                </q-item-label>
                <q-item-label caption>
                  {{ CAM_LABELS[cmd.camType] }}
                  &mdash;
                  {{ formatTime(cmd.triggeredAt) }}
                </q-item-label>
              </q-item-section>

              <q-item-section side>
                <q-btn
                  flat
                  dense
                  round
                  icon="expand_more"
                  size="sm"
                  color="grey-6"
                >
                  <q-tooltip>Snapshot anzeigen</q-tooltip>
                  <q-menu anchor="bottom right" self="top right">
                    <q-card style="min-width: 260px; max-width: 380px">
                      <q-card-section class="q-pa-sm">
                        <div class="text-caption text-grey-7 q-mb-xs">
                          Cam-State beim Trigger
                        </div>
                        <pre
                          style="
                            font-size: 0.75rem;
                            white-space: pre-wrap;
                            word-break: break-all;
                          "
                          >{{ JSON.stringify(cmd.camState, null, 2) }}</pre
                        >
                      </q-card-section>
                    </q-card>
                  </q-menu>
                </q-btn>
              </q-item-section>
            </q-item>
          </q-list>
        </q-scroll-area>
      </q-card>
    </div>
  </q-page>
</template>

<style scoped>
.command-page {
  background: radial-gradient(
    circle at 80% 10%,
    #f0fff4,
    #f6f7fb 38%,
    #fff8f0 100%
  );
}

.page-shell {
  max-width: 1240px;
  margin: 0 auto;
}

.header-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  flex-wrap: wrap;
}

.title {
  margin: 0;
  font-size: 1.8rem;
  line-height: 1.2;
  font-weight: 700;
}

.subtitle {
  margin: 6px 0 0;
  color: #48556a;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.cam-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.cam-card {
  border-radius: 14px;
  background: #fff;
}

.cam-card-header {
  padding: 12px 16px;
}

.field-item {
  min-height: 28px;
}

.log-card {
  border-radius: 14px;
  background: #fff;
}

.log-item {
  padding: 8px 16px;
}

.color-bar {
  width: 4px;
  border-radius: 2px;
  flex: 1;
}

@media (max-width: 860px) {
  .cam-grid {
    grid-template-columns: 1fr;
  }
}
</style>
