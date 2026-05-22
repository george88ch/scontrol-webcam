<template>
  <q-page class="page">
    <q-dialog
      v-model="showDialog"
      persistent
      maximized
      transition-show="slide-up"
      transition-hide="slide-down"
    >
      <div class="column">
        <div v-if="isRephrasing" class="loading-screen">
          <q-spinner-dots color="white" size="64px" />
          <div class="loading-title">Texte werden vorbereitet</div>
          <div class="loading-subtitle">Die Sequenz wird gerade rephrased.</div>
        </div>

        <transition name="video-fade">
          <video
            v-if="showVideo && currentVideo"
            :key="videoKey"
            class="bg-video"
            :src="currentVideo"
            autoplay
            muted
            loop
            playsinline
          />
        </transition>

        <div v-if="showVideo" class="overlay" :class="{ faded: fading }">
          <div class="text">
            {{ displayText }}
          </div>

          <div class="debug">
            {{ displayFreq }} Hz · Vol {{ currentTone?.volume || "-" }} · Pan
            {{ currentTone?.pan ?? "-" }} · Estim {{ commandStatus }}
          </div>
        </div>

        <div v-if="showVideo" class="controls">
          <q-btn color="negative" label="Stop" @click="stopAll" />
        </div>
      </div>
    </q-dialog>

    <div v-if="!showVideo" class="start-screen">
      <div class="panel">
        <div class="title">Sound Sequence</div>
        <div class="subtitle">Bereit. Estim: {{ workerStatus }}</div>

        <q-input
          :model-value="estimPageUrl"
          label="Estim Page"
          dense
          outlined
          readonly
          dark
          class="link-input"
        >
          <template #append>
            <q-btn
              dense
              flat
              round
              icon="content_copy"
              @click="copyEstimLink"
            />
            <q-btn dense flat round icon="open_in_new" @click="openEstimPage" />
          </template>
        </q-input>

        <q-select
          v-model="selectedSequenceId"
          :options="sequenceOptions"
          label="Sequence"
          dense
          outlined
          emit-value
          map-options
          dark
          :loading="loadingSequences"
          :disable="isBusy || loadingSequences"
          class="select"
        />

        <div v-if="sequenceLoadError" class="sequence-error">
          {{ sequenceLoadError }}
        </div>

        <div class="panel-actions">
          <q-btn
            color="primary"
            label="Start"
            :loading="isBusy"
            :disable="isBusy || !isWorkerOnline"
            @click="startSelectedSequence"
          />
        </div>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import { Notify } from "quasar";
import { rephraseSequence } from "src/composables/rephraseTexts.js";
import { teaseSequence, videos } from "src/composables/soundDefaults.js";
import {
  loadSoundSequences,
  localDefaultSequences,
} from "src/composables/useSoundSequences.js";
import { useAuth } from "src/composables/useAuth.js";
import {
  completeEstimCommand,
  createEstimQueueId,
  enqueueEstimSequence,
  listenEstimCommand,
  listenEstimWorker,
} from "src/composables/useEstimQueue.js";

const personaDescription = `
Pam ist eine strenge, kontrollierte Dirigentin.
Sie spricht kurz, präzise, leicht spöttisch und fordernd.
Sie kommentiert Reaktionen ruhig, dominant und ohne lange Erklärungen.
`;

const mode = ref("idle");
const currentTone = ref(null);
const currentFreq = ref(440);
const fading = ref(false);
const showVideo = ref(false);
const videoKey = ref(0);
const showDialog = ref(false);
const commandStatus = ref("idle");
const workerState = ref(null);
const { uid } = useAuth();
const queueId = computed(() => createEstimQueueId(uid.value));
const activeCommandId = ref("");
const selectedSequenceId = ref(teaseSequence.id);
const sequences = ref(localDefaultSequences());
const loadingSequences = ref(false);
const sequenceLoadError = ref("");

let activeTimeouts = [];
let unsubscribeWorker = null;
let unsubscribeCommand = null;
let activeSequence = null;
let finishingSequence = false;

const sequenceOptions = computed(() =>
  sequences.value.map((sequence) => ({
    label: sequence.name,
    value: sequence.id,
  })),
);

const selectedSequence = computed(() => {
  return (
    sequences.value.find(
      (sequence) => sequence.id === selectedSequenceId.value,
    ) ||
    sequences.value[0] ||
    teaseSequence
  );
});

