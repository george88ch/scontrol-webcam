import { reactive, ref, watch } from "vue";
import * as faceapi from "face-api.js";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

const FACE_MODEL_URL = `${import.meta.env.BASE_URL}models`;
const VISION_WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const POSE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function average(points) {
  if (!points.length) return { x: 0, y: 0 };
  const total = points.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 },
  );
  return { x: total.x / points.length, y: total.y / points.length };
}

function estimatePosture(landmarks) {
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const leftKnee = landmarks[25];
  const rightKnee = landmarks[26];
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];

  if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) {
    return "unknown";
  }

  const shoulderMid = average([leftShoulder, rightShoulder]);
  const hipMid = average([leftHip, rightHip]);

  const torsoDx = Math.abs(shoulderMid.x - hipMid.x);
  const torsoDy = Math.abs(shoulderMid.y - hipMid.y);

  if (torsoDx > torsoDy * 1.35) {
    return "lying";
  }

  if (!leftKnee || !rightKnee || !leftAnkle || !rightAnkle) {
    return "unknown";
  }

  const kneeMid = average([leftKnee, rightKnee]);
  const ankleMid = average([leftAnkle, rightAnkle]);

  const standingOrder = hipMid.y < kneeMid.y && kneeMid.y < ankleMid.y;
  const kneelPosition =
    hipMid.y < kneeMid.y && Math.abs(kneeMid.y - ankleMid.y) < 0.08;
  const sitPosition =
    Math.abs(hipMid.y - kneeMid.y) < 0.08 && ankleMid.y > kneeMid.y + 0.04;

  if (standingOrder) return "standing";
  if (sitPosition) return "sitting";
  if (kneelPosition) return "kneeling";

  return "unknown";
}

