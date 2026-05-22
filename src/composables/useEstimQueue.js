import { rtdb } from "src/boot/firebase";
import {
  ref as dbRef,
  onValue,
  push,
  remove,
  runTransaction,
  set,
  update,
} from "firebase/database";

export function createEstimQueueId(userId) {
  return userId ? `estim_${userId}` : "";
}

export function estimQueuePath(queueId) {
  return `estimQueues/${queueId}`;
}

export function estimCommandsPath(queueId) {
  return `${estimQueuePath(queueId)}/commands`;
}

export function estimCommandPath(queueId, commandId) {
  return `${estimCommandsPath(queueId)}/${commandId}`;
}

export async function registerEstimWorker(queueId) {
  await set(dbRef(rtdb, `${estimQueuePath(queueId)}/worker`), {
    online: true,
    audioReady: false,
    updatedAt: Date.now(),
  });
}

export async function setEstimWorkerAudioReady(queueId, audioReady) {
  await update(dbRef(rtdb, `${estimQueuePath(queueId)}/worker`), {
    audioReady,
    updatedAt: Date.now(),
  });
}

export async function unregisterEstimWorker(queueId) {
  await update(dbRef(rtdb, `${estimQueuePath(queueId)}/worker`), {
    online: false,
    audioReady: false,
    updatedAt: Date.now(),
  });
}

export function listenEstimWorker(queueId, callback) {
  const ref = dbRef(rtdb, `${estimQueuePath(queueId)}/worker`);
  const unsubscribe = onValue(ref, (snap) => {
    callback(snap.exists() ? snap.val() : null);
  });

  return () => {
    unsubscribe();
  };
}

export async function enqueueEstimSequence(queueId, sequence) {
  const commandRef = push(dbRef(rtdb, estimCommandsPath(queueId)));
  const command = {
    type: "estim-sequence",
    status: "pending",
    sequence,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await set(commandRef, command);

  return commandRef.key;
}

export function listenEstimCommand(queueId, commandId, callback) {
  const ref = dbRef(rtdb, estimCommandPath(queueId, commandId));
  const unsubscribe = onValue(ref, (snap) => {
    callback(snap.exists() ? { id: commandId, ...snap.val() } : null);
  });

  return () => {
    unsubscribe();
  };
}

export function listenEstimCommands(queueId, callback) {
  const ref = dbRef(rtdb, estimCommandsPath(queueId));
  const unsubscribe = onValue(ref, (snap) => {
    const commands = [];

    snap.forEach((child) => {
      commands.push({ id: child.key, ...child.val() });
    });

    commands.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    callback(commands);
  });

  return () => {
    unsubscribe();
  };
}

export async function claimEstimCommand(queueId, commandId) {
  const ref = dbRef(rtdb, estimCommandPath(queueId, commandId));
  const result = await runTransaction(ref, (command) => {
    if (!command || command.status !== "pending") return;

    return {
      ...command,
      status: "running",
      startedAt: Date.now(),
      updatedAt: Date.now(),
    };
  });

  if (!result.committed) return null;

  return result.snapshot.val();
}

export async function completeEstimCommand(queueId, commandId) {
  await remove(dbRef(rtdb, estimCommandPath(queueId, commandId)));
}

export async function clearEstimCommands(queueId) {
  await remove(dbRef(rtdb, estimCommandsPath(queueId)));
}
