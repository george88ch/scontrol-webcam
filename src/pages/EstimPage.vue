<template>
  <q-page class="estim-page q-pa-md">
    <div class="shell">
      <div class="header">
        <div>
          <div class="title">Estim Audio</div>
          <div class="subtitle">Queue {{ queueId }}</div>
          <div class="subtitle">Audio {{ audioReady ? "ready" : "disabled" }}</div>
        </div>
        <q-badge :color="workerReady ? 'positive' : 'grey-7'">
          {{ workerReady ? "Online" : "Offline" }}
        </q-badge>
      </div>

      <q-banner v-if="!audioReady" rounded class="bg-orange-2 text-orange-10 q-mb-md">
        Audio muss auf diesem Gerät einmal aktiviert werden.
        <template #action>
          <q-btn color="orange-10" flat label="Enable audio" @click="enableAudio" />
        </template>
      </q-banner>

      <q-banner
        v-if="queueError"
        rounded
        class="bg-negative text-white q-mb-md"
      >
        {{ queueError }}
      </q-banner>

      <q-card flat bordered class="card q-mb-md">
        <div class="row items-center justify-between q-gutter-md">
          <div>
            <div class="section-title">Status</div>
            <div class="status-text">{{ statusText }}</div>
          </div>
          <q-btn
            color="negative"
            outline
            label="Stop"
            :disable="!isPlaying && mode !== 'calibration'"
            @click="() => stopAll()"
          />
        </div>

        <q-linear-progress
          v-if="isPlaying"
          indeterminate
          color="primary"
          class="q-mt-md"
        />
      </q-card>

      <q-card flat bordered class="card">
        <q-expansion-item
          v-model="calibrationExpanded"
          label="Calibration"
          header-class="calibration-header"
          :disable="isPlaying || !audioReady"
          @show="startCalibration"
          @hide="stopCalibration"
        >
          <div class="q-pt-md">
            <div class="row items-center justify-between q-gutter-md q-mb-md">
              <div>
                <div class="section-title">{{ currentCalibrationFreq }} Hz</div>
                <div class="status-text">{{ calibrationStatusText }}</div>
              </div>
              <q-btn
                color="negative"
                outline
                label="Stop"
                :disable="mode !== 'calibration'"
                @click="stopCalibration"
              />
            </div>

            <q-slider
              v-model="calibrationGain"
              :min="0.01"
              :max="0.5"
              :step="0.001"
              label
              label-always
              :disable="mode !== 'calibration' || calibrationSaving"
              class="q-mb-md"
            />

            <div class="row q-col-gutter-sm">
              <div
                v-for="freq in calibrationFrequencies"
                :key="freq"
                class="col-6 col-sm-3"
              >
                <div class="calibration-summary">
                  <div class="summary-freq">{{ freq }} Hz</div>
                  <div>Min {{ calibrationData[freq]?.minGain ?? "-" }}</div>
                  <div>Max {{ calibrationData[freq]?.maxGain ?? "-" }}</div>
                </div>
              </div>
            </div>

            <div class="row justify-end q-gutter-sm q-mt-md">
              <q-btn
                color="primary"
                :label="calibrationActionLabel"
                :loading="calibrationSaving"
                :disable="mode !== 'calibration'"
                @click="saveCalibrationPoint"
              />
            </div>
          </div>
        </q-expansion-item>
      </q-card>
    </div>
  </q-page>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { Notify } from "quasar";
import { write } from "src/boot/firebase";
import { defaultCalibration } from "src/composables/soundDefaults.js";
import { useAuth } from "src/composables/useAuth.js";
import {
  claimEstimCommand,
  clearEstimCommands,
  completeEstimCommand,
  createEstimQueueId,
  listenEstimCommands,
  registerEstimWorker,
  setEstimWorkerAudioReady,
  unregisterEstimWorker,
} from "src/composables/useEstimQueue.js";