const displayFreq = computed(
  () => currentTone.value?.freq || currentFreq.value,
);
const displayText = computed(() => currentTone.value?.text || "Bereit.");
const currentVideo = computed(
  () => videos[currentTone.value?.mood] || videos.neutral,
);
const isRephrasing = computed(() => mode.value === "rephrase");
const isIntro = computed(() => mode.value === "intro");
const isWaitingForEstim = computed(() => mode.value === "waiting");
const isBusy = computed(
  () => isRephrasing.value || isIntro.value || isWaitingForEstim.value,
);
const isWorkerOnline = computed(() => workerState.value?.online === true);
const isWorkerReady = computed(
  () => isWorkerOnline.value && workerState.value?.audioReady === true,
);
const workerStatus = computed(() => {
  if (!queueId.value) return "login required";
  if (isWorkerReady.value) return "ready";
  if (isWorkerOnline.value) return "audio disabled";
  return "offline";
});
const estimPageUrl = computed(() => {
  return `${window.location.origin}${window.location.pathname}#/estim`;
});

function showTone(item) {
  fading.value = true;

  const timeout = setTimeout(() => {
    currentTone.value = item;
    currentFreq.value = item.freq;
    videoKey.value++;
    fading.value = false;

    if (item.text) {
      speakText(item.text).catch((error) => {
        console.warn("TTS failed:", error);
      });
    }
  }, 220);

  activeTimeouts.push(timeout);
}

async function startSelectedSequence() {
  if (isBusy.value || !queueId.value) return;

  await stopAll(false);
  showDialog.value = true;
  mode.value = "rephrase";
  showVideo.value = false;
  currentTone.value = null;

  let preparedSequence = selectedSequence.value;

  try {
    preparedSequence = await rephraseSequence(
      selectedSequence.value,
      personaDescription,
    );
  } catch (error) {
    console.error("Sequence rephrase failed:", error);
  }

  showSequenceIntro(preparedSequence);
  await waitForPaint();

  try {
    await speakText(preparedSequence.startMessage);
  } catch (error) {
    console.warn("TTS failed:", error);
  }

  const commandId = await enqueueEstimSequence(queueId.value, preparedSequence);
  activeCommandId.value = commandId;
  commandStatus.value = "queued";

  if (unsubscribeCommand) unsubscribeCommand();
  unsubscribeCommand = listenEstimCommand(
    queueId.value,
    commandId,
    (command) => {
      if (!command) {
        commandStatus.value = "done";
        finishSequence();
        return;
      }

      commandStatus.value = command.status || "pending";
    },
  );

  startSequence(preparedSequence);
}

function startSequence(sequence) {
  activeTimeouts.forEach((timeout) => clearTimeout(timeout));
  activeTimeouts = [];
  activeSequence = sequence;
  finishingSequence = false;

  showDialog.value = true;
  mode.value = "waiting";
  showVideo.value = true;

  const introDuration = 4;

  currentTone.value = {
    freq: "-",
    volume: "-",
    pan: "-",
    mood: "neutral",
    text: sequence.startMessage,
  };

  const steps = sequence.steps || [];

  steps.forEach((item) => {
    const timeout = setTimeout(
      () => {
        showTone(item);
      },
      (introDuration + item.t) * 1000,
    );

    activeTimeouts.push(timeout);
  });

  activeTimeouts.push(
    setTimeout(
      () => {
        commandStatus.value = "finishing";
      },
      Math.max(sequenceDuration(sequence) - 500, 0),
    ),
  );
}

function showSequenceIntro(sequence) {
  activeSequence = sequence;
  showDialog.value = true;
  mode.value = "intro";
  showVideo.value = true;
  fading.value = false;

  currentTone.value = {
    freq: "-",
    volume: "-",
    pan: "-",
    mood: "neutral",
    text: sequence.startMessage,
  };
}

