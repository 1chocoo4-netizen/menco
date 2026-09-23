import http from "http";
import express from "express";
import dotenv from "dotenv";
import { WebSocketServer } from "ws";
import { GoogleGenAI, Modality, StartSensitivity, EndSensitivity } from "@google/genai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const LIVE_MODEL = process.env.GEMINI_LIVE_MODEL || "gemini-2.5-flash-native-audio-latest";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_PROMPT = `너는 '멘코(MentCo)'라는 이름의 전문 멘탈 코치 AI야.
국제코치연맹(ICF) MCC 수준의 코칭 역량과 한국코치협회(KCA) KSC 자격의 코칭 철학을 체화한,
유연하고 노련한 세계 최고 수준의 전문 코치처럼 대화해.

[정체성 — 상담사가 아니라 코치]
너는 상담사나 치료사가 아니라 '코치'야. 고객은 스스로 답을 찾을 수 있는 온전하고(Whole),
창의적이며(Creative), 무한한 가능성을 지닌 존재라고 진심으로 믿어. 너의 역할은 문제를 진단하거나
해결책·조언을 주는 것이 아니라, 강력한 질문과 깊은 경청으로 고객 내면의 자각(Awareness)을
이끌어내고 스스로 다음 행동을 선택하도록 돕는 파트너야.

[코칭 철학과 태도]
- 조언이나 위로 중심의 답변을 지양하고, 고객이 이미 알고 있는 답을 스스로 발견하도록 질문으로 이끈다.
- 공감은 짧고 진솔하게 반영하되 거기 머무르지 않고, 반드시 다음 자각이나 행동으로 이어지는 질문을 던진다.
- 판단하거나 앞서가지 않는다. 고객의 속도와 언어를 따라가며, 고객의 의제(agenda)를 코치의 의제보다 우선한다.
- 짧고 절제된 문장으로 고객이 스스로 채울 여백을 남긴다.
- 고객의 작은 통찰과 진전도 진심으로 알아차리고 인정한다.

[코칭 대화 프로세스 — 유연하게 적용, 기계적으로 따라가지 않음]
대화 상황에 맞게 자연스럽게 아래 흐름을 넘나든다 (GROW 모델 기반):
1. 관계 형성 & 주제 합의 — 오늘 이 대화에서 무엇을 다루고 싶은지, 무엇을 얻고 싶은지 확인
2. Goal — 원하는 상태와 이 대화의 목표를 함께 명확히 함
3. Reality — 현재 상황, 감정, 이미 시도해본 것들을 판단 없이 탐색
4. Options — "어떤 방법이 있을까요?", "다른 관점에서 보면 어떨까요?" 같은 질문으로 고객 스스로
   대안을 떠올리게 함 (대안을 직접 제시하지 않는다)
5. Will / Wrap-up — 무엇을 언제부터 해볼지 스스로 다짐하도록 묻고, 지지와 격려로 마무리
이 단계는 순서를 강요하지 않고, 고객이 필요로 하는 지점에 유연하게 머무르거나 되돌아간다.

[대화 스타일 — 음성 대화용]
- 문장은 짧고 자연스럽게, 음성으로 들었을 때 편안하도록 구성한다.
- 한 번의 응답은 보통 짧은 반영·인정 한 문장 + 강력한 질문 한 개 정도로, 2~3문장 이내로 간결하게 말한다.
- 조언하고 싶은 순간에도 먼저 질문으로 되돌린다 ("제 생각엔 ~하시면 좋을 것 같아요" 대신
  "어떤 방법이 떠오르세요?").

[경계]
자살, 자해, 심각한 정신건강 위기 신호가 보이면 코칭을 멈추고 즉시 전문 상담기관이나
정신건강 위기상담전화(1393)로 연결하도록 진지하게 안내한다.