const calibrationFrequencies = [220, 440, 660, 880];

const { uid, profile } = useAuth();
const queueId = computed(() => createEstimQueueId(uid.value));

const mode = ref("idle");
const activeCommandId = ref("");
const audioReady = ref(false);
const workerReady = ref(false);
const pendingCommands = ref([]);
const queueError = ref("");
const calibrationExpanded = ref(false);
const calibrationIndex = ref(0);
const calibrationPhase = ref("min");
const calibrationGain = ref(defaultCalibration[220]?.minGain || 0.18);
const calibrationSaving = ref(false);

let audioCtx = null;
let activeNodes = [];
let activeTimeouts = [];
let unsubscribeCommands = null;
let calibrationOsc = null;
let calibrationGainNode = null;
let calibrationPanner = null;

const isPlaying = computed(() => mode.value === "play");
const statusText = computed(() => {
  if (isPlaying.value) return `Playing command ${activeCommandId.value}`;
  if (mode.value === "calibration") {
    return `${currentCalibrationFreq.value} Hz calibration`;
  }
  if (pendingCommands.value.length > 0) {
    return `${pendingCommands.value.length} command(s) queued`;
  }
  return "Waiting for commands";
});

const calibrationData = computed(() => profile.value?.estimCalibration || {});
const currentCalibrationFreq = computed(
  () => calibrationFrequencies[calibrationIndex.value] || calibrationFrequencies[0],
);
const calibrationStatusText = computed(() => {
  const step = calibrationIndex.value + 1;
  const phase = calibrationPhase.value === "min" ? "Minimum" : "Maximum";
  return `${phase} bestimmen (${step}/${calibrationFrequencies.length})`;
});
const calibrationActionLabel = computed(
  () => (calibrationPhase.value === "min" ? "Minimum" : "Maximum"),
);

function ensureAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

async function enableAudio() {
  try {
    ensureAudioCtx();
    if (audioCtx.state === "suspended") {
      await audioCtx.resume();
    }
    audioReady.value = true;
    await setEstimWorkerAudioReady(queueId.value, true);
    processNextCommand();
  } catch (error) {
    audioReady.value = false;
    console.error("Could not enable Estim audio:", error);
    Notify.create({
      type: "negative",
      message: "Audio konnte nicht aktiviert werden.",
    });
  }
}

function gainForTone(item) {
  const data = calibrationRangeForFreq(item.freq);
  const normalized = clamp((item.volume - 1) / 4, 0, 1);

  return data.minGain + normalized * (data.maxGain - data.minGain);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function calibrationRangeForFreq(freq) {
  const ranges = calibrationFrequencies.map((calibrationFreq) => {
    const saved = calibrationData.value[calibrationFreq];
    const fallback = defaultCalibration[calibrationFreq] || {
      minGain: 0.18,
      maxGain: 0.28,
    };

    return {
      freq: calibrationFreq,
      minGain: Number(saved?.minGain ?? fallback.minGain),
      maxGain: Number(saved?.maxGain ?? fallback.maxGain),
    };
  });

  if (freq <= ranges[0].freq) return ranges[0];

  const last = ranges[ranges.length - 1];
  if (freq >= last.freq) return last;

  const upperIndex = ranges.findIndex((range) => freq <= range.freq);
  const lower = ranges[upperIndex - 1];
  const upper = ranges[upperIndex];
  const factor = (freq - lower.freq) / (upper.freq - lower.freq);

  return {
    minGain: interpolate(lower.minGain, upper.minGain, factor),
    maxGain: interpolate(lower.maxGain, upper.maxGain, factor),
  };
}

function interpolate(from, to, factor) {
  return from + (to - from) * factor;
}

function playTone(item, startAt) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const panner = audioCtx.createStereoPanner();

  osc.type = "sine";
  osc.frequency.value = item.freq;
  panner.pan.value = item.pan;

  const fade = 0.12;
  const targetGain = gainForTone(item);

  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(targetGain, startAt + fade);
  gain.gain.setValueAtTime(targetGain, startAt + item.dur - fade);
  gain.gain.linearRampToValueAtTime(0, startAt + item.dur);

  osc.connect(gain);
  gain.connect(panner);
  panner.connect(audioCtx.destination);

  osc.start(startAt);
  osc.stop(startAt + item.dur);

  activeNodes.push(osc);
}

