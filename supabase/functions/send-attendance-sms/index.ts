// Supabase Edge Function: Postgres 트리거(notify_attendance_sms)가 Log 테이블 INSERT/DELETE
// 마다 호출한다. Solapi로 학부모에게 출석/출석취소 문자를 보낸다.
// 필요한 시크릿(대시보드 Edge Functions > Manage secrets에서 등록):
//   SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER(사전 등록된 발신번호)

async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// "중등부 1학년 1-1반" 같은 전체 학년반 문자열에서 마지막 토큰("1-1반")만 뽑는다.
// AttendMate_Stat의 abbreviateClass()와 동일한 규칙 — 문자에도 같은 축약형으로 보여준다.
function abbreviateClass(division: string): string {
  if (!division) return "";
  const parts = division.trim().split(/\s+/);
  return parts[parts.length - 1];
}

// "첫 날 접수"는 성회 출석이 아니라 도착 등록이라 문구 전체가 다르다 — 전용 템플릿으로
// 따로 만든다(성회 회차 줄도, 착석 현황 링크도 없음). 그 외 타임은 기존 형식 그대로.
function buildMessage(event: string, time: string, division: string, name: string): string {
  if (time === "첫 날 접수") {
    const status = event === "checkin" ? "성회 첫 날 접수 되었습니다." : "성회 첫 날 접수가 취소되었습니다.";
    return `[성회 첫 날 체크인 확인]

${abbreviateClass(division)} ${name}
${status}`;
  }

  const actionLabel = event === "checkin" ? "출석" : "출석취소";
  return `[성회출석알림]

${time}성회
중등부 ${abbreviateClass(division)} ${name}
${actionLabel}하였습니다.`;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405 });
  }

  const apiKey = Deno.env.get("SOLAPI_API_KEY");
  const apiSecret = Deno.env.get("SOLAPI_API_SECRET");
  const sender = Deno.env.get("SOLAPI_SENDER");
  if (!apiKey || !apiSecret || !sender) {
    console.error("Solapi 시크릿 누락");
    return new Response(JSON.stringify({ error: "solapi credentials not configured" }), { status: 500 });
  }

  let payload: { event?: string; time?: string; name?: string; division?: string; parentPhone?: string };
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), { status: 400 });
  }

  const { event, time, name, division, parentPhone } = payload;
  if (!event || !time || !name || !parentPhone) {
    return new Response(JSON.stringify({ error: "missing fields" }), { status: 400 });
  }

  const text = buildMessage(event, time, division || "", name);
  const date = new Date().toISOString();
  const salt = crypto.randomUUID();
  const signature = await hmacSha256Hex(apiSecret, date + salt);

  const res = await fetch("https://api.solapi.com/messages/v4/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
    },
    body: JSON.stringify({
      message: {
        to: parentPhone.replace(/-/g, ""),
        from: sender.replace(/-/g, ""),
        text,
        // type을 강제로 LMS로 지정하면 Solapi가 내부적으로 subject(제목)를 채워야 해서
        // 본문이 90bytes(한글 45자) 이하인 건도 전부 LMS로 발송되고 있었다(요금 3배).
        // type을 아예 안 보내면 계정에 이미 켜져 있는 autoTypeDetect가 바이트 수 기준으로
        // SMS/LMS를 알아서 고른다 — 이미지·파일을 안 보내니 MMS로 잘못 잡힐 일도 없다.
      },
    }),
  });

  const resultText = await res.text();
  if (!res.ok) {
    console.error("Solapi 발송 실패", res.status, resultText);
    return new Response(JSON.stringify({ error: "solapi send failed", detail: resultText }), { status: 502 });
  }

  return new Response(resultText, { status: 200, headers: { "Content-Type": "application/json" } });
});