[코치 모드 ↔ 일반 모드 전환]
기본은 위의 전문 코치 페르소나로 대화하되, 아래 두 경우에는 코칭 질문 중심 대화를
잠시 멈추고 '제미나이 일반 모드'로 전환한다:
1. 고객이 코칭 범위를 벗어난 질문(사실 정보, 지식, 직접적인 조언 등)을 할 때
2. 코칭 질문만으로는 대화가 꼬이거나 같은 이야기가 반복되어 진전이 없다고 판단될 때
전환할 때는 자연스럽게 알린다 (예: "이 부분은 질문보다 그냥 편하게 답해드리는 게 나을 것
같아요"). 이후에는 코칭 규칙(질문으로 되돌리기, 조언 지양)을 잠시 내려놓고 친절하고
직접적인 일반 어시스턴트처럼 답한다. 해당 주제나 혼란이 해결됐다고 판단되면 반드시
"다시 멘코 코칭 모드로 돌아갈까요?" 라고 물어보고, 고객이 동의하면 그 순간부터 위의 전문
코치 페르소나와 코칭 프로세스로 복귀한다. 고객이 아직 아니라고 하면 일반 모드를 유지하며
같은 질문을 반복하지 않고 자연스럽게 대화를 이어간다. 단, [경계]에서 다루는 위기 신호는
이 전환과 무관하게 항상 최우선으로 적용한다.

[코칭 완료 신호]
대화가 Will/Wrap-up 단계에 접어들어, 고객의 다음 행동 다짐을 확인하고 격려와 응원의 말로
마무리를 시작하는 바로 그 시점에 반드시 mark_coaching_wrap_up 함수를 한 번 호출해라.
아직 대화 초반이거나 탐색·질문이 이어지는 중이라면 호출하지 않는다. 세션당 한 번만 호출한다.`;

app.use(express.static("public"));
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/live" });

// ─────────────────────────────────────────────────────────────────────────────
// 세션 운용 방식 (2026-09-24 재설계)
//
// 증상: 코칭 시작 후 약 3분이 지나면 목소리가 갈라지고 점점 이상해지다가, 결국 사용자
// 말을 못 알아듣고 "듣고 있어요 ↔ 다시 연결됐어요"를 무한 반복했다.
//
// 근본 원인은 재연결 로직이 아니라 Gemini 네이티브 오디오 모델 자체의 알려진 문제다:
// 한 Live 세션 안에 오디오 컨텍스트가 쌓일수록(1~3분부터) 응답 지연이 급격히 늘고,
// 발화가 중간에 끊기거나 음성이 깨진다(구글 포럼/GitHub 이슈에 재현·보고됨, 미해결).
// 예전 코드는 여기에 기름을 부었다:
//  - 느려진 응답을 워치독이 "먹통"으로 보고 재연결 → 세션 재개 핸들로 "이미 망가진
//    그 오디오 컨텍스트"를 그대로 복원 → 여전히 느림 → 또 재연결… 무한 반복.
//  - 사용자 발화 인식(inputTranscription)만 와도 재시도 카운터를 0으로 되돌려서
//    MAX_RECONNECT_ATTEMPTS 상한이 사실상 무력화됐다.
//  - 재개 핸들을 버릴 때는 대화 맥락이 통째로 사라져 "내 말을 못 알아듣는" 상태가 됐다.
//
// 새 방식:
//  1) 대화 내용을 서버가 직접 텍스트로 기록한다(입·출력 음성 인식 결과).
//  2) 한 세션이 ROTATE_AFTER_MS를 넘기면, 사용자 차례의 조용한 순간에 새 세션을
//     백그라운드로 열고 "지금까지의 대화 기록(텍스트)"을 넣어 이어받게 한 뒤 교체한다.
//     텍스트 맥락은 오디오 맥락보다 훨씬 가벼워서 새 세션은 항상 처음처럼 빠르고 깨끗하다.
//     사용자에게는 아무 안내도 뜨지 않는다(끊김 없는 교체).
//  3) 장애로 인한 복구 재연결도 같은 방식(텍스트 기록 인계)을 쓴다. 세션 재개 핸들과
//     슬라이딩 윈도우 압축은 더 이상 쓰지 않는다 — 세션이 짧게 유지되므로 필요 없고,
//     압축은 오히려 발화 끊김을 악화시킨다고 보고돼 있다.
//  4) 재시도 카운터는 "모델이 실제로 말을 했을 때"만 리셋한다. 그래서 복구가 계속
//     실패하면 무한 루프 대신 명확한 안내와 함께 끝난다.
// ─────────────────────────────────────────────────────────────────────────────

function buildLiveConfig(systemInstruction) {
  return {
    responseModalities: [Modality.AUDIO],
    systemInstruction,
    speechConfig: {
      languageCode: "ko-KR",
      voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
    },
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    tools: [
      {
        functionDeclarations: [
          {
            name: "mark_coaching_wrap_up",
            description:
              "코칭 대화가 Will/Wrap-up(마무리) 단계에 접어들어 격려와 응원으로 세션을 마무리하기 시작할 때 정확히 한 번 호출한다.",
          },
        ],
      },
    ],
    realtimeInputConfig: {
      automaticActivityDetection: {
        startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
        endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_HIGH,
        // 짧은 잡음/숨소리에 반응하지 않도록, 이만큼 지속된 소리만 "발화 시작"으로 인정.
        prefixPaddingMs: 200,
        silenceDurationMs: 400,
      },
    },
  };
}

// 새 세션에 넘기는 대화 기록의 최대 길이. 앞부분(오늘의 주제·목표 합의)은 코칭에서
// 특히 중요하므로 넘칠 때도 앞 TRANSCRIPT_HEAD_CHARS만큼은 남기고 중간을 줄인다.
const TRANSCRIPT_MAX_CHARS = 24000;
const TRANSCRIPT_HEAD_CHARS = 3000;

function formatTranscript(entries) {
  let text = entries
    .map((e) => `${e.role === "user" ? "고객" : "멘코"}: ${e.text.trim()}`)
    .join("\n");
  if (text.length > TRANSCRIPT_MAX_CHARS) {
    text =
      text.slice(0, TRANSCRIPT_HEAD_CHARS) +
      "\n…(중략)…\n" +
      text.slice(-(TRANSCRIPT_MAX_CHARS - TRANSCRIPT_HEAD_CHARS));
  }
  return text;
}

function buildSystemInstruction(entries, wrapUpCalled) {
  if (entries.length === 0) return SYSTEM_PROMPT;
  return `${SYSTEM_PROMPT}

[진행 중인 대화 — 그대로 이어가기]
이 코칭 대화는 이미 진행 중이다. 아래는 지금까지 고객과 나눈 대화 기록이다(음성 인식
결과라 오탈자가 있을 수 있으니 맥락으로 이해한다). 처음 만난 것처럼 인사하거나
자기소개하지 말고, 대화가 끊긴 적이 있다는 언급도 하지 말고, 이 흐름을 자연스럽게 이어간다.
먼저 말을 꺼내지 말고 고객의 다음 말을 기다렸다가 이어서 답한다.${
    wrapUpCalled ? "\nmark_coaching_wrap_up 함수는 이미 호출했으므로 다시 호출하지 않는다." : ""
  }
---
${formatTranscript(entries)}
---`;
}

// 한 세션을 이 시간 이상 쓰면, 다음 조용한 순간에 새 세션으로 교체한다.
// 증상이 약 3분부터 나타났으므로 그보다 충분히 앞에서 교체한다.
const ROTATE_AFTER_MS = 100_000;
// 교체에 실패하면(연결 실패 등) 기존 세션을 계속 쓰다가 이 시간 뒤에 다시 시도한다.
const ROTATE_RETRY_MS = 10_000;
// 사용자가 마지막으로 말한 뒤 이만큼 조용해야 "교체해도 안전한 순간"으로 본다.
const QUIET_BEFORE_ROTATE_MS = 1500;
// 새 세션이 이 시간 안에 준비(setupComplete)되지 않으면 실패로 본다.
const CONNECT_TIMEOUT_MS = 10_000;
// 복구 재연결이 이 시간보다 오래 걸릴 때만 클라이언트에 "재연결 중" 안내를 띄운다.
const ANNOUNCE_RECONNECT_AFTER_MS = 1500;
const MAX_RECONNECT_ATTEMPTS = 5;

// 워치독 기준
// A) Gemini가 사용자 말을 인식(inputTranscription)했는데 그 뒤로 이만큼 아무 응답이 없음.
const REPLY_STALL_MS = 12_000;
// B) 사용자가 계속 말하는데(클라이언트 발화 플래그) Gemini가 이만큼 아무 메시지도 안 보냄.
const DEAF_STALL_MS = 10_000;
const DEAF_MIN_SPEECH_CHUNKS = 90; // 32ms 청크 기준 약 3초 분량의 발화
const WATCHDOG_CHECK_MS = 1000;

// 연결이 끊긴 동안 쌓아둘 사용자 오디오(32ms 청크 기준 약 10초). 그보다 오래된
// 소리는 이미 맥락상 의미가 없고, 새 세션에 한꺼번에 밀어넣으면 응답만 늦어진다.
const MAX_PENDING_AUDIO = 310;

wss.on("connection", (clientWs) => {
  console.log("[클라이언트] 연결됨");
  let closedByClient = false;
  let inputSampleRate = 16000;
  let receivedChunks = 0;

  // 대화 기록(텍스트). 같은 화자의 연속 발화는 한 항목으로 합친다.
  const transcript = [];
  let wrapUpCalled = false;

  // 현재 사용자 오디오를 받는 세션. currentSessionId가 아닌 세션의 메시지는 전부 버린다
  // — 교체/복구 시 옛 세션과 새 세션의 소리가 섞이는 일이 구조적으로 불가능하다.
  let liveSession = null;
  let currentSessionId = 0;
  let sessionStartedAt = 0;
  let nextSessionId = 1;
  // 가장 최근에 시작한 연결 시도. 이보다 오래된 시도는 열리더라도 곧바로 버린다.
  let latestAttemptId = 0;
  let hasSentReady = false;

  let rotating = false; // 교체용 새 세션을 여는 중(기존 세션은 계속 사용)
  let rotateRequested = false; // GoAway 수신 시 나이와 상관없이 교체
  let rotateNotBefore = 0;
  let reconnectTimer = null; // 복구 재연결 대기 중
  let reconnectAttempts = 0;
  let announcedReconnecting = false;

  const pendingAudio = [];

  // 턴 상태
  let modelTurnActive = false; // 모델이 말하기 시작했고 아직 turnComplete 전
  let userTurnPendingSince = 0; // 사용자 발화를 인식했는데 아직 모델 응답이 없음
  let lastSessionMsgAt = Date.now();
  let lastSpeechAt = 0;
  let speechChunksSinceMsg = 0;
  let deafStrikes = 0;

  const send = (payload) => {
    if (clientWs.readyState === clientWs.OPEN) {
      clientWs.send(JSON.stringify(payload));
    }
  };

  function appendTranscript(role, text) {
    if (!text) return;
    const last = transcript[transcript.length - 1];
    if (last && last.role === role) last.text += text;
    else transcript.push({ role, text });
  }

  function onModelOutput() {
    modelTurnActive = true;
    userTurnPendingSince = 0;
    // 모델이 실제로 말을 하고 있다 = 세션이 건강하다. 이때만 실패 카운트를 리셋한다.
    reconnectAttempts = 0;
    deafStrikes = 0;
  }

  function closeQuietly(session) {
    try {
      session?.close();
    } catch {
      // 이미 닫힌 세션
    }
  }

  // kind: "initial" | "rotate" | "recover"
  function openSession(kind) {
    const id = nextSessionId++;
    latestAttemptId = id;
    const isStale = () => id !== latestAttemptId || closedByClient;

    // 복구 시, 마지막 발화가 아직 답을 못 받은 사용자 말이라면 기록에서 빼두었다가
    // 새 세션이 열리자마자 사용자 턴으로 보내 곧바로 답하게 한다(다시 말할 필요 없음).
    let entries = transcript;
    let unansweredUserText = null;
    const last = transcript[transcript.length - 1];
    if (kind === "recover" && last?.role === "user" && userTurnPendingSince) {
      entries = transcript.slice(0, -1);
      unansweredUserText = last.text.trim();
    }

    let session = null;
    let setupDone = false;
    let installed = false;
    const connectTimer = setTimeout(() => {
      if (installed || isStale()) return;
      console.warn(`[Gemini] 세션 #${id} 준비 시간 초과 (${kind})`);
      fail("연결 시간 초과");
    }, CONNECT_TIMEOUT_MS);

    function fail(reason) {
      clearTimeout(connectTimer);
      closeQuietly(session);
      if (isStale()) return;
      if (kind === "rotate") {
        // 교체 실패는 치명적이지 않다: 기존 세션을 그대로 쓰고 잠시 뒤 다시 시도.
        console.warn(`[Gemini] 세션 교체 실패, 기존 세션 유지: ${reason}`);
        latestAttemptId = currentSessionId;
        rotating = false;
        rotateNotBefore = Date.now() + ROTATE_RETRY_MS;
        return;
      }
      scheduleReconnect(`연결 실패: ${reason}`);
    }

    function tryInstall() {
      if (installed || !session || !setupDone) return;
      if (isStale()) {
        closeQuietly(session);
        return;
      }
      installed = true;
      clearTimeout(connectTimer);

      const old = liveSession;
      liveSession = session;
      currentSessionId = id;
      sessionStartedAt = Date.now();
      lastSessionMsgAt = Date.now();
      speechChunksSinceMsg = 0;
      modelTurnActive = false;
      rotating = false;
      rotateRequested = false;
      if (old && old !== session) closeQuietly(old);
      console.log(`[Gemini] 세션 #${id} 사용 시작 (${kind}, 대화 기록 ${transcript.length}항목 인계)`);

      if (unansweredUserText) {
        try {
          session.sendClientContent({
            turns: [{ role: "user", parts: [{ text: unansweredUserText }] }],
            turnComplete: true,
          });
        } catch (err) {
          console.error("[Gemini] 미응답 발화 재전송 실패:", err?.message || err);
        }
      }
      if (pendingAudio.length > 0) {
        console.log(`[Gemini] 대기 중 쌓인 오디오 ${pendingAudio.length}청크 전달`);
        for (const payload of pendingAudio) {
          try {
            session.sendRealtimeInput(payload);
          } catch (err) {
            console.error("[Gemini] 대기 오디오 전달 실패:", err?.message || err);
            break;
          }
        }
        pendingAudio.length = 0;
      }

      if (!hasSentReady) {
        hasSentReady = true;
        send({ type: "ready" });
      } else if (announcedReconnecting) {
        announcedReconnecting = false;
        send({ type: "reconnected" });
      }
    }

    ai.live
      .connect({
        model: LIVE_MODEL,
        config: buildLiveConfig(buildSystemInstruction(entries, wrapUpCalled)),
        callbacks: {
          onmessage: (message) => {
            if (message.setupComplete) {
              setupDone = true;
              tryInstall();
              return;
            }
            if (id !== currentSessionId) return;
            handleSessionMessage(message, session);
          },
          onerror: (err) => {
            console.error(`[Gemini] 세션 #${id} 오류:`, err?.message || err);
            if (id === currentSessionId) scheduleReconnect(`onerror: ${err?.message || err}`);
            else if (!installed) fail(`onerror: ${err?.message || err}`);
          },
          onclose: (event) => {
            console.log(`[Gemini] 세션 #${id} 종료:`, event?.code, event?.reason);
            if (closedByClient) return;
            if (id === currentSessionId) scheduleReconnect(`onclose: ${event?.code} ${event?.reason}`);
            else if (!installed) fail(`onclose: ${event?.code} ${event?.reason}`);
          },
        },
      })
      .then((s) => {
        session = s;
        if (isStale()) {
          clearTimeout(connectTimer);
          closeQuietly(s);
          return;
        }
        tryInstall();
      })
      .catch((err) => {
        console.error("[Gemini] 연결 실패:", err?.message || err);
        fail(err?.message || String(err));
      });
  }

  // 장애(끊김/오류/먹통)로 인한 복구. 여러 트리거가 동시에 와도 한 번만 예약된다.
  function scheduleReconnect(reason) {
    if (closedByClient || reconnectTimer) return;
    reconnectAttempts++;
    console.warn(`[Gemini] 복구 재연결 (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}, 사유: ${reason})`);

    const dead = liveSession;
    liveSession = null;
    currentSessionId = 0;
    latestAttemptId = -1; // 진행 중이던 교체 시도가 있었다면 무효화(복구 시도가 대신한다)
    rotating = false;
    modelTurnActive = false;
    closeQuietly(dead);

    if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
      console.error("[Gemini] 복구가 계속 실패해 세션을 종료합니다.");
      send({ type: "error", message: "AI 연결이 계속 불안정해서 세션을 이어갈 수 없어요. 잠시 후 다시 시작해주세요." });
      clientWs.close();
      return;
    }

    const delayMs = reconnectAttempts === 1 ? 0 : Math.min(500 * (reconnectAttempts - 1), 4000);
    const startedAt = Date.now();
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      openSession("recover");
    }, delayMs);
    // 짧게 끝나는 복구는 사용자가 눈치채지 못하게, 오래 걸릴 때만 안내한다.
    setTimeout(() => {
      if (!closedByClient && !liveSession && Date.now() - startedAt >= ANNOUNCE_RECONNECT_AFTER_MS) {
        announcedReconnecting = true;
        send({ type: "reconnecting" });
      }
    }, ANNOUNCE_RECONNECT_AFTER_MS);
  }

  function handleSessionMessage(message, session) {
    lastSessionMsgAt = Date.now();
    speechChunksSinceMsg = 0;

    if (message.goAway) {
      console.log("[Gemini] GoAway 수신 (남은 시간:", message.goAway.timeLeft, ") — 다음 조용한 순간에 세션 교체");
      rotateRequested = true;
    }

    if (message.toolCall?.functionCalls?.length) {
      const functionResponses = [];
      for (const call of message.toolCall.functionCalls) {
        if (call.name === "mark_coaching_wrap_up") {
          console.log("[Gemini] 코칭 마무리 단계 진입 신호 수신");
          wrapUpCalled = true;
          send({ type: "showFinishButton" });
        }
        functionResponses.push({ id: call.id, name: call.name, response: { output: "ok" } });
      }
      // 응답은 반드시 그 호출을 만든 세션에 돌려준다(안 그러면 모델이 응답을 기다리며 멈춤).
      try {
        session?.sendToolResponse({ functionResponses });
      } catch (err) {
        console.error("[Gemini] 함수 응답 전송 실패:", err?.message || err);
      }
    }

    // message.data 게터는 모델의 thought 파트가 섞여 있으면 청크마다 경고 로그를 찍으므로
    // (무료 인스턴스에선 무시 못 할 부하) 오디오 파트를 직접 꺼낸다.
    const sc = message.serverContent;
    for (const part of sc?.modelTurn?.parts ?? []) {
      if (part.inlineData?.data && part.inlineData.mimeType?.startsWith("audio/")) {
        onModelOutput();
        send({ type: "audio", data: part.inlineData.data });
      }
    }

    if (sc?.inputTranscription?.text) {
      console.log(`[Gemini] 사용자 발화 인식: ${sc.inputTranscription.text}`);
      appendTranscript("user", sc.inputTranscription.text);
      userTurnPendingSince = Date.now();
      send({ type: "userText", text: sc.inputTranscription.text });
    }
    if (sc?.outputTranscription?.text) {
      onModelOutput();
      appendTranscript("model", sc.outputTranscription.text);
      send({ type: "modelText", text: sc.outputTranscription.text });
    }
    if (sc?.interrupted) {
      modelTurnActive = false;
      send({ type: "interrupted" });
    }
    if (sc?.turnComplete) {
      console.log("[Gemini] 턴 완료");
      modelTurnActive = false;
      send({ type: "turnComplete" });
    }
  }

  const watchdogTimer = setInterval(() => {
    if (closedByClient || !liveSession || reconnectTimer) return;
    const now = Date.now();
    const silentFor = now - lastSessionMsgAt;

    // 모델이 말하다가 turnComplete 없이 조용해진 경우, 턴이 끝난 것으로 본다
    // (안 그러면 교체와 워치독 A가 영영 막힌다).
    if (modelTurnActive && silentFor > 20_000) modelTurnActive = false;

    // A) 사용자 말은 알아들었는데 답이 안 옴 → 복구(미응답 발화는 새 세션에 넘겨 바로 답하게 함)
    if (userTurnPendingSince && !modelTurnActive && silentFor > REPLY_STALL_MS) {
      console.warn(`[Gemini] 사용자 발화 인식 후 ${Math.round(silentFor / 1000)}초간 응답 없음`);
      scheduleReconnect("워치독: 응답 없음");
      return;
    }

    // B) 사용자가 한참 말하는데 세션이 아무 반응도 없음(귀가 먹은 세션).
    // 주변 소음 오탐으로 무한 재연결되지 않도록, 모델이 다시 말하기 전까지 최대 2번만.
    if (deafStrikes < 2 && speechChunksSinceMsg >= DEAF_MIN_SPEECH_CHUNKS && silentFor > DEAF_STALL_MS) {
      deafStrikes++;
      console.warn(`[Gemini] 사용자 발화 중 ${Math.round(silentFor / 1000)}초간 세션 무반응`);
      scheduleReconnect("워치독: 무반응");
      return;
    }

    // 세션 교체: 오래된 세션(또는 GoAway 받은 세션)을 사용자 차례의 조용한 순간에 교체.
    const due = rotateRequested || now - sessionStartedAt > ROTATE_AFTER_MS;
    const quiet = !modelTurnActive && !userTurnPendingSince && now - lastSpeechAt > QUIET_BEFORE_ROTATE_MS;
    if (due && quiet && !rotating && now >= rotateNotBefore) {
      console.log(`[Gemini] 세션 #${currentSessionId} 교체 시작 (사용 ${Math.round((now - sessionStartedAt) / 1000)}초)`);
      rotating = true;
      openSession("rotate");
    }
  }, WATCHDOG_CHECK_MS);

  function abortRotation() {
    if (!rotating) return;
    console.log("[Gemini] 사용자가 말을 시작해 세션 교체를 미룹니다.");
    rotating = false;
    latestAttemptId = currentSessionId; // 열리는 중인 새 세션은 stale 처리되어 버려진다
    rotateNotBefore = 0;
  }

  openSession("initial");

  clientWs.on("message", (raw, isBinary) => {
    if (!isBinary) {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (msg.type === "mic" && Number(msg.sampleRate) > 0) {
        inputSampleRate = Number(msg.sampleRate);
      }
      return;
    }

    // 바이너리 오디오 프레임: [1바이트 발화 플래그][16비트 PCM]
    if (raw.length < 3) return;
    const speaking = raw[0] === 1;
    const payload = {
      audio: { data: raw.subarray(1).toString("base64"), mimeType: `audio/pcm;rate=${inputSampleRate}` },
    };

    if (speaking) {
      lastSpeechAt = Date.now();
      speechChunksSinceMsg++;
      // 교체 준비 중에 사용자가 말을 시작하면, 말이 두 세션으로 쪼개지지 않게 교체를 미룬다.
      abortRotation();
    }

    if (liveSession) {
      try {
        liveSession.sendRealtimeInput(payload);
      } catch (err) {
        pendingAudio.push(payload);
        scheduleReconnect(`오디오 전송 실패: ${err?.message || err}`);
      }
    } else {
      pendingAudio.push(payload);
      if (pendingAudio.length > MAX_PENDING_AUDIO) pendingAudio.shift();
    }

    receivedChunks++;
    if (receivedChunks % 300 === 0) {
      console.log(`[클라이언트] 오디오 ${receivedChunks}청크 수신 (rate=${inputSampleRate})`);
    }
  });

  clientWs.on("close", () => {
    console.log("[클라이언트] 연결 종료");
    closedByClient = true;
    clearInterval(watchdogTimer);
    clearTimeout(reconnectTimer);
    closeQuietly(liveSession);
    liveSession = null;
  });
});


server.listen(PORT, () => {
  console.log(`멘코 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
