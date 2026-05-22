<template>
  <q-page padding class="admin-page">
    <div class="page-head">
      <div>
        <div class="text-h5">Sound Sequences Admin</div>
        <div class="text-body2 text-grey-7">
          Manage Firestore sequences and editable defaults.
        </div>
      </div>
      <div class="row q-gutter-sm">
        <q-btn flat icon="refresh" label="Reload" :loading="loading" @click="loadAll" />
        <q-btn
          color="primary"
          icon="playlist_add"
          label="Seed defaults"
          :loading="saving"
          @click="seedDefaults"
        />
      </div>
    </div>

    <div class="row q-col-gutter-md q-mt-md">
      <div class="col-12 col-md-4">
        <q-card flat bordered class="panel">
          <div class="row items-center justify-between q-mb-md">
            <div class="text-subtitle1">Sequences</div>
            <q-btn dense round flat icon="add" @click="newSequence" />
          </div>

          <q-list bordered separator>
            <q-item
              v-for="sequence in sequences"
              :key="sequence.id"
              clickable
              :active="selectedSequenceId === sequence.id"
              active-class="bg-primary text-white"
              @click="selectSequence(sequence)"
            >
              <q-item-section>
                <q-item-label>{{ sequence.name }}</q-item-label>
                <q-item-label caption>
                  {{ sequence.id }} · {{ sequence.steps?.length || 0 }} steps
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-badge :color="sequence.active === false ? 'grey' : 'positive'">
                  {{ sequence.active === false ? "inactive" : "active" }}
                </q-badge>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card>
      </div>

      <div class="col-12 col-md-8">
        <q-card flat bordered class="panel q-mb-md">
          <div class="row items-center justify-between q-mb-md">
            <div>
              <div class="text-subtitle1">AI Sequence Generator</div>
              <div class="text-caption text-grey-7">
                Generates a draft and loads it into the sequence editor.
              </div>
            </div>
            <q-btn
              color="secondary"
              icon="auto_awesome"
              label="Generate"
              :loading="generating"
              @click="generateSequenceDraft"
            />
          </div>

          <div class="row q-col-gutter-md">
            <div class="col-12 col-sm-6">
              <q-input v-model="aiTitle" label="Title" outlined dense />
            </div>
            <div class="col-12 col-sm-6">
              <q-input
                v-model.number="aiDuration"
                label="Duration seconds"
                type="number"
                outlined
                dense
              />
            </div>
            <div class="col-12">
              <q-input
                v-model="aiTheme"
                label="Thema"
                type="textarea"
                outlined
                autogrow
              />
            </div>
            <div class="col-12">
              <q-input
                v-model="aiPersona"
                label="Persona"
                type="textarea"
                outlined
                autogrow
              />
            </div>
          </div>
        </q-card>

        <q-card flat bordered class="panel q-mb-md">
          <div class="row items-center justify-between q-mb-md">
            <div>
              <div class="text-subtitle1">Sequence JSON</div>
              <div class="text-caption text-grey-7">
                Saved to <code>soundSequences/&lt;id&gt;</code>
              </div>
            </div>
            <div class="row q-gutter-sm">
              <q-btn
                color="negative"
                flat
                icon="delete"
                label="Delete"
                :disable="!selectedSequenceId"
                @click="deleteSelected"
              />
              <q-btn
                color="primary"
                icon="save"
                label="Save sequence"
                :loading="saving"
                @click="saveSequenceJson"
              />
            </div>
          </div>

          <q-input
            v-model="sequenceJson"
            type="textarea"
            outlined
            autogrow
            class="json-editor"
            spellcheck="false"
          />
        </q-card>

        <q-card flat bordered class="panel">
          <div class="row items-center justify-between q-mb-md">
            <div>
              <div class="text-subtitle1">Defaults Config JSON</div>
              <div class="text-caption text-grey-7">
                Saved to <code>config/soundDefaults</code>
              </div>
            </div>
            <q-btn
              color="primary"
              icon="save"
              label="Save defaults"
              :loading="saving"
              @click="saveDefaultsJson"
            />
          </div>

          <q-input
            v-model="defaultsJson"
            type="textarea"
            outlined
            autogrow
            class="json-editor"
            spellcheck="false"
          />
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { Notify } from "quasar";
import { generateSoundSequence } from "src/composables/generateSoundSequence.js";
import {
  deleteSoundSequence,
  loadAdminSoundSequences,
  loadSoundDefaultsDoc,
  localDefaultSequences,
  saveSoundDefaultsDoc,
  saveSoundSequence,
  seedSoundSequencesFromDefaults,
  validateSequence,
} from "src/composables/useSoundSequences.js";

const loading = ref(false);
const saving = ref(false);
const generating = ref(false);
const sequences = ref([]);
const selectedSequenceId = ref("");
const sequenceJson = ref("");
const defaultsJson = ref("");
const aiTitle = ref("Neue Sequenz");
const aiTheme = ref("Aufmerksamkeit, Kontrolle und steigende Spannung");
const aiDuration = ref(90);
const aiPersona = ref(`Pam ist eine strenge, kontrollierte Dirigentin.
Sie spricht kurz, präzise, leicht spöttisch und fordernd.
Sie kommentiert Reaktionen ruhig, dominant und ohne lange Erklärungen.`);

