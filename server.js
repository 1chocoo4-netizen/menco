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

function buildLiveConfig(resumptionHandle) {
  return {
    responseModalities: [Modality.AUDIO],
    systemInstruction: SYSTEM_PROMPT,
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
        // HIGH 민감도의 빠른 반응성은 유지하면서 바지인 오탐만 걸러낸다.
        prefixPaddingMs: 200,
        silenceDurationMs: 400,
      },
    },
    // 오디오는 텍스트보다 토큰을 훨씬 빨리 소모해서, 이걸 켜지 않으면 몇 분 만에
    // 컨텍스트 윈도우 한도에 도달해 세션이 강제 종료된다. 슬라이딩 윈도우로
    // 오래된 대화를 자동 압축해 장시간 세션이 끊기지 않게 한다.
    contextWindowCompression: {
      slidingWindow: {},
    },
    // Live API 연결 자체가 일정 시간 후 GoAway와 함께 강제 종료되는데,
    // 세션 재개를 켜두면 handle을 받아뒀다가 끊기기 직전 조용히 재연결할 수 있다.
    sessionResumption: resumptionHandle ? { handle: resumptionHandle } : {},
  };
}

wss.on("connection", (clientWs) => {
  console.log("[클라이언트] 연결됨");
  let liveSession = null;
  let closedByClient = false;
  let receivedChunks = 0;
  let resumptionHandle = null;
  // GoAway 후 재연결하는 짧은 틈에는 liveSession이 비어있거나 죽어가는 소켓을 가리킨다.
  // transparent 재연결은 Gemini API(Vertex 전용 기능)에서 지원하지 않으므로,
  // 그 틈에 들어온 오디오를 직접 버퍼링했다가 새 세션이 열리자마자 흘려보낸다.
  const pendingAudio = [];
  const MAX_PENDING_AUDIO = 1200; // 청크당 ~32ms, 약 38초 분량까지만 보관
  const MAX_RECONNECT_RETRIES = 3;
  // 재연결로 새 세션이 열려도 옛 세션은 자기 턴을 마저 끝내도록 살려두는데(아래
  // connectLive 주석 참고), onmessage는 어느 세션에서 왔든 그대로 클라이언트에
  // 전달했었다. 그래서 옛 세션이 마무리 발화를 하는 도중 새 세션이 벌써 자기
  // 응답을 시작하면 두 세션의 오디오가 동시에 섞여 들어가 "목소리가 갈라지는"
  // 현상이 났다(재연결이 누적되는 대화 후반부일수록 심해짐). connectLive 호출마다
  // 세대 번호를 매기고, 더 최신 세대가 실제로 메시지를 보내기 시작하는 순간부터
  // 그보다 오래된 세대의 메시지는 버려서 두 세션의 출력이 겹치지 않게 한다.
  let nextSessionGeneration = 0;
  let activeSessionGeneration = -1;

  const send = (payload) => {
    if (clientWs.readyState === clientWs.OPEN) {
      clientWs.send(JSON.stringify(payload));
    }
  };

  // 가끔 goAway도, 에러도, close도 없이 세션이 응답을 완전히 멈추는 경우가 있다
  // (오디오는 계속 보내지는데 인식/응답이 전혀 안 옴). 이런 "먹통" 상태를 감지하기
  // 위해 Gemini로부터 마지막으로 뭔가(오디오/텍스트/턴완료 등 무엇이든)를 받은
  // 시각을 기록해두고, 너무 오래 아무 신호가 없으면 세션이 죽었다고 보고 스스로
  // 새 세션으로 갈아탄다.
  //
  // 단, 재연결은 세션 리줌 체크포인트 이후의 최근 대화가 유실될 위험을 안고 있으므로
  // (Gemini Live API 공식 문서에도 명시된 한계) 꼭 필요할 때만 해야 한다. 그런데
  // 이 코치는 시스템 프롬프트에서부터 "고객이 스스로 채울 여백을 남긴다"며 질문 뒤에
  // 긴 침묵을 의도적으로 유도한다 — 즉 사용자가 10초 넘게 생각하며 조용히 있는 건
  // 코칭 세션에서 지극히 정상이다. 그런데 아래 워치독은 "Gemini가 마지막으로 뭔가
  // 보낸 시점"부터만 재는데, AI가 질문을 던지고 turnComplete를 보낸 직후부터도 이
  // 타이머가 흐르기 시작한다. 그래서 사용자가 그 여백 동안 정상적으로 침묵하면
  // "먹통"으로 오판해 불필요하게 재연결시키고, 그때마다 최근 대화가 유실될 위험을
  // 감수하게 된다 — 대화가 길어질수록 그런 침묵 구간을 만날 확률이 누적되니 "뒤로
  // 갈수록 못 알아듣는다"는 증상으로 나타난 근본 원인이었다.
  //
  // 그래서 "지금 Gemini의 응답을 실제로 기다리고 있는 상태"일 때만 감시한다:
  // 사용자가 말하기 시작하면 감시를 켜고, Gemini가 그 턴을 완결(turnComplete)하면
  // 다시 끈다. AI가 다음 말을 걸 차례가 아니라 사용자 차례일 때는 아무리 조용해도
  // 절대 재연결하지 않는다.
  //
  // 감시 중일 때의 임계값은 두 가지로 나눈다:
  // - 사용자가 "지금 실제로 말하고 있는데" 응답이 없으면 명백히 비정상이므로
  //   짧게(FAST) 기다리고 바로 재연결한다.
  // - 사용자가 말을 막 끝내고 Gemini의 응답 생성을 기다리는 중이면 약간 더 길게
  //   (SLOW) 기다린 뒤에만 재연결한다.
  let lastGeminiMessageAt = Date.now();
  let lastSpeechAt = 0;
  let awaitingReply = false;
  const WATCHDOG_CHECK_MS = 1000;
  const RECENT_SPEECH_WINDOW_MS = 2000;
  const FAST_STALL_MS = 6000;
  const SLOW_STALL_MS = 14000;
  const watchdogTimer = setInterval(() => {
    if (closedByClient || !awaitingReply) return;
    const now = Date.now();
    const silentFor = now - lastGeminiMessageAt;
    const userCurrentlySpeaking = now - lastSpeechAt < RECENT_SPEECH_WINDOW_MS;
    const stallThreshold = userCurrentlySpeaking ? FAST_STALL_MS : SLOW_STALL_MS;

    if (silentFor > stallThreshold && liveSession) {
      console.warn(
        `[Gemini] ${Math.round(silentFor / 1000)}초간 아무 응답이 없어(사용자 발화 중: ${userCurrentlySpeaking}) 세션이 멈춘 것으로 보고 재연결합니다.`
      );
      // 그 정도로 오래 응답이 없었다면 이 세션은 신뢰할 수 없다. goAway 때와 달리
      // 계속 붙잡고 있어봐야 소용없으므로 바로 비워서, 그동안 들어오는 오디오는
      // pendingAudio에 쌓였다가 새 세션이 열리면 이어서 전달되게 한다.
      liveSession = null;
      lastGeminiMessageAt = Date.now(); // 재연결 도중 워치독이 중복 발동하지 않도록
      // 이 경우는 goAway와 달리 실제로 사용자가 체감할 공백이 있었으므로,
      // 화면에 상태를 알려 당황해서 여러 번 말하지 않도록 한다.
      send({ type: "reconnecting" });
      connectLive(true, 0, true);
    }
  }, WATCHDOG_CHECK_MS);

  function connectLive(isReconnect, retryCount = 0, announce = false) {
    // 재연결로 만들어진 세션이 나중에 (예상대로) 닫힐 때는 클라이언트에
    // 에러를 보내지 않기 위한 플래그. goAway를 받으면 즉시 false로 바뀐다.
    let isCurrentSession = true;
    // 이 connectLive 호출로 만들어진 세션 객체를 직접 들고 있는다.
    // liveSession(바깥 변수)은 재연결 과정에서 다른 세션으로 바뀔 수 있으므로,
    // onclose에서 "내가 여전히 현재 세션인지"를 판단하려면 이 참조가 필요하다.
    let thisSession = null;
    const myGeneration = nextSessionGeneration++;

    ai.live
      .connect({
        model: LIVE_MODEL,
        config: buildLiveConfig(resumptionHandle),
        callbacks: {
          onopen: () => {
            if (!isReconnect) {
              send({ type: "ready" });
            } else {
              console.log("[Gemini] 세션 재연결 완료");
              if (announce) send({ type: "reconnected" });
            }
          },
          onmessage: (message) => {
            lastGeminiMessageAt = Date.now();
            if (message.sessionResumptionUpdate?.resumable && message.sessionResumptionUpdate.newHandle) {
              resumptionHandle = message.sessionResumptionUpdate.newHandle;
            }
            if (message.goAway) {
              console.log("[Gemini] GoAway 수신 (남은 시간:", message.goAway.timeLeft, ") — 백그라운드로 재연결 시도");
              isCurrentSession = false;
              // GoAway는 "지금 끊겨라"가 아니라 "timeLeft 뒤에 끊길 예정"이라는 예고다.
              // 이 세션은 그때까지 계속 정상 작동하므로 liveSession을 여기서 비우지
              // 않는다 — 비우면 새 세션이 열릴 때까지 매번 음성이 통째로 멈춰서
              // 체감 지연이 커진다. 새 세션은 백그라운드로 미리 연결해두고, 완전히
              // 준비된 순간(.then 콜백)에만 liveSession을 갈아타서 끊김 없이 전환한다.
              // 혹시라도 새 세션이 열리기 전에 이 세션이 실제로 죽으면(onclose/onerror),
              // 그때 비로소 liveSession이 비워지고 pendingAudio가 안전망 역할을 한다.
              connectLive(true);
              return;
            }
            // 더 최신 세대가 이미 응답을 시작했다면, 뒤늦게 도착한 옛 세대의 메시지는
            // 버린다 — 그대로 흘려보내면 두 세션의 오디오가 겹쳐 들린다. 승격은 실제
            // 오디오/텍스트 등 내용이 있는 메시지에서만 일어나게 해서, 내용 없는
            // 부수 메시지(세션 재개 핸들 갱신 등) 때문에 옛 세션이 말을 채 끝내기도
            // 전에 조기 차단되는 일이 없게 한다.
            if (myGeneration < activeSessionGeneration) return;
            const hasContent =
              !!message.data ||
              !!message.toolCall?.functionCalls?.length ||
              !!message.serverContent?.inputTranscription?.text ||
              !!message.serverContent?.outputTranscription?.text ||
              !!message.serverContent?.interrupted ||
              !!message.serverContent?.turnComplete;
            if (hasContent) activeSessionGeneration = myGeneration;
            // Gemini가 이번 턴을 완결하면 다시 사용자 차례이므로, 사용자가 다음에
            // 말을 시작하기 전까지는(아래 clientWs.on("message")) 워치독을 끈다.
            if (message.serverContent?.turnComplete) awaitingReply = false;

            // 함수 호출 응답은 반드시 그 호출을 만든 세션(thisSession) 자신에게 돌려줘야
            // 한다. 공유 변수 liveSession을 쓰면, 마침 이 시점에 GoAway로 재연결이
            // 시작돼 liveSession이 비워지거나 다른 세션으로 바뀐 경우 응답이 유실되고,
            // Gemini는 그 함수 호출의 응답을 기다리며 멈춰버린다(마무리 단계에서 자주
            // 발생하던 "그 뒤로 안 들리는" 증상의 원인).
            handleGeminiMessage(message, send, (functionResponses) =>
              thisSession?.sendToolResponse({ functionResponses })
            );
          },
          onerror: (err) => {
            console.error("Gemini Live 오류:", err?.message || err);
            if (liveSession === thisSession) liveSession = null;
            if (isCurrentSession) send({ type: "error", message: "AI 연결 중 오류가 발생했어요." });
          },
          onclose: (event) => {
            console.error("Gemini Live 종료:", event?.code, event?.reason);
            // 새 세션으로 이미 넘어갔다면 옛 세션이 뒤늦게 닫혀도 liveSession을 건드리지 않는다.
            if (liveSession === thisSession) liveSession = null;
            if (!closedByClient && isCurrentSession) {
              send({ type: "error", message: "AI 연결이 종료됐어요." });
            }
          },
        },
      })
      .then((session) => {
        // 연결이 완료되기 전에 클라이언트가 이미 나갔다면 곧바로 정리한다
        // (재연결 도중 사용자가 통화를 끊는 경우, 세션이 안 닫힌 채 남는 걸 방지).
        if (closedByClient) {
          session.close();
          return;
        }
        thisSession = session;
        liveSession = session;
        if (pendingAudio.length > 0) {
          console.log(`[Gemini] 재연결 대기 중 쌓인 오디오 ${pendingAudio.length}청크 전달`);
          for (const payload of pendingAudio) {
            try {
              session.sendRealtimeInput(payload);
            } catch (err) {
              console.error("[Gemini] 대기 오디오 전달 실패:", err?.message || err);
            }
          }
          pendingAudio.length = 0;
        }
      })
      .catch((err) => {
        console.error("Gemini Live 연결 실패:", err?.message || err);
        if (closedByClient) return;

        if (isReconnect && retryCount < MAX_RECONNECT_RETRIES) {
          // 재연결이 한 번 실패했다고 바로 세션을 끊지 않는다. 네트워크 순간 오류일 수
          // 있으니 짧은 대기 후 몇 차례 더 시도하고, 그동안 들어온 오디오는 계속
          // pendingAudio에 쌓여 있다가 재연결에 성공하면 그대로 이어서 전달된다.
          const delayMs = 500 * (retryCount + 1);
          console.log(`[Gemini] 재연결 재시도 (${retryCount + 1}/${MAX_RECONNECT_RETRIES}, ${delayMs}ms 후)`);
          setTimeout(() => connectLive(true, retryCount + 1, announce), delayMs);
          return;
        }

        if (isReconnect) {
          send({ type: "error", message: "AI 연결이 끊어져 재연결에 실패했어요. 다시 시작해주세요." });
        } else {
          send({ type: "error", message: "AI 연결에 실패했어요. API 키를 확인해주세요." });
        }
        clientWs.close();
      });
  }

  connectLive(false);

  clientWs.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === "audio") {
      if (msg.speaking) {
        lastSpeechAt = Date.now();
        // 사용자가 말을 시작했으니 이제부터 Gemini의 응답을 기다리는 구간이다.
        // 워치독은 이 시점부터 다음 turnComplete까지만 감시한다.
        awaitingReply = true;
      }
      const rate = msg.sampleRate || 16000;
      const payload = { audio: { data: msg.data, mimeType: `audio/pcm;rate=${rate}` } };
      if (liveSession) {
        try {
          liveSession.sendRealtimeInput(payload);
        } catch (err) {
          console.error("[Gemini] 오디오 전송 실패, 재연결 대기열에 보관:", err?.message || err);
          liveSession = null;
          pendingAudio.push(payload);
        }
      } else {
        // 재연결 중 (GoAway~새 세션 open 사이). 새 세션이 열리면 순서대로 전달된다.
        pendingAudio.push(payload);
        if (pendingAudio.length > MAX_PENDING_AUDIO) pendingAudio.shift();
      }
      receivedChunks++;
      if (receivedChunks % 80 === 0) {
        console.log(`[클라이언트] 오디오 ${receivedChunks}청크 전달 (rate=${rate})`);
      }
    }
  });

  clientWs.on("close", () => {
    closedByClient = true;
    clearInterval(watchdogTimer);
    liveSession?.close();
  });
});

