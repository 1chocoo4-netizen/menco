// 마이크 RMS가 이 값을 넘으면 "말하는 중"으로 간주한다 (배경 잡음보다는 확실히 크게).
const SPEECH_RMS_THRESHOLD = 0.02;
// AI 목소리가 스피커로 나오는 동안에는 그 소리가 마이크로 다시 들어가(에코) Gemini가
// 자기 목소리를 사용자 말로 착각한다 — 스스로 말을 끊어 목소리가 뚝뚝 갈라지고, 자기
// 말에 대답하느라 대화가 점점 이상해진다(구글도 헤드폰 사용을 권장하는 알려진 문제).
// 그래서 AI 음성 재생 중에는 마이크 대신 무음을 보내고, 사용자가 이 크기 이상으로
// BARGE_IN_CHUNKS만큼(약 0.25초) 계속 말할 때만 끼어들기로 인정해 마이크를 연다.
const BARGE_IN_RMS_THRESHOLD = 0.07;
const BARGE_IN_CHUNKS = 8;
// 재생이 끝난 뒤에도 스피커 잔향이 잠깐 남으므로 이만큼 더 무음 처리한다.
const ECHO_TAIL_SEC = 0.3;
// 네트워크로 오는 음성 조각 사이가 조금만 벌어져도 "틱틱" 끊기지 않도록, 새로 재생을
// 시작할 때 이만큼 여유를 두고 시작한다.
const PLAYBACK_JITTER_SEC = 0.08;

const micButton = document.getElementById("micButton");
const statusEl = document.getElementById("status");
const bodyEl = document.body;
const finishButton = document.getElementById("finishButton");
const completionModal = document.getElementById("completionModal");
const modalCloseButton = document.getElementById("modalCloseButton");
const consentModal = document.getElementById("consentModal");
const consentAgreeButton = document.getElementById("consentAgreeButton");
const genderInputs = document.querySelectorAll('input[name="gender"]');
const ageInput = document.getElementById("ageInput");

function updateConsentButtonState() {
  const genderSelected = Array.from(genderInputs).some((el) => el.checked);
  const age = Number(ageInput.value.trim());
  const ageValid = /^\d{1,3}$/.test(ageInput.value.trim()) && age >= 1 && age <= 120;
  consentAgreeButton.disabled = !(genderSelected && ageValid);
}

ageInput.addEventListener("input", () => {
  ageInput.value = ageInput.value.replace(/[^0-9]/g, "");
  updateConsentButtonState();
});
genderInputs.forEach((el) => el.addEventListener("change", updateConsentButtonState));

let capturedGender = "unspecified";
let capturedAge = 0;

consentAgreeButton.addEventListener("click", () => {
  if (consentAgreeButton.disabled) return;

  const checked = Array.from(genderInputs).find((el) => el.checked);
  capturedGender = checked ? checked.value : "unspecified";
  capturedAge = Number(ageInput.value.trim());
  consentModal.hidden = true;
});

let ws = null;
let sessionActive = false;

let inputAudioContext = null;
let inputSourceNode = null;
let processorNode = null;
let micStream = null;

let outputAudioContext = null;
let nextStartTime = 0;
const activeSources = new Set();
let turnComplete = true;

function setState(state, message) {
  bodyEl.classList.remove("connecting", "listening", "speaking");
  if (state) bodyEl.classList.add(state);
  if (message !== undefined) statusEl.textContent = message;
}

function updateMicLevel(rms) {
  const level = Math.min(1, rms * 12);
  micButton.style.setProperty("--mic-level", level.toFixed(3));
}

function base64ToInt16(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}

function floatTo16BitPCM(float32Array) {
  const int16 = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16;
}

function playAudioChunk(base64Data) {
  if (outputAudioContext.state === "suspended") outputAudioContext.resume();

  const int16 = base64ToInt16(base64Data);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 0x8000;

  const buffer = outputAudioContext.createBuffer(1, float32.length, 24000);
  buffer.copyToChannel(float32, 0);

  const source = outputAudioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(outputAudioContext.destination);

  const now = outputAudioContext.currentTime;
  const startTime = nextStartTime > now ? nextStartTime : now + PLAYBACK_JITTER_SEC;
  source.start(startTime);
  nextStartTime = startTime + buffer.duration;

  activeSources.add(source);
  setState("speaking");

  source.onended = () => {
    activeSources.delete(source);
    if (activeSources.size === 0 && turnComplete && sessionActive) {
      setState("listening", "듣고 있어요...");
    }
  };
}

function stopPlayback() {
  for (const source of activeSources) {
    try {
      source.stop();
    } catch {
      // 이미 종료된 소스일 수 있음
    }
  }
  activeSources.clear();
  if (outputAudioContext) nextStartTime = outputAudioContext.currentTime;
}

// AI 음성이 (잔향 포함) 아직 스피커에서 나오고 있는지.
function isAiAudible() {
  if (!outputAudioContext) return false;
  return activeSources.size > 0 || nextStartTime + ECHO_TAIL_SEC > outputAudioContext.currentTime;
}