function stringifyJson(value) {
  return JSON.stringify(value, null, 2);
}

async function loadAll() {
  loading.value = true;
  try {
    const [loadedSequences, defaultsDoc] = await Promise.all([
      loadAdminSoundSequences(),
      loadSoundDefaultsDoc(),
    ]);

    sequences.value = loadedSequences;
    defaultsJson.value = stringifyJson(defaultsDoc);

    if (loadedSequences.length > 0) {
      selectSequence(loadedSequences[0]);
    } else {
      newSequence();
    }
  } catch (error) {
    console.error("Could not load sound sequences:", error);
    Notify.create({ type: "negative", message: "Sequences could not be loaded." });
  } finally {
    loading.value = false;
  }
}

function selectSequence(sequence) {
  selectedSequenceId.value = sequence.id;
  sequenceJson.value = stringifyJson(stripFirestoreFields(sequence));
}

function stripFirestoreFields(sequence) {
  const { firestoreId, createdAt, updatedAt, ...clean } = sequence;
  return clean;
}

function newSequence() {
  const template = {
    id: `sequence-${Date.now()}`,
    name: "New Sequence",
    active: true,
    order: sequences.value.length + 1,
    startMessage: "Bereit?",
    endMessage: "Fertig.",
    steps: [
      {
        t: 0,
        dur: 5,
        freq: 220,
        volume: 1,
        pan: 0,
        mood: "neutral",
        text: "Start.",
      },
    ],
  };

  selectedSequenceId.value = "";
  sequenceJson.value = stringifyJson(template);
}

async function saveSequenceJson() {
  saving.value = true;
  try {
    const sequence = JSON.parse(sequenceJson.value);
    validateSequence(sequence);
    await saveSoundSequence(sequence);
    Notify.create({ type: "positive", message: "Sequence saved." });
    await loadAll();
    selectSequence(sequence);
  } catch (error) {
    console.error("Could not save sequence:", error);
    Notify.create({
      type: "negative",
      message: error?.message || "Sequence could not be saved.",
    });
  } finally {
    saving.value = false;
  }
}

async function saveDefaultsJson() {
  saving.value = true;
  try {
    const defaults = JSON.parse(defaultsJson.value);
    if (!Array.isArray(defaults.sequences)) {
      throw new Error("Defaults require a sequences array.");
    }
    defaults.sequences.forEach(validateSequence);
    await saveSoundDefaultsDoc(defaults);
    Notify.create({ type: "positive", message: "Defaults saved." });
  } catch (error) {
    console.error("Could not save defaults:", error);
    Notify.create({
      type: "negative",
      message: error?.message || "Defaults could not be saved.",
    });
  } finally {
    saving.value = false;
  }
}

async function seedDefaults() {
  saving.value = true;
  try {
    const defaults = JSON.parse(defaultsJson.value || "{}");
    const safeDefaults = Array.isArray(defaults.sequences)
      ? defaults
      : { sequences: localDefaultSequences() };

    await saveSoundDefaultsDoc(safeDefaults);
    await seedSoundSequencesFromDefaults(safeDefaults);
    Notify.create({ type: "positive", message: "Defaults seeded." });
    await loadAll();
  } catch (error) {
    console.error("Could not seed defaults:", error);
    Notify.create({ type: "negative", message: "Defaults could not be seeded." });
  } finally {
    saving.value = false;
  }
}

async function deleteSelected() {
  if (!selectedSequenceId.value) return;

  saving.value = true;
  try {
    await deleteSoundSequence(selectedSequenceId.value);
    Notify.create({ type: "positive", message: "Sequence deleted." });
    await loadAll();
  } catch (error) {
    console.error("Could not delete sequence:", error);
    Notify.create({ type: "negative", message: "Sequence could not be deleted." });
  } finally {
    saving.value = false;
  }
}

async function generateSequenceDraft() {
  generating.value = true;
  try {
    const sequence = await generateSoundSequence({
      title: aiTitle.value,
      theme: aiTheme.value,
      duration: `${aiDuration.value} Sekunden`,
      persona: aiPersona.value,
    });

    selectedSequenceId.value = "";
    sequenceJson.value = stringifyJson(sequence);
    Notify.create({
      type: "positive",
      message: "AI sequence draft generated.",
    });
  } catch (error) {
    console.error("Could not generate sequence:", error);
    Notify.create({
      type: "negative",
      message: error?.message || "Sequence generation failed.",
    });
  } finally {
    generating.value = false;
  }
}

onMounted(loadAll);
</script>

<style scoped>
.admin-page {
  background: #f6f7f9;
}

.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.panel {
  padding: 18px;
}

.json-editor :deep(textarea) {
  min-height: 260px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  line-height: 1.45;
}
</style>