function handleGeminiMessage(message, send, sendToolResponse) {
  if (message.toolCall?.functionCalls?.length) {
    const responses = [];
    for (const call of message.toolCall.functionCalls) {
      if (call.name === "mark_coaching_wrap_up") {
        console.log("[Gemini] 코칭 마무리 단계 진입 신호 수신");
        send({ type: "showFinishButton" });
      }
      responses.push({ id: call.id, name: call.name, response: { output: "ok" } });
    }
    sendToolResponse(responses);
  }

  if (message.data) {
    send({ type: "audio", data: message.data });
  }

  const sc = message.serverContent;
  if (sc?.inputTranscription?.text) {
    console.log(`[Gemini] 사용자 발화 인식: ${sc.inputTranscription.text}`);
    send({ type: "userText", text: sc.inputTranscription.text });
  }
  if (sc?.outputTranscription?.text) {
    console.log(`[Gemini] 응답 텍스트: ${sc.outputTranscription.text}`);
    send({ type: "modelText", text: sc.outputTranscription.text });
  }
  if (sc?.interrupted) {
    send({ type: "interrupted" });
  }
  if (sc?.turnComplete) {
    console.log("[Gemini] 턴 완료");
    send({ type: "turnComplete" });
  }
}

server.listen(PORT, () => {
  console.log(`멘코 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