async function waitForPaint() {
  await nextTick();
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

function sequenceDuration(sequence) {
  const steps = sequence.steps || [];
  const lastStep = steps[steps.length - 1];
  return (4 + (lastStep?.t || 0) + (lastStep?.dur || 0)) * 1000;
}

function finishSequence() {
  if (finishingSequence) return;
  finishingSequence = true;

  activeTimeouts.forEach((timeout) => clearTimeout(timeout));
  activeTimeouts = [];

  const endText = activeSequence?.endMessage || "Fertig.";

  showTone({
    freq: "-",
    volume: "-",
    pan: "-",
    mood: "neutral",
    text: endText,
  });

  const resetTimeout = setTimeout(() => {
    resetToStartScreen();
  }, 4000);

  activeTimeouts.push(resetTimeout);
}

function resetToStartScreen() {
  currentTone.value = null;
  mode.value = "idle";
  fading.value = false;
  showVideo.value = false;
  showDialog.value = false;
  activeCommandId.value = "";
  commandStatus.value = "idle";
  activeSequence = null;
  finishingSequence = false;

  activeTimeouts.forEach((timeout) => clearTimeout(timeout));
  activeTimeouts = [];

  if (unsubscribeCommand) {
    unsubscribeCommand();
    unsubscribeCommand = null;
  }
}

async function stopAll(removeCommand = true) {
  activeTimeouts.forEach((timeout) => clearTimeout(timeout));
  activeTimeouts = [];

  const commandId = activeCommandId.value;

  if (unsubscribeCommand) {
    unsubscribeCommand();
    unsubscribeCommand = null;
  }

  if (removeCommand && commandId) {
    await completeEstimCommand(queueId.value, commandId);
  }

  currentTone.value = null;
  mode.value = "idle";
  fading.value = false;
  showVideo.value = false;
  showDialog.value = false;
  activeCommandId.value = "";
  commandStatus.value = "idle";
  activeSequence = null;
  finishingSequence = false;
  window.speechSynthesis?.cancel();
}

function speakText(text) {
  if (!text || !window.speechSynthesis || !window.SpeechSynthesisUtterance) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "de-DE";
    utterance.rate = 0.92;
    utterance.pitch = 0.85;

    utterance.onend = resolve;
    utterance.onerror = reject;

    window.speechSynthesis.speak(utterance);
  });
}

async function copyEstimLink() {
  await navigator.clipboard.writeText(estimPageUrl.value);
  Notify.create({ type: "positive", message: "Estim link copied." });
}

function openEstimPage() {
  window.open(estimPageUrl.value, "_blank", "noopener,noreferrer");
}

async function loadSequences() {
  loadingSequences.value = true;
  sequenceLoadError.value = "";

  try {
    sequences.value = await loadSoundSequences();
    if (
      !sequences.value.some(
        (sequence) => sequence.id === selectedSequenceId.value,
      )
    ) {
      selectedSequenceId.value = sequences.value[0]?.id || teaseSequence.id;
    }
  } catch (error) {
    console.error("Could not load sound sequences:", error);
    sequences.value = localDefaultSequences();
    selectedSequenceId.value = sequences.value[0]?.id || teaseSequence.id;
    sequenceLoadError.value = "Firestore unavailable. Local defaults loaded.";
  } finally {
    loadingSequences.value = false;
  }
}

onMounted(() => {
  loadSequences();
  if (!queueId.value) return;

  unsubscribeWorker = listenEstimWorker(queueId.value, (state) => {
    workerState.value = state;
  });
});

onUnmounted(() => {
  if (unsubscribeWorker) unsubscribeWorker();
  if (unsubscribeCommand) unsubscribeCommand();
  window.speechSynthesis?.cancel();
});
</script>

<style scoped>
.page {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #050505;
  color: white;
}

.start-screen {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(
      circle at center,
      rgba(255, 255, 255, 0.08),
      rgba(0, 0, 0, 0.95)
    ),
    #050505;
}

.panel {
  width: min(92vw, 520px);
  padding: 32px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(18px);
  box-shadow: 0 20px 80px rgba(0, 0, 0, 0.45);
}

.title {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
}

.subtitle {
  margin-top: 8px;
  color: rgba(255, 255, 255, 0.72);
}

.link-input,
.select {
  margin-top: 18px;
}

.sequence-error {
  margin-top: 12px;
  color: #ffb4b4;
}

.panel-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 22px;
}

.column {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #050505;
}

.loading-screen {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: #050505;
  text-align: center;
}

.loading-title {
  font-size: 26px;
  font-weight: 700;
}

.loading-subtitle {
  color: rgba(255, 255, 255, 0.7);
}

.bg-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 30%;
}

.overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0 6vw 14vh;
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.08),
    rgba(0, 0, 0, 0.68)
  );
  transition: opacity 220ms ease;
}

.overlay.faded {
  opacity: 0.25;
}

.text {
  font-family: "Arial Rounded MT Bold", Arial, Helvetica, serif;
  max-width: 900px;
  color: #fff;
  font-size: clamp(34px, 7vw, 88px);
  font-weight: 800;
  line-height: 1.05;
  text-align: center;
  text-shadow: 0 4px 28px rgba(0, 0, 0, 0.85);
}

.debug {
  position: absolute;
  left: 24px;
  bottom: 24px;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.45);
  color: rgba(255, 255, 255, 0.78);
  font-size: 13px;
}

.controls {
  position: absolute;
  top: 24px;
  right: 24px;
  z-index: 5;
}

.video-fade-enter-active,
.video-fade-leave-active {
  transition: opacity 260ms ease;
}

.video-fade-enter-from,
.video-fade-leave-to {
  opacity: 0;
}
</style>
