<script setup>
import { ref, onBeforeUnmount } from "vue";
import { useWebcamAnalysis } from "src/composables/useWebcamAnalysis";
import {
  useRtdbCam,
  CAM_TYPES,
  CAM_LABELS,
  CAM_ICONS,
} from "src/composables/useRtdbCam";
import { useAuth } from "src/composables/useAuth";

const { uid } = useAuth();

const camType = ref("face");
const rtdbEnabled = ref(false);

const {
  videoRef,
  canvasRef,
  isRunning,
  isInitializing,
  fps,
  errorMessage,
  analysis,
  start,
  stop,
} = useWebcamAnalysis();

const { writeCount, lastWrittenAt, syncError } = useRtdbCam({
  uid,
  camType,
  analysis,
  enabled: rtdbEnabled,
});

onBeforeUnmount(() => {
  stop();
});
</script>

<template>
  <q-page class="q-pa-md webcam-page">
    <div class="page-shell">
      <div class="header-row">
        <div>
          <h1 class="title">Webcam Analyse</h1>
          <p class="subtitle">
            Face API + MediaPipe Analyse auf Live-Frames mit spiegelnder
            Vorschau.
          </p>
        </div>

        <div class="actions">
          <q-btn
            v-if="!isRunning"
            color="primary"
            icon="videocam"
            label="Webcam starten"
            :loading="isInitializing"
            @click="start"
          />
          <q-btn
            v-else
            color="negative"
            icon="stop"
            label="Stoppen"
            @click="stop"
          />
        </div>
      </div>

      <!-- Controls row -->
      <div class="controls q-mt-md q-pa-md">
        <div class="row q-col-gutter-md items-end">
          <!-- FPS -->
          <div class="col-12 col-sm-5">
            <div class="text-subtitle2 q-mb-sm">Analyse-FPS: {{ fps }}</div>
            <q-slider
              v-model="fps"
              :min="1"
              :max="10"
              :step="1"
              label
              label-always
            />
          </div>

          <!-- Cam type -->
          <div class="col-12 col-sm-4">
            <div class="text-subtitle2 q-mb-sm">Cam-Typ</div>
            <q-btn-toggle
              v-model="camType"
              spread
              :options="
                CAM_TYPES.map((t) => ({
                  value: t,
                  label: CAM_LABELS[t],
                  icon: CAM_ICONS[t],
                }))
              "
              toggle-color="primary"
              color="grey-3"
              text-color="grey-9"
              unelevated
            />
          </div>

          <!-- RTDB sync toggle -->
          <div class="col-12 col-sm-3 flex items-center q-gutter-x-sm">
            <q-toggle
              v-model="rtdbEnabled"
              :disable="!uid"
              icon="cloud_sync"
              color="primary"
              label="RTDB-Sync"
            />
            <q-chip
              v-if="rtdbEnabled"
              dense
              color="blue-1"
              text-color="blue-9"
              icon="upload"
            >
              {{ writeCount }}
            </q-chip>
          </div>
        </div>

        <!-- Sync meta line -->
        <div v-if="rtdbEnabled" class="sync-meta q-mt-sm">
          <span v-if="syncError" class="text-negative text-caption">
            <q-icon name="error_outline" size="14px" /> {{ syncError }}
          </span>
          <span v-else-if="lastWrittenAt" class="text-grey-7 text-caption">
            <q-icon
              name="check_circle_outline"
              size="14px"
              class="text-positive"
            />
            Letzter Write: {{ lastWrittenAt }}
          </span>
          <span v-else class="text-grey-6 text-caption"
            >Warte auf ersten Write…</span
          >
        </div>

        <div v-if="!uid" class="text-caption text-grey-6 q-mt-xs">
          <q-icon name="info" size="14px" /> Login erforderlich für RTDB-Sync.
        </div>
      </div>

      <q-banner
        v-if="errorMessage"
        class="bg-negative text-white q-mt-md"
        rounded
      >
        {{ errorMessage }}
      </q-banner>

      <div class="content-grid q-mt-md">
        <q-card flat bordered class="preview-card">
          <q-card-section class="q-pa-sm">
            <video
              ref="videoRef"
              autoplay
              playsinline
              muted
              class="hidden-video"
            />
            <canvas ref="canvasRef" class="preview-canvas" />
          </q-card-section>
        </q-card>

        <q-card flat bordered class="data-card">
          <q-card-section>
            <div class="text-h6">Reaktives Analyse-Objekt</div>
            <div class="text-caption text-grey-7 q-mt-xs">
              <q-icon name="cloud_sync" size="14px" />
              {{
                rtdbEnabled
                  ? `Sync aktiv → cams/${uid}/${camType}`
                  : "Sync deaktiviert"
              }}
            </div>
          </q-card-section>
          <q-separator />
          <q-card-section class="json-wrap">
            <pre>{{ JSON.stringify(analysis, null, 2) }}</pre>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<style scoped>
.webcam-page {
  background: radial-gradient(
    circle at 15% 15%,
    #f0f9ff,
    #f6f7fb 38%,
    #eff3ff 100%
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

.controls {
  background: #ffffffcc;
  backdrop-filter: blur(4px);
  border: 1px solid #e5ecf9;
  border-radius: 14px;
}

.content-grid {
  display: grid;
  grid-template-columns: 1.3fr 1fr;
  gap: 16px;
}

.preview-card,
.data-card {
  border-radius: 14px;
  background: #fff;
}

.hidden-video {
  display: none;
}

.preview-canvas {
  width: 100%;
  min-height: 280px;
  max-height: 72vh;
  object-fit: contain;
  border-radius: 10px;
  background: #0e1320;
}

.json-wrap {
  max-height: 520px;
  overflow: auto;
}

.sync-meta {
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 6px;
}

@media (max-width: 1024px) {
  .content-grid {
    grid-template-columns: 1fr;
  }

  .preview-canvas {
    max-height: 52vh;
  }
}
</style>