async function startMicCapture() {
  micStream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
  });

  inputAudioContext = new AudioContext({ sampleRate: 16000 });
  if (inputAudioContext.state === "suspended") await inputAudioContext.resume();

  const actualRate = inputAudioContext.sampleRate;
  console.log(`[마이크] 입력 오디오 컨텍스트 sampleRate: ${actualRate}`);

  inputSourceNode = inputAudioContext.createMediaStreamSource(micStream);
  // Gemini Live API는 지연을 줄이려면 20~40ms 단위로 오디오를 보내라고 권장한다.
  // 16kHz에서 512샘플 = 32ms.
  processorNode = inputAudioContext.createScriptProcessor(512, 1, 1);

  const silentGain = inputAudioContext.createGain();
  silentGain.gain.value = 0;

  ws.send(JSON.stringify({ type: "mic", sampleRate: actualRate }));

  let chunkCount = 0;
  let loudChunks = 0;
  let bargedIn = false;
  const recentChunks = []; // 끼어들기 인정 전까지 막아둔 최근 마이크 소리 (말 앞부분 보존)
  processorNode.onaudioprocess = (event) => {
    const input = event.inputBuffer.getChannelData(0);

    let sumSquares = 0;
    for (let i = 0; i < input.length; i++) sumSquares += input[i] * input[i];
    const rms = Math.sqrt(sumSquares / input.length);
    updateMicLevel(rms);

    if (!sessionActive || !ws || ws.readyState !== WebSocket.OPEN) return;
    const int16 = floatTo16BitPCM(input);

    // 서버로는 [1바이트 발화 플래그][16비트 PCM] 바이너리 프레임을 보낸다
    // (JSON+base64보다 브라우저·서버 CPU를 훨씬 덜 쓴다).
    const sendFrame = (pcm, speaking) => {
      const frame = new Uint8Array(1 + pcm.byteLength);
      frame[0] = speaking ? 1 : 0;
      frame.set(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength), 1);
      ws.send(frame.buffer);
    };

    if (isAiAudible() && !bargedIn) {
      loudChunks = rms > BARGE_IN_RMS_THRESHOLD ? loudChunks + 1 : 0;
      recentChunks.push(int16);
      if (recentChunks.length > BARGE_IN_CHUNKS) recentChunks.shift();
      if (loudChunks >= BARGE_IN_CHUNKS) {
        // 사용자가 AI 말 중간에 분명히 끼어들었다: 막아뒀던 앞부분부터 그대로 보낸다.
        bargedIn = true;
        for (const pcm of recentChunks) sendFrame(pcm, true);
        recentChunks.length = 0;
      } else {
        sendFrame(new Int16Array(int16.length), false);
      }
    } else {
      if (!isAiAudible()) bargedIn = false;
      loudChunks = 0;
      recentChunks.length = 0;
      // 서버가 "사용자가 말하는데 AI가 반응이 없는" 진짜 먹통을 감지할 수 있도록
      // 대략적인 발화 여부를 같이 보낸다.
      sendFrame(int16, rms > SPEECH_RMS_THRESHOLD);
    }
    chunkCount++;
    if (chunkCount % 300 === 0) console.log(`[마이크] ${chunkCount}개 청크 전송됨, RMS: ${rms.toFixed(4)}`);
  };

  inputSourceNode.connect(processorNode);
  processorNode.connect(silentGain);
  silentGain.connect(inputAudioContext.destination);

  setState("listening", "듣고 있어요...");
}

function stopMicCapture() {
  updateMicLevel(0);
  if (processorNode) processorNode.disconnect();
  if (inputSourceNode) inputSourceNode.disconnect();
  if (micStream) micStream.getTracks().forEach((track) => track.stop());
  if (inputAudioContext) inputAudioContext.close();
  processorNode = null;
  inputSourceNode = null;
  micStream = null;
  inputAudioContext = null;
}

function connect() {
  setState("connecting", "연결 중...");
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${protocol}://${location.host}/live`);

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: "start", gender: capturedGender, age: capturedAge }));
  };

  ws.onmessage = async (event) => {
    const msg = JSON.parse(event.data);

    switch (msg.type) {
      case "ready":
        try {
          await startMicCapture();
        } catch (err) {
          console.error("마이크 접근 실패:", err);
          setState(null, "마이크 접근이 거부됐어요.");
          endSession();
        }
        break;
      case "audio":
        turnComplete = false;
        playAudioChunk(msg.data);
        break;
      case "turnComplete":
        turnComplete = true;
        if (activeSources.size === 0) setState("listening", "듣고 있어요...");
        break;
      case "interrupted":
        stopPlayback();
        setState("listening", "듣고 있어요...");
        break;
      case "reconnecting":
        // 서버가 백그라운드에서 AI 세션을 다시 연결하는 중. 마이크와 연결은
        // 그대로 유지되니 계속 말씀하셔도 되고, 잠시 후 자동으로 이어집니다.
        setState("connecting", "연결이 잠시 불안정해요. 다시 연결하고 있어요...");
        break;
      case "reconnected":
        if (sessionActive) setState("listening", "다시 연결됐어요. 계속 말씀해주세요.");
        break;
      case "userText":
        break;
      case "modelText":
        break;
      case "showFinishButton":
        finishButton.hidden = false;
        break;
      case "error":
        console.error("서버 오류:", msg.message);
        setState(null, msg.message);
        endSession();
        break;
    }
  };

  ws.onerror = (err) => {
    console.error("WebSocket 오류:", err);
  };

  ws.onclose = () => {
    if (sessionActive) endSession();
  };
}

function endSession() {
  sessionActive = false;
  stopMicCapture();
  stopPlayback();
  if (ws) {
    ws.close();
    ws = null;
  }
  finishButton.hidden = true;
  setState(null, "버튼을 누르고 멘탈 코칭 대화를 시작해 보세요");
}

micButton.addEventListener("click", () => {
  if (!sessionActive) {
    sessionActive = true;
    if (!outputAudioContext) outputAudioContext = new AudioContext({ sampleRate: 24000 });
    outputAudioContext.resume();
    connect();
  } else {
    endSession();
  }
});

finishButton.addEventListener("click", () => {
  endSession();
  completionModal.hidden = false;
});

modalCloseButton.addEventListener("click", () => {
  completionModal.hidden = true;
});
