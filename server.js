import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1";
const REALTIME_VOICE = process.env.OPENAI_REALTIME_VOICE || "marin";

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
- 항상 자연스러운 한국어 존댓말로 말한다. 고객을 "당신"이라고 부르지 않는다 — 이름을
  알면 "OO님"으로 부르고, 모르면 호칭 없이 자연스럽게 말한다.
- 문장은 짧고 자연스럽게, 음성으로 들었을 때 편안하도록 구성한다.
- 한 번의 응답은 보통 짧은 반영·인정 한 문장 + 강력한 질문 한 개 정도로, 2~3문장 이내로 간결하게 말한다.
- 조언하고 싶은 순간에도 먼저 질문으로 되돌린다 ("제 생각엔 ~하시면 좋을 것 같아요" 대신
  "어떤 방법이 떠오르세요?").

[경계]
자살, 자해, 심각한 정신건강 위기 신호가 보이면 코칭을 멈추고 즉시 전문 상담기관이나
정신건강 위기상담전화(1393)로 연결하도록 진지하게 안내한다.

[코치 모드 ↔ 일반 모드 전환]
기본은 위의 전문 코치 페르소나로 대화하되, 아래 두 경우에는 코칭 질문 중심 대화를
잠시 멈추고 '일반 모드'로 전환한다:
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

// 음성은 브라우저 ↔ OpenAI Realtime이 WebRTC로 직접 주고받는다. 서버는 API 키를
// 노출하지 않도록 짧게 유효한 클라이언트 토큰(ephemeral key)만 발급한다.
// WebRTC 통화 음성에는 브라우저의 에코 제거가 제대로 적용되고, 음성이 이 서버를
// 거치지 않아 서버 성능(Render 무료 플랜)이 대화 품질에 영향을 주지 않는다.
// 한 세션은 최대 60분까지 유지되므로 재연결/세션 교체 로직도 필요 없다.
function buildSessionConfig() {
  return {
    type: "realtime",
    model: REALTIME_MODEL,
    instructions: SYSTEM_PROMPT,
    output_modalities: ["audio"],
    audio: {
      input: {
        noise_reduction: { type: "near_field" },
        // 코칭에서는 고객이 생각하며 말을 멈추는 일이 잦다. semantic_vad는 소리 크기가
        // 아니라 "말이 끝났는지"를 의미로 판단하고, eagerness를 low로 두면 말을 잠깐
        // 멈춘 사이에 코치가 끼어들지 않고 충분히 기다려준다.
        turn_detection: { type: "semantic_vad", eagerness: "low" },
      },
      output: { voice: REALTIME_VOICE },
    },
    tools: [
      {
        type: "function",
        name: "mark_coaching_wrap_up",
        description:
          "코칭 대화가 Will/Wrap-up(마무리) 단계에 접어들어 격려와 응원으로 세션을 마무리하기 시작할 때 정확히 한 번 호출한다.",
        parameters: { type: "object", properties: {} },
      },
    ],
    tool_choice: "auto",
  };
}

app.use(express.static("public"));
app.use(express.json());

app.post("/session", async (_req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    console.error("[세션] OPENAI_API_KEY가 설정되지 않았습니다.");
    return res.status(500).json({ error: "서버에 OpenAI API 키가 설정되지 않았어요." });
  }
  try {
    const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ session: buildSessionConfig() }),
    });
    const data = await response.json();
    if (!response.ok || !data.value) {
      console.error("[세션] 토큰 발급 실패:", response.status, JSON.stringify(data));
      return res.status(502).json({ error: "AI 연결을 준비하지 못했어요. 잠시 후 다시 시도해주세요." });
    }
    console.log("[세션] 토큰 발급 완료");
    res.json({ clientSecret: data.value });
  } catch (err) {
    console.error("[세션] 토큰 발급 오류:", err?.message || err);
    res.status(502).json({ error: "AI 연결을 준비하지 못했어요. 잠시 후 다시 시도해주세요." });
  }
});

app.listen(PORT, () => {
  console.log(`멘코 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