export function useWebcamAnalysis() {
  const videoRef = ref(null);
  const canvasRef = ref(null);

  const isRunning = ref(false);
  const isInitializing = ref(false);
  const fps = ref(5);
  const errorMessage = ref("");

  const targetPoint = reactive({
    xRatio: 0.5,
    yRatio: 0.4,
    tolerancePx: 70,
  });

  const motionRegion = reactive({
    xRatio: 0.3,
    yRatio: 0.2,
    widthRatio: 0.4,
    heightRatio: 0.55,
  });

  const analysis = reactive({
    meta: {
      fps,
      updatedAt: null,
      faceApiReady: false,
      mediapipeReady: false,
    },
    face: {
      visible: false,
      mouthOpen: false,
      gazeDirection: "unknown",
      lookingAtTarget: false,
      targetPoint,
    },
    pose: {
      upperBodyVisible: false,
      fullBodyVisible: false,
      rightHandRaised: false,
      leftHandRaised: false,
      bothHandsRaised: false,
      legsSpread: false,
      posture: "unknown",
    },
    movement: {
      visible: false,
      level: 0,
      regionVisible: false,
      regionLevel: 0,
      region: motionRegion,
    },
  });

  let stream = null;
  let drawAnimation = 0;
  let analysisTimer = 0;
  let poseLandmarker = null;
  let isAnalyzing = false;
  let detectorsReady = false;

  let motionCanvas = null;
  let motionCtx = null;
  let previousGrayFrame = null;

  function ensureMotionBuffer() {
    if (motionCanvas && motionCtx) return;

    motionCanvas = document.createElement("canvas");
    motionCanvas.width = 64;
    motionCanvas.height = 48;
    motionCtx = motionCanvas.getContext("2d", { willReadFrequently: true });
  }

  async function initDetectors() {
    if (detectorsReady) return;

    await faceapi.tf.ready();
    try {
      await faceapi.tf.setBackend("webgl");
    } catch {
      await faceapi.tf.setBackend("cpu");
    }

    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_URL),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(FACE_MODEL_URL),
    ]);

    const vision = await FilesetResolver.forVisionTasks(VISION_WASM_URL);
    poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: POSE_MODEL_URL,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numPoses: 1,
    });

    detectorsReady = true;
    analysis.meta.faceApiReady = true;
    analysis.meta.mediapipeReady = true;
  }

  function resizeCanvas(video, canvas) {
    if (!video.videoWidth || !video.videoHeight) return;
    if (
      canvas.width !== video.videoWidth ||
      canvas.height !== video.videoHeight
    ) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
  }

  function drawOverlay(ctx, canvas) {
    const targetX = canvas.width * targetPoint.xRatio;
    const targetY = canvas.height * targetPoint.yRatio;
    const mirroredX = canvas.width - targetX;

    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(mirroredX, targetY, targetPoint.tolerancePx, 0, Math.PI * 2);
    ctx.stroke();

    const regionX = canvas.width * motionRegion.xRatio;
    const regionY = canvas.height * motionRegion.yRatio;
    const regionW = canvas.width * motionRegion.widthRatio;
    const regionH = canvas.height * motionRegion.heightRatio;
    const mirroredRegionX = canvas.width - regionX - regionW;

    ctx.strokeStyle = "rgba(76, 175, 80, 0.85)";
    ctx.strokeRect(mirroredRegionX, regionY, regionW, regionH);
    ctx.restore();
  }

  function drawFrame() {
    const video = videoRef.value;
    const canvas = canvasRef.value;
    if (!isRunning.value || !video || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    resizeCanvas(video, canvas);

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    drawOverlay(ctx, canvas);
    drawAnimation = window.requestAnimationFrame(drawFrame);
  }

  function estimateGaze(landmarks, videoWidth, videoHeight) {
    const leftEye = average(landmarks.slice(36, 42));
    const rightEye = average(landmarks.slice(42, 48));
    const eyeMid = average([leftEye, rightEye]);
    const nose = landmarks[30];

    const interEye = Math.max(distance(leftEye, rightEye), 1);
    const yaw = (nose.x - eyeMid.x) / interEye;
    const pitch = (nose.y - eyeMid.y) / interEye;

    const normX = clamp(0.5 + yaw * 0.35, 0, 1);
    const normY = clamp(0.45 + pitch * 0.35, 0, 1);

    let direction = "center";
    if (yaw > 0.12) direction = "right";
    if (yaw < -0.12) direction = "left";
    if (pitch > 0.22) direction = "down";
    if (pitch < -0.22) direction = "up";

    const gazePoint = {
      x: normX * videoWidth,
      y: normY * videoHeight,
    };

    const target = {
      x: targetPoint.xRatio * videoWidth,
      y: targetPoint.yRatio * videoHeight,
    };

    const lookingAtTarget =
      distance(gazePoint, target) <= targetPoint.tolerancePx;

    return { direction, lookingAtTarget };
  }

  async function detectFace(video) {
    const detection = await faceapi
      .detectSingleFace(
        video,
        new faceapi.TinyFaceDetectorOptions({
          inputSize: 224,
          scoreThreshold: 0.5,
        }),
      )
      .withFaceLandmarks(true);

    if (!detection) {
      analysis.face.visible = false;
      analysis.face.mouthOpen = false;
      analysis.face.gazeDirection = "unknown";
      analysis.face.lookingAtTarget = false;
      return;
    }

    const points = detection.landmarks.positions;
    const mouthVertical = distance(points[62], points[66]);
    const mouthHorizontal = Math.max(distance(points[60], points[64]), 1);
    const mouthRatio = mouthVertical / mouthHorizontal;

    const gaze = estimateGaze(points, video.videoWidth, video.videoHeight);

    analysis.face.visible = true;
    analysis.face.mouthOpen = mouthRatio > 0.24;
    analysis.face.gazeDirection = gaze.direction;
    analysis.face.lookingAtTarget = gaze.lookingAtTarget;
  }

  function detectPose(video) {
    if (!poseLandmarker) return;
    const result = poseLandmarker.detectForVideo(video, performance.now());
    const landmarks = result.landmarks?.[0];

    if (!landmarks) {
      analysis.pose.upperBodyVisible = false;
      analysis.pose.fullBodyVisible = false;
      analysis.pose.rightHandRaised = false;
      analysis.pose.leftHandRaised = false;
      analysis.pose.bothHandsRaised = false;
      analysis.pose.legsSpread = false;
      analysis.pose.posture = "unknown";
      return;
    }

    const isVisible = (index, threshold = 0.45) =>
      (landmarks[index]?.visibility ?? 0) > threshold;

    const shoulderVisible = isVisible(11) && isVisible(12);
    const hipVisible = isVisible(23) && isVisible(24);
    const kneeVisible = isVisible(25) && isVisible(26);
    const ankleVisible = isVisible(27) && isVisible(28);

    analysis.pose.upperBodyVisible = shoulderVisible && hipVisible;
    analysis.pose.fullBodyVisible =
      analysis.pose.upperBodyVisible && kneeVisible && ankleVisible;

    const leftHandRaised =
      isVisible(15) &&
      isVisible(11) &&
      landmarks[15].y < landmarks[11].y - 0.05;
    const rightHandRaised =
      isVisible(16) &&
      isVisible(12) &&
      landmarks[16].y < landmarks[12].y - 0.05;

    analysis.pose.leftHandRaised = leftHandRaised;
    analysis.pose.rightHandRaised = rightHandRaised;
    analysis.pose.bothHandsRaised = leftHandRaised && rightHandRaised;

    const shoulderSpan = Math.max(
      Math.abs((landmarks[11]?.x ?? 0) - (landmarks[12]?.x ?? 0)),
      0.001,
    );
    const ankleSpan = Math.abs(
      (landmarks[27]?.x ?? 0) - (landmarks[28]?.x ?? 0),
    );

    analysis.pose.legsSpread = ankleSpan > shoulderSpan * 1.25;
    analysis.pose.posture = estimatePosture(landmarks);
  }

  function detectMovement(video) {
    ensureMotionBuffer();
    if (!motionCtx) return;

    motionCtx.drawImage(video, 0, 0, motionCanvas.width, motionCanvas.height);
    const imageData = motionCtx.getImageData(
      0,
      0,
      motionCanvas.width,
      motionCanvas.height,
    );

    const gray = new Uint8Array(motionCanvas.width * motionCanvas.height);
    const data = imageData.data;

    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
      gray[p] = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
    }

    if (!previousGrayFrame) {
      previousGrayFrame = gray;
      analysis.movement.visible = false;
      analysis.movement.level = 0;
      analysis.movement.regionVisible = false;
      analysis.movement.regionLevel = 0;
      return;
    }

    let changed = 0;
    let changedRegion = 0;
    let regionPixels = 0;

    const regionLeft = Math.floor(motionCanvas.width * motionRegion.xRatio);
    const regionTop = Math.floor(motionCanvas.height * motionRegion.yRatio);
    const regionRight = Math.floor(
      motionCanvas.width * (motionRegion.xRatio + motionRegion.widthRatio),
    );
    const regionBottom = Math.floor(
      motionCanvas.height * (motionRegion.yRatio + motionRegion.heightRatio),
    );

    for (let y = 0; y < motionCanvas.height; y += 1) {
      for (let x = 0; x < motionCanvas.width; x += 1) {
        const index = y * motionCanvas.width + x;
        const delta = Math.abs(gray[index] - previousGrayFrame[index]);

        if (delta > 20) {
          changed += 1;
          if (
            x >= regionLeft &&
            x < regionRight &&
            y >= regionTop &&
            y < regionBottom
          ) {
            changedRegion += 1;
          }
        }

        if (
          x >= regionLeft &&
          x < regionRight &&
          y >= regionTop &&
          y < regionBottom
        ) {
          regionPixels += 1;
        }
      }
    }

    const totalPixels = gray.length;
    const movementLevel = changed / totalPixels;
    const regionLevel = regionPixels > 0 ? changedRegion / regionPixels : 0;

    analysis.movement.visible = movementLevel > 0.02;
    analysis.movement.level = Number(movementLevel.toFixed(4));
    analysis.movement.regionVisible = regionLevel > 0.02;
    analysis.movement.regionLevel = Number(regionLevel.toFixed(4));

    previousGrayFrame = gray;
  }

  async function runAnalysisStep() {
    if (isAnalyzing || !isRunning.value) return;

    const video = videoRef.value;
    if (!video || video.readyState < 2) return;

    isAnalyzing = true;

    try {
      let stepHasError = false;

      try {
        await detectFace(video);
      } catch (error) {
        stepHasError = true;
        analysis.face.visible = false;
        analysis.face.mouthOpen = false;
        analysis.face.gazeDirection = "unknown";
        analysis.face.lookingAtTarget = false;
        analysis.meta.faceApiReady = false;
        errorMessage.value =
          error instanceof Error
            ? error.message
            : "Face-Analyse fehlgeschlagen.";
      }

      try {
        detectPose(video);
      } catch (error) {
        stepHasError = true;
        analysis.pose.upperBodyVisible = false;
        analysis.pose.fullBodyVisible = false;
        analysis.pose.rightHandRaised = false;
        analysis.pose.leftHandRaised = false;
        analysis.pose.bothHandsRaised = false;
        analysis.pose.legsSpread = false;
        analysis.pose.posture = "unknown";
        analysis.meta.mediapipeReady = false;
        errorMessage.value =
          error instanceof Error
            ? error.message
            : "Pose-Analyse fehlgeschlagen.";
      }

      try {
        detectMovement(video);
      } catch (error) {
        stepHasError = true;
        analysis.movement.visible = false;
        analysis.movement.level = 0;
        analysis.movement.regionVisible = false;
        analysis.movement.regionLevel = 0;
        errorMessage.value =
          error instanceof Error
            ? error.message
            : "Bewegungsanalyse fehlgeschlagen.";
      }

      if (!stepHasError) {
        errorMessage.value = "";
      }

      analysis.meta.updatedAt = new Date().toISOString();
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : "Analyse fehlgeschlagen.";
    } finally {
      isAnalyzing = false;
    }
  }

  function startAnalysisLoop() {
    if (analysisTimer) {
      window.clearInterval(analysisTimer);
      analysisTimer = 0;
    }

    const interval = Math.max(100, Math.floor(1000 / fps.value));
    analysisTimer = window.setInterval(() => {
      void runAnalysisStep();
    }, interval);
  }

  async function start() {
    if (isRunning.value || isInitializing.value) return;

    errorMessage.value = "";
    isInitializing.value = true;

    try {
      await initDetectors();

      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
        },
        audio: false,
      });

      const video = videoRef.value;
      if (!video) {
        throw new Error("Video-Element wurde nicht gefunden.");
      }

      video.srcObject = stream;
      await video.play();

      previousGrayFrame = null;
      isRunning.value = true;
      drawFrame();
      startAnalysisLoop();
    } catch (error) {
      errorMessage.value =
        error instanceof Error
          ? error.message
          : "Webcam konnte nicht gestartet werden.";
      stop();
    } finally {
      isInitializing.value = false;
    }
  }

  function stop() {
    if (drawAnimation) {
      window.cancelAnimationFrame(drawAnimation);
      drawAnimation = 0;
    }

    if (analysisTimer) {
      window.clearInterval(analysisTimer);
      analysisTimer = 0;
    }

    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }

    const video = videoRef.value;
    if (video) {
      video.pause();
      video.srcObject = null;
    }

    isRunning.value = false;
    previousGrayFrame = null;
  }

  watch(fps, () => {
    if (isRunning.value) {
      startAnalysisLoop();
    }
  });

  return {
    videoRef,
    canvasRef,
    isRunning,
    isInitializing,
    fps,
    errorMessage,
    analysis,
    start,
    stop,
  };
}