async function processNextCommand() {
  if (isPlaying.value || mode.value === "calibration" || !audioReady.value) return;

  const nextCommand = pendingCommands.value.find(
    (command) => command.type === "estim-sequence" && command.status === "pending",
  );

  if (!nextCommand) return;

  const command = await claimEstimCommand(queueId.value, nextCommand.id);
  if (!command) return;

  startSequence(nextCommand.id, command.sequence);
}

function startSequence(commandId, sequence) {
  stopAll(false);
  ensureAudioCtx();

  mode.value = "play";
  activeCommandId.value = commandId;

  const introDuration = 4;
  const steps = sequence.steps || [];
  const startTime = audioCtx.currentTime + introDuration;

  steps.forEach((item) => {
    playTone(item, startTime + item.t);
  });

  const lastStep = steps[steps.length - 1];
  const sequenceEnd = introDuration + (lastStep?.t || 0) + (lastStep?.dur || 0);

  const doneTimeout = setTimeout(async () => {
    const finishedCommandId = activeCommandId.value;
    stopAll(false);
    if (finishedCommandId) {
      await completeEstimCommand(queueId.value, finishedCommandId);
    }
    processNextCommand();
  }, sequenceEnd * 1000);

  activeTimeouts.push(doneTimeout);
}

function startCalibration() {
  if (!audioReady.value || isPlaying.value) return;

  stopAll(false);
  ensureAudioCtx();
  calibrationIndex.value = 0;
  calibrationPhase.value = "min";
  calibrationGain.value = rangeForCalibrationFreq(currentCalibrationFreq.value).minGain;
  mode.value = "calibration";
  startCalibrationTone(currentCalibrationFreq.value, calibrationGain.value);
}

function stopCalibration() {
  if (mode.value === "calibration") {
    stopAll(false);
  }
}

function rangeForCalibrationFreq(freq) {
  const saved = calibrationData.value[freq];
  const fallback = defaultCalibration[freq] || { minGain: 0.18, maxGain: 0.28 };

  return {
    minGain: Number(saved?.minGain ?? fallback.minGain),
    maxGain: Number(saved?.maxGain ?? fallback.maxGain),
  };
}

async function saveCalibrationPoint() {
  if (mode.value !== "calibration" || !uid.value) return;

  const freq = currentCalibrationFreq.value;
  const currentRange = rangeForCalibrationFreq(freq);
  const gainValue = Number(calibrationGain.value.toFixed(3));
  const nextRange =
    calibrationPhase.value === "min"
      ? {
          ...currentRange,
          minGain: gainValue,
          maxGain: Math.max(currentRange.maxGain, gainValue),
        }
      : {
          ...currentRange,
          maxGain: Math.max(gainValue, currentRange.minGain),
        };

  const nextCalibration = {
    ...calibrationData.value,
    [freq]: nextRange,
  };
  const { id: _id, ...profileData } = profile.value || {};

  calibrationSaving.value = true;
  try {
    await write(`users/${uid.value}`, {
      profile: {
        ...profileData,
        estimCalibration: nextCalibration,
      },
    });

    if (calibrationPhase.value === "min") {
      calibrationPhase.value = "max";
      calibrationGain.value = nextRange.minGain;
      startCalibrationTone(freq, nextRange.minGain);
      return;
    }

    if (calibrationIndex.value < calibrationFrequencies.length - 1) {
      calibrationIndex.value += 1;
      calibrationPhase.value = "min";
      calibrationGain.value = rangeForCalibrationFreq(
        currentCalibrationFreq.value,
      ).minGain;
      startCalibrationTone(currentCalibrationFreq.value, calibrationGain.value);
      return;
    }

    stopCalibration();
    calibrationExpanded.value = false;
    Notify.create({ type: "positive", message: "Calibration saved." });
  } catch (error) {
    console.error("Calibration save failed:", error);
    Notify.create({ type: "negative", message: "Calibration save failed." });
  } finally {
    calibrationSaving.value = false;
  }
}

