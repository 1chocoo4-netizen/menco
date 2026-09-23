// 음성은 브라우저 ↔ OpenAI Realtime이 WebRTC로 직접 주고받는다. 서버(/session)는
// 짧게 유효한 인증 토큰만 발급한다. WebRTC 통화 음성에는 브라우저의 에코 제거가
// 제대로 적용되어, AI가 스피커로 나온 자기 목소리를 사용자 말로 착각하지 않는다.
const REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";

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

let sessionActive = false;
let pc = null;
let dc = null;
let micStream = null;
let remoteAudio = null;
let levelContext = null;
let levelFrame = null;
let pacingTimer = null;

// 음성 AI는 시간이 얼마나 흘렀는지 스스로 알 수 없어서, 코칭을 몇 번 주고받다 서둘러 끝내버리곤
// 한다. 5분마다 경과 시간을 (말하지 않는) 시스템 메모로 알려줘서 20~30분 세션의 속도를 조절하게 한다.
const PACING_INTERVAL_MIN = 5;

function startPacingNotes() {
  let elapsedMin = 0;
  pacingTimer = setInterval(() => {
    elapsedMin += PACING_INTERVAL_MIN;
    let hint;
    if (elapsedMin < 15) hint = "아직 세션 초중반이다. 서두르지 말고 현재 단계에서 충분히 깊이 탐색한다.";
    else if (elapsedMin < 25) hint = "세션 중후반이다. 대안 탐색과 실행 계획으로 자연스럽게 나아간다.";
    else hint = "세션 후반이다. 실행 의지를 확인하고 마무리 단계로 이끈다.";
    sendEvent({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "system",
        content: [{ type: "input_text", text: `[진행 시간 안내 — 고객에게 말하지 말 것] 코칭 시작 후 약 ${elapsedMin}분 경과. ${hint}` }],
      },
    });
  }, PACING_INTERVAL_MIN * 60 * 1000);
}

function setState(state, message) {
  bodyEl.classList.remove("connecting", "listening", "speaking");
  if (state) bodyEl.classList.add(state);
  if (message !== undefined) statusEl.textContent = message;
}

function updateMicLevel(rms) {
  const level = Math.min(1, rms * 12);
  micButton.style.setProperty("--mic-level", level.toFixed(3));
}

function startMicLevelMeter(stream) {
  levelContext = new AudioContext();
  const analyser = levelContext.createAnalyser();
  analyser.fftSize = 1024;
  levelContext.createMediaStreamSource(stream).connect(analyser);
  const samples = new Float32Array(analyser.fftSize);
  const tick = () => {
    analyser.getFloatTimeDomainData(samples);
    let sumSquares = 0;
    for (let i = 0; i < samples.length; i++) sumSquares += samples[i] * samples[i];
    updateMicLevel(Math.sqrt(sumSquares / samples.length));
    levelFrame = requestAnimationFrame(tick);
  };
  tick();
}

function sendEvent(event) {
  if (dc && dc.readyState === "open") dc.send(JSON.stringify(event));
}

// 마무리 함수 호출이 담긴 응답에 음성이 없었다면, 모델이 이어서 말하도록 응답을 요청한다.
let wrapUpCallId = null;

function handleServerEvent(event) {
  switch (event.type) {
    case "output_audio_buffer.started":
      setState("speaking");
      break;
    case "output_audio_buffer.stopped":
    case "output_audio_buffer.cleared":
      if (sessionActive) setState("listening", "듣고 있어요...");
      break;
    case "response.function_call_arguments.done":
      if (event.name === "mark_coaching_wrap_up") {
        console.log("[멘코] 코칭 마무리 단계 진입 신호 수신");
        finishButton.hidden = false;
      }
      wrapUpCallId = event.call_id;
      sendEvent({
        type: "conversation.item.create",
        item: { type: "function_call_output", call_id: event.call_id, output: JSON.stringify({ ok: true }) },
      });
      break;
    case "response.done": {
      const output = event.response?.output ?? [];
      const hadFunctionCall = output.some((item) => item.type === "function_call" && item.call_id === wrapUpCallId);
      const hadSpeech = output.some((item) => item.type === "message");
      if (hadFunctionCall && !hadSpeech) sendEvent({ type: "response.create" });
      if (hadFunctionCall) wrapUpCallId = null;
      break;
    }
    case "error":
      console.error("[멘코] Realtime 오류:", event.error);
      break;
  }
}

