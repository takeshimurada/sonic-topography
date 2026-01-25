import dotenv from "dotenv";

dotenv.config();

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

console.log("🔍 Spotify API 인증 테스트");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`Client ID: ${CLIENT_ID ? CLIENT_ID.slice(0, 10) + "..." : "❌ 없음"}`);
console.log(`Client Secret: ${CLIENT_SECRET ? CLIENT_SECRET.slice(0, 10) + "..." : "❌ 없음"}`);
console.log();

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("❌ .env 파일에 SPOTIFY_CLIENT_ID 또는 SPOTIFY_CLIENT_SECRET이 없습니다!");
  process.exit(1);
}

console.log("🔄 Spotify API 토큰 발급 시도...");

const body = new URLSearchParams();
body.set("grant_type", "client_credentials");

const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

try {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10초 타임아웃

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  console.log(`HTTP Status: ${response.status} ${response.statusText}`);
  console.log();

  if (!response.ok) {
    const errorText = await response.text();
    console.error("❌ API 에러 응답:");
    console.error(errorText);
    process.exit(1);
  }

  const data = await response.json();
  console.log("✅ 토큰 발급 성공!");
  console.log(`Access Token: ${data.access_token?.slice(0, 20)}...`);
  console.log(`Token Type: ${data.token_type}`);
  console.log(`Expires In: ${data.expires_in}초`);
  console.log();
  console.log("🎉 Spotify API 인증이 정상적으로 작동합니다!");

} catch (error) {
  if (error.name === 'AbortError') {
    console.error("❌ 타임아웃: Spotify API가 10초 내에 응답하지 않았습니다.");
    console.error("   네트워크 연결을 확인해주세요.");
  } else {
    console.error("❌ 에러 발생:");
    console.error(error.message);
  }
  process.exit(1);
}
