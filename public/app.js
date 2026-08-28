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

function int16ToBase64(int16Array) {
  const bytes = new Uint8Array(int16Array.buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
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

  console.log(`[재생] ${float32.length}샘플 수신 (ctx state: ${outputAudioContext.state})`);

  const buffer = outputAudioContext.createBuffer(1, float32.length, 24000);
  buffer.copyToChannel(float32, 0);

  const source = outputAudioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(outputAudioContext.destination);

  const now = outputAudioContext.currentTime;
  const startTime = Math.max(now, nextStartTime);
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

async function startMicCapture() {
  micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

  inputAudioContext = new AudioContext({ sampleRate: 16000 });
  if (inputAudioContext.state === "suspended") await inputAudioContext.resume();

  const actualRate = inputAudioContext.sampleRate;
  console.log(`[마이크] 입력 오디오 컨텍스트 sampleRate: ${actualRate}`);

  inputSourceNode = inputAudioContext.createMediaStreamSource(micStream);
  processorNode = inputAudioContext.createScriptProcessor(2048, 1, 1);

  const silentGain = inputAudioContext.createGain();
  silentGain.gain.value = 0;

  let chunkCount = 0;
  processorNode.onaudioprocess = (event) => {
    const input = event.inputBuffer.getChannelData(0);

    let sumSquares = 0;
    for (let i = 0; i < input.length; i++) sumSquares += input[i] * input[i];
    const rms = Math.sqrt(sumSquares / input.length);
    updateMicLevel(rms);

    if (!sessionActive || !ws || ws.readyState !== WebSocket.OPEN) return;
    const int16 = floatTo16BitPCM(input);
    ws.send(
      JSON.stringify({
        type: "audio",
        data: int16ToBase64(int16),
        sampleRate: actualRate,
      })
    );
    chunkCount++;
    if (chunkCount % 10 === 0) console.log(`[마이크] ${chunkCount}개 청크 전송됨, RMS: ${rms.toFixed(4)}`);
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
  setState(null, "버튼을 누르고 멘탈 대화를 시작해 보세요");
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