async function startSession() {
  setState("connecting", "연결 중...");

  const tokenRes = await fetch("/session", { method: "POST" });
  const tokenData = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenData.clientSecret) {
    throw new Error(tokenData.error || "AI 연결을 준비하지 못했어요.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  if (!sessionActive) {
    // 마이크 권한을 기다리는 사이 사용자가 종료했다면 마이크를 바로 끈다.
    stream.getTracks().forEach((track) => track.stop());
    return;
  }
  micStream = stream;

  pc = new RTCPeerConnection();
  pc.ontrack = (event) => {
    remoteAudio.srcObject = event.streams[0];
  };
  pc.onconnectionstatechange = () => {
    if (!sessionActive || !pc) return;
    const state = pc.connectionState;
    if (state === "disconnected") {
      // 잠깐의 네트워크 흔들림은 WebRTC가 스스로 복구한다.
      setState("connecting", "연결이 잠시 불안정해요...");
    } else if (state === "connected") {
      setState("listening", "듣고 있어요...");
    } else if (state === "failed") {
      endSession("연결이 끊어졌어요. 버튼을 눌러 다시 시작해주세요.");
    }
  };
  micStream.getTracks().forEach((track) => pc.addTrack(track, micStream));

  dc = pc.createDataChannel("oai-events");
  dc.onmessage = (event) => {
    try {
      handleServerEvent(JSON.parse(event.data));
    } catch (err) {
      console.error("[멘코] 이벤트 처리 실패:", err);
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  const sdpRes = await fetch(REALTIME_CALLS_URL, {
    method: "POST",
    body: offer.sdp,
    headers: {
      Authorization: `Bearer ${tokenData.clientSecret}`,
      "Content-Type": "application/sdp",
    },
  });
  if (!sdpRes.ok) {
    console.error("[멘코] WebRTC 연결 실패:", sdpRes.status, await sdpRes.text());
    throw new Error("AI와 연결하지 못했어요. 잠시 후 다시 시도해주세요.");
  }
  if (!sessionActive) return;
  await pc.setRemoteDescription({ type: "answer", sdp: await sdpRes.text() });

  startMicLevelMeter(micStream);
  startPacingNotes();
  setState("listening", "듣고 있어요...");
}

function endSession(message = "버튼을 누르고 멘탈 코칭 대화를 시작해 보세요") {
  sessionActive = false;
  clearInterval(pacingTimer);
  pacingTimer = null;
  if (levelFrame) cancelAnimationFrame(levelFrame);
  levelFrame = null;
  updateMicLevel(0);
  if (levelContext) levelContext.close();
  levelContext = null;
  if (dc) dc.close();
  dc = null;
  if (pc) pc.close();
  pc = null;
  if (micStream) micStream.getTracks().forEach((track) => track.stop());
  micStream = null;
  if (remoteAudio) {
    remoteAudio.srcObject = null;
    remoteAudio.remove();
  }
  remoteAudio = null;
  wrapUpCallId = null;
  finishButton.hidden = true;
  setState(null, message);
}

micButton.addEventListener("click", () => {
  if (sessionActive) {
    endSession();
    return;
  }
  sessionActive = true;
  // 모바일 브라우저의 자동재생 제한 때문에, 재생 요소는 사용자가 버튼을 누른 이 순간에 만든다.
  remoteAudio = document.createElement("audio");
  remoteAudio.autoplay = true;
  remoteAudio.playsInline = true;
  document.body.appendChild(remoteAudio);
  startSession().catch((err) => {
    if (!sessionActive) return; // 연결 중에 사용자가 이미 종료한 경우
    console.error("[멘코] 세션 시작 실패:", err);
    const denied = err?.name === "NotAllowedError";
    endSession(denied ? "마이크 접근이 거부됐어요." : err?.message || "연결에 실패했어요.");
  });
});

finishButton.addEventListener("click", () => {
  endSession();
  completionModal.hidden = false;
});

modalCloseButton.addEventListener("click", () => {
  completionModal.hidden = true;
});