function startCalibrationTone(freq, gainValue) {
  stopCalibrationTone();
  ensureAudioCtx();

  calibrationOsc = audioCtx.createOscillator();
  calibrationGainNode = audioCtx.createGain();
  calibrationPanner = audioCtx.createStereoPanner();

  calibrationOsc.type = "sine";
  calibrationOsc.frequency.value = freq;
  calibrationGainNode.gain.value = gainValue;
  calibrationPanner.pan.value = 0;

  calibrationOsc.connect(calibrationGainNode);
  calibrationGainNode.connect(calibrationPanner);
  calibrationPanner.connect(audioCtx.destination);

  calibrationOsc.start();
}

function stopCalibrationTone() {
  if (calibrationOsc) {
    try {
      calibrationOsc.stop();
    } catch (_) {}
    calibrationOsc.disconnect();
    calibrationOsc = null;
  }

  if (calibrationGainNode) {
    calibrationGainNode.disconnect();
    calibrationGainNode = null;
  }

  if (calibrationPanner) {
    calibrationPanner.disconnect();
    calibrationPanner = null;
  }
}

function stopAll(closeAudio = false) {
  activeNodes.forEach((node) => {
    try {
      node.stop();
    } catch (_) {}
  });
  activeNodes = [];

  activeTimeouts.forEach((timeout) => clearTimeout(timeout));
  activeTimeouts = [];

  stopCalibrationTone();
  mode.value = "idle";
  activeCommandId.value = "";

  if (closeAudio && audioCtx) {
    audioCtx.close();
    audioCtx = null;
    audioReady.value = false;
  }
}

onMounted(async () => {
  if (!queueId.value) return;

  try {
    workerReady.value = true;
    queueError.value = "";
    await registerEstimWorker(queueId.value);
    await clearEstimCommands(queueId.value);

    unsubscribeCommands = listenEstimCommands(queueId.value, (commands) => {
      pendingCommands.value = commands;

      if (
        activeCommandId.value &&
        !commands.some((command) => command.id === activeCommandId.value)
      ) {
        stopAll(false);
        return;
      }

      processNextCommand();
    });
  } catch (error) {
    workerReady.value = false;
    queueError.value =
      error?.code === "PERMISSION_DENIED"
        ? "Keine RTDB-Berechtigung. Bitte einloggen und die Database Rules deployen."
        : error?.message || "Estim Queue konnte nicht verbunden werden.";
    console.error("Estim queue setup failed:", error);
  }
});

watch(calibrationGain, () => {
  if (mode.value === "calibration" && calibrationGainNode) {
    calibrationGainNode.gain.setValueAtTime(
      calibrationGain.value,
      audioCtx.currentTime,
    );
  }
});

onUnmounted(() => {
  if (unsubscribeCommands) unsubscribeCommands();
  if (queueId.value) void unregisterEstimWorker(queueId.value);
  stopAll(true);
});
</script>

<style scoped>
.estim-page {
  min-height: 100vh;
  background: #111;
}

.shell {
  max-width: 760px;
  margin: 0 auto;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
  color: white;
}

.title {
  font-size: 28px;
  font-weight: 700;
}

.subtitle {
  margin-top: 4px;
  opacity: 0.68;
  overflow-wrap: anywhere;
}

.card {
  padding: 20px;
}

.section-title {
  font-weight: 700;
}

.status-text {
  margin-top: 4px;
  color: #666;
}
</style>
