use std::env;
use std::sync::Arc;
use std::time::Duration;

use axum::body::Body;
use axum::extract::{Path, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;
use tokio_stream::wrappers::ReceiverStream;

use crate::AppState;

#[derive(Deserialize)]
struct ChatRequest {
    #[serde(default)]
    session_id: Option<String>,
    #[serde(default)]
    mode: Option<String>,
    #[serde(default)]
    tool: Option<String>,
    #[serde(default)]
    image: Option<String>,
    message: String,
}

const TOOLS: [&str; 4] = ["tax", "retirement", "budget", "stock"];

// Groq chat model: llama-3.3-70b-versatile is the free tier; llama-4-scout on
// Groq needs a paid Groq plan. Swap this constant when that flips.
const GROQ_CHAT_MODEL: &str = "llama-3.3-70b-versatile";
const GROQ_EXTRACT_MODEL: &str = "llama-3.3-70b-versatile";

fn groq_key() -> Option<String> {
    env::var("GROQ_API_KEY").ok().filter(|k| !k.is_empty())
}

fn tool_system(tool: &str) -> Option<&'static str> {
    match tool {
        "tax" => Some(
            "You are Cartis's India tax specialist. Use the user's financial context and Indian tax law (FY 2026-27): \
             Section 80C up to ₹1.5L (PPF, ELSS, EPF, life insurance), 80D health insurance (₹25k self/family, ₹50k senior \
             parents), HRA exemption vs standard deduction, and the old vs new regime comparison (new regime slabs: 0-3L 0%, \
             3-7L 5%, 7-10L 10%, 10-12L 15%, 12-15L 20%, >15L 30%, standard deduction ₹75k; old regime: 2.5-5L 5%, 5-10L 20%, \
             >10L 30%, standard deduction ₹50k). Suggest concrete deductions available to this user.",
        ),
        "retirement" => Some(
            "You are Cartis's retirement planner. Advise using SIP math at a 12% pre-tax equity return assumption and 6% \
             inflation: projected corpus = PV(1+r)^n + SIP*(((1+r)^n-1)/r), monthly retirement income ≈ 4% SWR on corpus, \
             adjusted to today's rupees for inflation. Be conservative and honest about assumptions.",
        ),
        "budget" => Some(
            "You are Cartis's budget coach. Anchor suggestions in the user's actual spending, monthly tab limit, and \
             income. Round budgets to ₹500, respect income-minus-savings caps, and prefer achievable nudges over drastic cuts.",
        ),
        "stock" => Some(
            "You are Cartis's equity analyst. Use only facts about the user's portfolio and holdings. For current prices \
             refer the user to the Stock tool; do not invent prices, returns, or recommendations. Keep advice educational.",
        ),
        _ => None,
    }
}

#[derive(Deserialize)]
pub struct CreateSessionRequest {
    mode: String,
}

#[derive(Deserialize)]
pub struct RenameSessionRequest {
    title: String,
}

#[derive(Serialize, Deserialize)]
struct SessionOut {
    session_id: String,
    mode: String,
    title: String,
    updated_at: String,
}

#[derive(Serialize, Deserialize)]
struct MessageOut {
    role: String,
    content: String,
    created_at: String,
}

#[derive(Clone)]
struct Msg {
    role: String,
    content: String,
}

fn uid_from(headers: &HeaderMap) -> Option<String> {
    headers
        .get("x-user-id")
        .and_then(|v| v.to_str().ok())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
}

fn json_err(status: StatusCode, msg: &str) -> Response {
    (status, Json(serde_json::json!({ "error": msg }))).into_response()
}

pub async fn chat_stream(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: String,
) -> Response {
    let Some(uid) = uid_from(&headers) else {
        return json_err(StatusCode::UNAUTHORIZED, "missing x-user-id");
    };

    let req: ChatRequest = match serde_json::from_str(&body) {
        Ok(r) => r,
        Err(_) => return json_err(StatusCode::BAD_REQUEST, "invalid json"),
    };
    let message = req.message.trim().to_string();
    let has_image = req
        .image
        .as_deref()
        .map(str::trim)
        .is_some_and(|s| !s.is_empty());
    if message.is_empty() && !has_image {
        return json_err(StatusCode::BAD_REQUEST, "message required");
    }

    match crate::usage::bump(&state, &uid, "ai_chat").await {
        Ok(true) => {}
        Ok(false) => return json_err(StatusCode::TOO_MANY_REQUESTS, "daily AI chat limit reached — upgrade for more"),
        Err(e) => {
            eprintln!("usage gate error: {e}");
        }
    }

    let conn = match state.pg.get().await {
        Ok(c) => c,
        Err(e) => {
            eprintln!("chat db error: {e}");
            return json_err(StatusCode::INTERNAL_SERVER_ERROR, "db error");
        }
    };

    let image = req
        .image
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string);
    if let Some(img) = &image {
        if !img.starts_with("data:image/")
            || !["png", "jpeg", "jpg", "webp", "gif"]
                .iter()
                .any(|e| img.starts_with(&format!("data:image/{e};base64,")))
        {
            return json_err(
                StatusCode::BAD_REQUEST,
                "image must be a base64 data URL (png/jpeg/webp/gif)",
            );
        }
        if img.len() > 10_000_000 {
            return json_err(StatusCode::BAD_REQUEST, "image too large");
        }
        let plan: String = match conn
            .query_one("SELECT plan FROM users WHERE user_id::text = $1", &[&uid])
            .await
        {
            Ok(r) => r.get(0),
            Err(_) => "free".to_string(),
        };
        if plan == "free" {
            return json_err(
                StatusCode::PAYMENT_REQUIRED,
                "Image input is a Pro feature — upgrade to use it",
            );
        }
    }

    // Resolve session: verify ownership if given, else create one.
    let sid = req
        .session_id
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());
    let (session_id, mode, tool) = match sid {
        Some(sid) => {
            match conn
                .query_opt(
                    "SELECT mode, COALESCE(tool, '') FROM chat_sessions WHERE session_id::text = $1 AND user_id::text = $2",
                    &[&sid, &uid],
                )
                .await
            {
                Ok(Some(r)) => (sid, r.get::<_, String>(0), r.get::<_, String>(1)),
                Ok(None) => return json_err(StatusCode::NOT_FOUND, "session not found"),
                Err(e) => {
                    eprintln!("chat session lookup error: {e}");
                    return json_err(StatusCode::INTERNAL_SERVER_ERROR, "db error");
                }
            }
        }
        None => {
            let mode = req
                .mode
                .as_deref()
                .filter(|m| *m == "seller")
                .map(|_| "seller")
                .unwrap_or("consumer");
            let tool = req
                .tool
                .as_deref()
                .filter(|t| TOOLS.contains(t))
                .unwrap_or("");
            let title: String = message
                .chars()
                .take(60)
                .collect::<String>()
                .trim()
                .to_string();
            match conn
                .query_one(
                    "INSERT INTO chat_sessions (user_id, mode, tool, title) VALUES ($1::text::uuid, $2, NULLIF($4, ''), $3) RETURNING session_id::text",
                    &[&uid, &mode, &title, &tool],
                )
                .await
            {
                Ok(r) => (r.get::<_, String>(0), mode.to_string(), tool.to_string()),
                Err(e) => {
                    eprintln!("chat session create error: {e}");
                    return json_err(StatusCode::INTERNAL_SERVER_ERROR, "db error");
                }
            }
        }
    };
    drop(conn);

    let seller = mode == "seller";
    let model = match fetch_model(&state, &uid).await {
        Ok(Some(m)) if !m.is_empty() => m,
        _ => DEFAULT_MODEL.to_string(),
    };
    let tier = context_tier(&model);
    let ctx_key = format!("cartis:{uid}:chat_context:{seller}:{tier:?}");
    let cached_ctx = state.redis.get(&ctx_key).await;
    let (context, memories, history) = tokio::join!(
        async {
            if let Some(c) = cached_ctx {
                return c;
            }
            let c = match build_context(&state, &uid, seller, tier).await {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("chat context error: {e}");
                    "No data available.".to_string()
                }
            };
            state.redis.set(&ctx_key, &c, 900).await;
            c
        },
        memory_context(&state, &uid, &message),
        async {
            match load_history(&state, &session_id).await {
                Ok(h) => h,
                Err(e) => {
                    eprintln!("chat history error: {e}");
                    vec![]
                }
            }
        },
    );
    let mut system = system_prompt(seller, &context);
    if !memories.is_empty() {
        system = format!("{system}\n\n{memories}");
    }
    if let Some(t) = tool_system(&tool) {
        system = format!("{t}\n\n{system}");
    }
    if image.is_some() {
        system = format!("{system}\n\nThe user attached a photo. If it shows a purchase (receipt, invoice, or product photo): extract each product bought (name, quantity, price if visible) and, in seller mode, list which items should be added to inventory. Never invent values not visible in the image — say clearly what you cannot read.");
    }

    let mut llm_history = history;
    llm_history.push(Msg {
        role: "user".to_string(),
        content: message.clone(),
    });

    let (tx, rx) = mpsc::channel::<String>(64);
    tokio::spawn(persist_and_stream(
        system,
        llm_history,
        model,
        tx,
        state,
        session_id.clone(),
        uid,
        message,
        image,
        mode,
    ));

    let stream = ReceiverStream::new(rx).map(Ok::<String, std::io::Error>);
    Response::builder()
        .status(StatusCode::OK)
        .header("content-type", "text/event-stream")
        .header("cache-control", "no-cache")
        .body(Body::from_stream(stream))
        .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response())
}

fn llm_content(m: &Msg, image: Option<&str>) -> serde_json::Value {
    match image {
        Some(url) if m.role == "user" => serde_json::json!([
            { "type": "text", "text": m.content },
            { "type": "image_url", "image_url": { "url": url } }
        ]),
        _ => serde_json::json!(m.content),
    }
}

#[derive(Deserialize)]
pub struct TranscribeRequest {
    audio: String,
}

pub async fn transcribe(
    state: State<Arc<AppState>>,
    headers: HeaderMap,
    body: axum::body::Bytes,
) -> Response {
    let Some(uid) = uid_from(&headers) else {
        return json_err(StatusCode::UNAUTHORIZED, "missing x-user-id");
    };
    if body.len() > 12_000_000 {
        return json_err(StatusCode::BAD_REQUEST, "audio too large");
    }
    if !headers
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .starts_with("audio/")
    {
        return json_err(StatusCode::BAD_REQUEST, "content-type must be audio/*");
    }
    let conn = match state.pg.get().await {
        Ok(c) => c,
        Err(e) => {
            eprintln!("transcribe db error: {e}");
            return json_err(StatusCode::INTERNAL_SERVER_ERROR, "db error");
        }
    };
    let plan: String = match conn
        .query_one("SELECT plan FROM users WHERE user_id::text = $1", &[&uid])
        .await
    {
        Ok(r) => r.get(0),
        Err(_) => "free".to_string(),
    };
    if plan == "free" {
        return json_err(
            StatusCode::PAYMENT_REQUIRED,
            "Voice input is a Max feature — upgrade to use it",
        );
    }
    let token = match crate::insights::ai_token().await {
        Ok(t) => t,
        Err(e) => return json_err(StatusCode::INTERNAL_SERVER_ERROR, &e),
    };
    let account = match env::var("CF_ACCOUNT_ID") {
        Ok(a) if !a.is_empty() => a,
        _ => return json_err(StatusCode::INTERNAL_SERVER_ERROR, "CF_ACCOUNT_ID not set"),
    };
    let url = format!(
        "https://api.cloudflare.com/client/v4/accounts/{account}/ai/run/@cf/openai/whisper-large-v3-turbo"
    );
    let content_type = headers
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("audio/wav")
        .to_string();
    if let Some(key) = groq_key() {
        let audio = body.to_vec();
        let part = match reqwest::multipart::Part::bytes(audio.clone())
            .file_name("audio.webm")
            .mime_str(&content_type)
        {
            Ok(p) => p,
            Err(_) => reqwest::multipart::Part::bytes(audio).file_name("audio.webm"),
        };
        let form = reqwest::multipart::Form::new()
            .part("file", part)
            .text("model", "whisper-large-v3-turbo")
            .text("response_format", "json");
        let res = match reqwest::Client::new()
            .post("https://api.groq.com/openai/v1/audio/transcriptions")
            .bearer_auth(&key)
            .multipart(form)
            .send()
            .await
        {
            Ok(r) => r,
            Err(e) => {
                return json_err(StatusCode::INTERNAL_SERVER_ERROR, &format!("ai error: {e}"))
            }
        };
        let json: serde_json::Value = match res.json().await {
            Ok(j) => j,
            Err(_) => return json_err(StatusCode::BAD_GATEWAY, "ai bad response"),
        };
        return match json.get("text").and_then(|t| t.as_str()) {
            Some(text) => (StatusCode::OK, Json(serde_json::json!({ "text": text }))).into_response(),
            None => json_err(
                StatusCode::BAD_GATEWAY,
                &json.to_string().chars().take(200).collect::<String>(),
            ),
        };
    }
    let res = match reqwest::Client::new()
        .post(&url)
        .bearer_auth(&token)
        .header("content-type", &content_type)
        .body(body.to_vec())
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => return json_err(StatusCode::INTERNAL_SERVER_ERROR, &format!("ai error: {e}")),
    };
    let json: serde_json::Value = match res.json().await {
        Ok(j) => j,
        Err(_) => return json_err(StatusCode::BAD_GATEWAY, "ai bad response"),
    };
    if let Some(text) = json.pointer("/result/text").and_then(|t| t.as_str()) {
        return (StatusCode::OK, Json(serde_json::json!({ "text": text }))).into_response();
    }
    if let Some(err) = json.pointer("/errors/0/message").and_then(|t| t.as_str()) {
        return json_err(StatusCode::BAD_GATEWAY, err);
    }
    json_err(
        StatusCode::BAD_GATEWAY,
        &json.to_string().chars().take(200).collect::<String>(),
    )
}

async fn load_history(
    state: &Arc<AppState>,
    session_id: &str,
) -> Result<Vec<Msg>, Box<dyn std::error::Error>> {
    let rows = state
        .pg
        .get()
        .await?
        .query(
            "SELECT role, content FROM chat_messages WHERE session_id::text = $1 ORDER BY id DESC LIMIT 20",
            &[&session_id],
        )
        .await?;
    Ok(rows
        .iter()
        .rev()
        .map(|r| Msg {
            role: r.get(0),
            content: r.get(1),
        })
        .collect())
}

// Semantic long-term memory: embed the user's message (bge-m3 via Cloudflare
// AI) and pull the most relevant past chat turns from chat_memories by cosine
// distance. Returns a prompt section, or empty string on any failure — memory
// must never block or break a chat.
async fn memory_context(state: &Arc<AppState>, uid: &str, message: &str) -> String {
    let conn = match state.pg.get().await {
        Ok(c) => c,
        Err(_) => return String::new(),
    };
    let has_memories: bool = match conn
        .query_one(
            "SELECT EXISTS(SELECT 1 FROM chat_memories WHERE user_id::text = $1)",
            &[&uid],
        )
        .await
    {
        Ok(r) => r.get(0),
        Err(e) => {
            eprintln!("memory: exists query failed: {e}");
            return String::new();
        }
    };
    if !has_memories {
        return String::new();
    }
    drop(conn);
    let token = match crate::insights::ai_token().await {
        Ok(t) => t,
        Err(_) => return String::new(),
    };
    let Ok(account) = env::var("CF_ACCOUNT_ID") else {
        return String::new();
    };
    let client = reqwest::Client::new();
    let res = match client
        .post(format!(
            "https://api.cloudflare.com/client/v4/accounts/{account}/ai/run/@cf/baai/bge-m3"
        ))
        .bearer_auth(&token)
        .timeout(Duration::from_secs(30))
        .json(&serde_json::json!({ "text": [message] }))
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            eprintln!("memory: embed call failed: {e}");
            return String::new();
        }
    };
    if !res.status().is_success() {
        eprintln!("memory: embed status {}", res.status().as_u16());
        return String::new();
    }
    let Ok(json) = res.json::<serde_json::Value>().await else {
        eprintln!("memory: embed json parse failed");
        return String::new();
    };
    let Some(embedding) = json
        .pointer("/result/data/0")
        .and_then(|v| v.as_array())
        .map(|v| {
            v.iter()
                .map(|x| x.as_f64().unwrap_or(0.0))
                .collect::<Vec<f64>>()
        })
    else {
        eprintln!("memory: embed response shape unexpected");
        return String::new();
    };
    let vec_sql = embedding
        .iter()
        .map(|x| x.to_string())
        .collect::<Vec<String>>()
        .join(",");
    let conn = match state.pg.get().await {
        Ok(c) => c,
        Err(_) => return String::new(),
    };
    let rows = match conn
        .query(
            "SELECT content, to_char(created_at, 'YYYY-MM-DD') FROM chat_memories
             WHERE user_id::text = $1::text
             ORDER BY embedding <=> $2::text::vector
             LIMIT 4",
            &[&uid, &format!("[{vec_sql}]")],
        )
        .await
    {
        Ok(r) => r,
        Err(e) => {
            eprintln!("memory: recall query failed: {e}");
            return String::new();
        }
    };
    eprintln!("memory: recall got {} rows", rows.len());
    if rows.is_empty() {
        return String::new();
    }
let parts: Vec<String> = rows
        .iter()
        .map(|r| {
            let content: String = r.get(0);
            let date: String = r.get(1);
            format!("[{date}] {content}")
        })
        .collect();
    format!("Past conversation memories (from this user's older chats):\n{}", parts.join("\n"))
}

pub async fn create_session(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(req): Json<CreateSessionRequest>,
) -> Response {
    let Some(uid) = uid_from(&headers) else {
        return json_err(StatusCode::UNAUTHORIZED, "missing x-user-id");
    };
    let mode = if req.mode == "seller" { "seller" } else { "consumer" };
    let conn = match state.pg.get().await {
        Ok(c) => c,
        Err(e) => {
            eprintln!("chat db error: {e}");
            return json_err(StatusCode::INTERNAL_SERVER_ERROR, "db error");
        }
    };
    match conn
        .query_one(
            "INSERT INTO chat_sessions (user_id, mode, title) VALUES ($1::text::uuid, $2, 'New chat') RETURNING session_id::text, mode, title, updated_at::text",
            &[&uid, &mode],
        )
        .await
    {
        Ok(r) => {
            state.redis.del(&[&format!("cartis:{uid}:chat_sessions")]).await;
            Json(SessionOut {
                session_id: r.get(0),
                mode: r.get(1),
                title: r.get(2),
                updated_at: r.get(3),
            })
            .into_response()
        }
        Err(e) => {
            eprintln!("chat session create error: {e}");
            json_err(StatusCode::INTERNAL_SERVER_ERROR, "db error")
        }
    }
}

pub async fn delete_session(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(session_id): Path<String>,
) -> Response {
    let Some(uid) = uid_from(&headers) else {
        return json_err(StatusCode::UNAUTHORIZED, "missing x-user-id");
    };
    let conn = match state.pg.get().await {
        Ok(c) => c,
        Err(e) => {
            eprintln!("chat db error: {e}");
            return json_err(StatusCode::INTERNAL_SERVER_ERROR, "db error");
        }
    };
    match conn
        .execute(
            "DELETE FROM chat_sessions WHERE session_id::text = $1 AND user_id::text = $2",
            &[&session_id, &uid],
        )
        .await
    {
        Ok(0) => json_err(StatusCode::NOT_FOUND, "session not found"),
        Ok(_) => {
            state
                .redis
                .del(&[
                    &format!("cartis:{uid}:chat_sessions"),
                    &format!("cartis:{session_id}:chat_messages"),
                ])
                .await;
            Json(serde_json::json!({ "ok": true })).into_response()
        }
        Err(e) => {
            eprintln!("chat session delete error: {e}");
            json_err(StatusCode::INTERNAL_SERVER_ERROR, "db error")
        }
    }
}

pub async fn rename_session(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(session_id): Path<String>,
    Json(req): Json<RenameSessionRequest>,
) -> Response {
    let Some(uid) = uid_from(&headers) else {
        return json_err(StatusCode::UNAUTHORIZED, "missing x-user-id");
    };
    let title = req.title.trim().to_string();
    if title.is_empty() {
        return json_err(StatusCode::BAD_REQUEST, "title required");
    }
    let conn = match state.pg.get().await {
        Ok(c) => c,
        Err(e) => {
            eprintln!("chat db error: {e}");
            return json_err(StatusCode::INTERNAL_SERVER_ERROR, "db error");
        }
    };
    match conn
        .query_opt(
            "UPDATE chat_sessions SET title = $1 WHERE session_id::text = $2 AND user_id::text = $3 RETURNING session_id::text, mode, title, updated_at::text",
            &[&title, &session_id, &uid],
        )
        .await
    {
        Ok(Some(r)) => {
            state.redis.del(&[&format!("cartis:{uid}:chat_sessions")]).await;
            Json(SessionOut {
                session_id: r.get(0),
                mode: r.get(1),
                title: r.get(2),
                updated_at: r.get(3),
            })
            .into_response()
        }
        Ok(None) => json_err(StatusCode::NOT_FOUND, "session not found"),
        Err(e) => {
            eprintln!("chat session rename error: {e}");
            json_err(StatusCode::INTERNAL_SERVER_ERROR, "db error")
        }
    }
}

pub async fn list_sessions(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Response {
    let Some(uid) = uid_from(&headers) else {
        return json_err(StatusCode::UNAUTHORIZED, "missing x-user-id");
    };
    let key = format!("cartis:{uid}:chat_sessions");
    if let Some(cached) = state.redis.get(&key).await {
        if let Ok(json) = serde_json::from_str::<Vec<SessionOut>>(&cached) {
            return Json(json).into_response();
        }
    }
    let conn = match state.pg.get().await {
        Ok(c) => c,
        Err(e) => {
            eprintln!("chat db error: {e}");
            return json_err(StatusCode::INTERNAL_SERVER_ERROR, "db error");
        }
    };
    match conn
        .query(
            "SELECT session_id::text, mode, title, updated_at::text FROM chat_sessions WHERE user_id::text = $1 ORDER BY updated_at DESC LIMIT 50",
            &[&uid],
        )
        .await
    {
        Ok(rows) => {
            let out: Vec<SessionOut> = rows
                .iter()
                .map(|r| SessionOut {
                    session_id: r.get(0),
                    mode: r.get(1),
                    title: r.get(2),
                    updated_at: r.get(3),
                })
                .collect();
            if let Ok(json) = serde_json::to_string(&out) {
                state.redis.set(&key, &json, 30).await;
            }
            Json(out).into_response()
        }
        Err(e) => {
            eprintln!("chat sessions error: {e}");
            json_err(StatusCode::INTERNAL_SERVER_ERROR, "db error")
        }
    }
}

pub async fn session_messages(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(session_id): Path<String>,
) -> Response {
    let Some(uid) = uid_from(&headers) else {
        return json_err(StatusCode::UNAUTHORIZED, "missing x-user-id");
    };
    let key = format!("cartis:{session_id}:chat_messages");
    if let Some(cached) = state.redis.get(&key).await {
        if let Ok(json) = serde_json::from_str::<Vec<MessageOut>>(&cached) {
            return Json(json).into_response();
        }
    }
    let conn = match state.pg.get().await {
        Ok(c) => c,
        Err(e) => {
            eprintln!("chat db error: {e}");
            return json_err(StatusCode::INTERNAL_SERVER_ERROR, "db error");
        }
    };
    match conn
        .query(
            "SELECT m.role, m.content, m.created_at::text FROM chat_messages m JOIN chat_sessions s ON s.session_id = m.session_id WHERE m.session_id::text = $1 AND s.user_id::text = $2 ORDER BY m.id",
            &[&session_id, &uid],
        )
        .await
    {
        Ok(rs) => {
            let out: Vec<MessageOut> = rs
                .iter()
                .map(|r| MessageOut {
                    role: r.get(0),
                    content: r.get(1),
                    created_at: r.get(2),
                })
                .collect();
            if let Ok(json) = serde_json::to_string(&out) {
                state.redis.set(&key, &json, 30).await;
            }
            Json(out).into_response()
        }
        Err(e) => {
            eprintln!("chat messages error: {e}");
            json_err(StatusCode::INTERNAL_SERVER_ERROR, "db error")
        }
    }
}

fn sse(data: &str) -> String {
    format!("data: {data}\n\n")
}

async fn persist_and_stream(
    system: String,
    messages: Vec<Msg>,
    model: String,
    tx: mpsc::Sender<String>,
    state: Arc<AppState>,
    session_id: String,
    uid: String,
    user_message: String,
    image: Option<String>,
    mode: String,
) {
    let send = |data: String| async {
        let _ = tx.send(data).await;
    };

    send(sse(&serde_json::json!({ "sessionId": session_id }).to_string())).await;

    let is_groq = groq_key().is_some();
    let (url, bearer) = if is_groq {
        (
            "https://api.groq.com/openai/v1/chat/completions".to_string(),
            groq_key().unwrap(),
        )
    } else {
        let token = match crate::insights::ai_token().await {
            Ok(t) => t,
            Err(e) => {
                send(sse(&format!(r#"{{"error":"{e}"}}"#))).await;
                return;
            }
        };
        let account = match env::var("CF_ACCOUNT_ID") {
            Ok(a) if !a.is_empty() => a,
            _ => {
                send(sse(r#"{"error":"CF_ACCOUNT_ID not set"}"#)).await;
                return;
            }
        };
        (
            format!("https://api.cloudflare.com/client/v4/accounts/{account}/ai/run/{model}"),
            token,
        )
    };

    let llm_messages: Vec<serde_json::Value> = std::iter::once(serde_json::json!({
        "role": "system",
        "content": system,
    }))
    .chain(messages.iter().enumerate().map(|(i, m)| {
        let is_last_user = i == messages.len() - 1 && m.role == "user";
        serde_json::json!({ "role": m.role, "content": llm_content(m, image.as_deref().filter(|_| is_last_user)) })
    }))
    .collect();

    let mut payload = serde_json::json!({
        "messages": llm_messages,
        "stream": true,
        "max_tokens": 1024,
    });
    if is_groq {
        payload["model"] = serde_json::json!(GROQ_CHAT_MODEL);
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(90))
        .build();
    let client = match client {
        Ok(c) => c,
        Err(e) => {
            send(sse(&format!(r#"{{"error":"{e}"}}"#))).await;
            return;
        }
    };

    let res = match client
        .post(&url)
        .bearer_auth(&bearer)
        .header("x-session-affinity", &session_id)
        .json(&payload)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            send(sse(&format!(r#"{{"error":"{e}"}}"#))).await;
            return;
        }
    };
    if !res.status().is_success() {
        let status = res.status().as_u16();
        let body = res.text().await.unwrap_or_default();
        let detail = body.chars().take(300).collect::<String>();
        send(sse(&format!(r#"{{"error":"ai status {status}: {detail}"}}"#))).await;
        return;
    }

    let mut full = String::new();
    let mut stream = res.bytes_stream();
    let mut buf = String::new();
    while let Some(chunk) = stream.next().await {
        let Ok(chunk) = chunk else { break };
        buf.push_str(&String::from_utf8_lossy(&chunk));
        for line in buf.split('\n') {
            let line = line.trim();
            if !line.starts_with("data:") {
                continue;
            }
            let data = line["data:".len()..].trim();
            if data.is_empty() {
                continue;
            }
            if data == "[DONE]" {
                if let Some(capture) = extract_captures(is_groq, &user_message, &full).await {
                    send(sse(&serde_json::json!({ "capture": capture }).to_string())).await;
                }
                persist_turn(&state, &uid, &session_id, &user_message, &full, &mode).await;
                send(sse("[DONE]")).await;
                return;
            }
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(data) {
                if let Some(u) = v.pointer("/usage") {
                    eprintln!("chat usage ({model}): {u}");
                }
                if let Some(content) = v
                    .pointer("/choices/0/delta/content")
                    .and_then(|c| c.as_str())
                {
                    if !content.is_empty() {
                        full.push_str(content);
                        let ev = serde_json::json!({ "token": content });
                        send(sse(&ev.to_string())).await;
                    }
                }
            }
        }
        buf.clear();
    }
    if let Some(capture) = extract_captures(is_groq, &user_message, &full).await {
        send(sse(&serde_json::json!({ "capture": capture }).to_string())).await;
    }
    persist_turn(&state, &uid, &session_id, &user_message, &full, &mode).await;
    send(sse("[DONE]")).await;
}

// One-shot capture of goal / holding / profile / budget facts from the last exchange.
// Four cheap model calls run in parallel; fail-open (empty object on any error — chat unaffected).
const GOAL_PROMPT: &str = "You extract one saveable financial goal from a finance chat exchange. Given the last user message and assistant reply, return ONLY a JSON object — no prose, no markdown fences. If the exchange contains a concrete goal with a real amount, return {\"goal\":{\"goal_type\":\"<emergency|retirement|home|education|other>\",\"name\":\"<short title>\",\"target_amount\":<INR number>,\"current_amount\":<INR number if known>}}. Otherwise return {}. A goal is a FUTURE savings target the user wants to build toward (emergency fund, retirement, house, education, trip). Never extract purchases or investments — buying stocks, a mutual fund, gold, or any asset is a holding, not a goal. Only use numbers the user stated or the assistant computed; never invent amounts — omit current_amount unless the user explicitly stated it. Convert Indian units exactly: 10 lakh = 1000000, 2.5 lakh = 250000, 1 crore = 10000000, 1 lakh = 100000.";
const HOLDING_PROMPT: &str = "You extract one portfolio holding from a finance chat exchange. Given the last user message and assistant reply, return ONLY a JSON object — no prose, no markdown fences. If the exchange contains a purchase of a FINANCIAL INSTRUMENT — stocks/shares of a company, mutual fund or SIP units, fixed deposits, gold, bonds, or similar investments — return {\"holding\":{\"asset_type\":\"<equity|mutual_fund|fd|gold|cash>\",\"name\":\"<instrument name>\",\"quantity\":<units>,\"avg_price\":<INR per unit if known>}}. Otherwise return {}. Never extract everyday consumer purchases — toiletries, groceries, food, clothes, bills, electronics, rent, or services are spending, not holdings. Only use numbers the user stated or the assistant computed; never invent prices. If only a lump-sum investment amount is stated (e.g. \"invest 50000 in a Nifty fund\"), use quantity 1 and avg_price = the amount.";
const PROFILE_PROMPT: &str = "You extract financial profile facts from a finance chat exchange. Given the last user message and assistant reply, return ONLY a JSON object — no prose, no markdown fences. If the exchange states any of the user's financial details, return {\"profile\":{\"monthly_income\":<INR/month if stated>,\"monthly_spend\":<INR/month if stated>,\"investment_pct\":<0-100 if stated>,\"housing_cost\":<INR/month if stated>,\"dependents\":<integer if stated>,\"debt_emis\":<INR/month if stated>,\"monthly_tax\":<INR/month if stated>}} with only the stated fields. Otherwise return {}. Only values the USER themselves stated in their own words count — ignore amounts the assistant merely mentions (existing tab limits, remaining balances, suggested numbers). housing_cost and debt_emis are recurring monthly costs the user pays now (rent, EMI) — never a one-time goal or investment amount, and never a value from a savings goal. Never invent, compute, or default values — omit any field the user did not explicitly state, including investment_pct. Never treat a one-off purchase (e.g. \"bought a shampoo for 300\") as monthly_spend — monthly_spend is a recurring monthly amount the user declares, not a single transaction.";
const BUDGET_PROMPT: &str = "You extract a monthly budget from a finance chat exchange. Given the last user message and assistant reply, return ONLY a JSON object — no prose, no markdown fences. Return {\"budget\":{\"limit\":<INR per month>}} ONLY if the USER explicitly set or agreed to a monthly spending budget (e.g. \"set my budget to 50k\", \"my limit is 30000\", \"keep it at 20k\"). Never extract a budget from the assistant's reply alone — mentions of an existing tab limit, remaining spend, or suggestions are not a budget the user set. Otherwise return {}.";
const PURCHASE_PROMPT: &str = "You extract one consumer product purchase from a finance chat exchange. Given the last user message and assistant reply, return ONLY a JSON object — no prose, no markdown fences. If the user bought an everyday consumer product — toiletries, shampoo, groceries, food, clothes, shoes, electronics, appliances, household goods, or similar retail items — return {\"purchase\":{\"name\":\"<product name>\",\"price\":<INR>,\"verdict\":\"<good|warning|bad>\",\"explanation\":\"<one short line on whether the price is reasonable>\",}}. Otherwise return {}. Verdict reflects the exchange: good if the assistant raised no concern, warning if it flagged the cost against the budget, bad if it advised against. Never extract financial instruments (stocks, mutual funds, gold, FD — those are holdings), rent, bills, EMIs, or services. Only use numbers the user stated or the assistant computed; never invent prices.";
const SELLER_PROMPT: &str = "You extract business finance events from a seller's chat exchange. Given the last user message and assistant reply, return ONLY a JSON object — no prose, no markdown fences. Distinguish direction: when the user SELLS, that is income; when the user BUYS goods/stock/materials for the business, that is an expense. Include any of these that apply:
{\"income\":{\"amount\":<INR>,\"category\":\"<Product sales|Online orders|Wholesale|Other>\",\"description\":\"<one line>\"}} when the user records a SALE or business income event (e.g. \"sold 3 dresses for 500 each\", \"got 12000 from an online order\").
{\"expense\":{\"entry_type\":\"<expense|cogs|salary|rent|other>\",\"amount\":<INR>,\"category\":\"<Materials|Payroll|Rent|Logistics|Utilities|Other>\",\"description\":\"<one line>\"}} when the user records a BUSINESS spend — buying stock, goods for resale, or raw material is cogs/Materials (e.g. \"bought 50 bottles of shampoo for the shop\", \"bought raw material for 1500\"); wages are salary/Payroll, premises are rent/Rent, anything else is expense/Other (e.g. \"paid 8000 salary\", \"paid 12000 shop rent\").
{\"inventory\":{\"name\":\"<item>\",\"stock\":<qty>,\"unit_cost\":<INR per unit if known>}} when the user orders or restocks inventory (e.g. \"ordered 50 bottles of shampoo at 40 each\").
Never extract personal consumer purchases (products bought for personal use, subscriptions, personal bills) as income/expense — those are purchases, not business events. Only use numbers the user stated or the assistant computed; never invent amounts. Return {} when nothing applies.";

fn validate_goal(parsed: &serde_json::Value) -> Option<serde_json::Value> {
    let goal = parsed.get("goal")?;
    let goal_type = goal.get("goal_type")?.as_str()?;
    const KINDS: [&str; 5] = ["emergency", "retirement", "home", "education", "other"];
    if !KINDS.contains(&goal_type) {
        return None;
    }
    let name = goal.get("name")?.as_str()?;
    if name.trim().is_empty() {
        return None;
    }
    let target = goal.get("target_amount").and_then(|v| v.as_f64())?;
    if target <= 0.0 {
        return None;
    }
    let mut out = serde_json::Map::new();
    out.insert("goal_type".into(), serde_json::Value::String(goal_type.to_string()));
    out.insert("name".into(), serde_json::Value::String(name.trim().to_string()));
    out.insert("target_amount".into(), serde_json::Value::from(target));
    if let Some(cur) = goal.get("current_amount").and_then(|v| v.as_f64()) {
        if cur > 0.0 {
            out.insert("current_amount".into(), serde_json::Value::from(cur));
        }
    }
    Some(serde_json::Value::Object(out))
}

fn validate_holding(parsed: &serde_json::Value) -> Option<serde_json::Value> {
    let holding = parsed.get("holding")?;
    let asset_type = holding.get("asset_type")?.as_str()?;
    const KINDS: [&str; 5] = ["equity", "mutual_fund", "fd", "gold", "cash"];
    if !KINDS.contains(&asset_type) {
        return None;
    }
    let name = holding.get("name")?.as_str()?;
    if name.trim().is_empty() {
        return None;
    }
    let quantity = holding.get("quantity").and_then(|v| v.as_f64())?;
    if quantity <= 0.0 {
        return None;
    }
    let mut out = serde_json::Map::new();
    out.insert("asset_type".into(), serde_json::Value::String(asset_type.to_string()));
    out.insert("name".into(), serde_json::Value::String(name.trim().to_string()));
    out.insert("quantity".into(), serde_json::Value::from(quantity));
    if let Some(price) = holding.get("avg_price").and_then(|v| v.as_f64()) {
        if price > 0.0 {
            out.insert("avg_price".into(), serde_json::Value::from(price));
        }
    }
    Some(serde_json::Value::Object(out))
}

fn validate_profile(parsed: &serde_json::Value) -> Option<serde_json::Value> {
    let profile = parsed.get("profile")?;
    let mut out = serde_json::Map::new();
    let mut any = false;
    let mut add_num = |key: &'static str, v: &serde_json::Value| {
        if let Some(n) = v.as_f64() {
            if n > 0.0 {
                out.insert(key.into(), serde_json::Value::from(n));
                any = true;
            }
        }
    };
    for key in [
        "monthly_income",
        "monthly_spend",
        "housing_cost",
        "debt_emis",
        "monthly_tax",
    ] {
        if let Some(v) = profile.get(key) {
            add_num(key, v);
        }
    }
    if let Some(pct) = profile.get("investment_pct").and_then(|v| v.as_f64()) {
        if pct > 0.0 && pct <= 100.0 {
            out.insert("investment_pct".into(), serde_json::Value::from(pct));
            any = true;
        }
    }
    if let Some(dep) = profile.get("dependents").and_then(|v| v.as_f64()) {
        if dep >= 0.0 && dep <= 20.0 && dep.fract() == 0.0 {
            out.insert("dependents".into(), serde_json::Value::from(dep as i64));
            any = true;
        }
    }
    if any {
        Some(serde_json::Value::Object(out))
    } else {
        None
    }
}

fn validate_budget(parsed: &serde_json::Value) -> Option<serde_json::Value> {
    let budget = parsed.get("budget")?;
    let limit = budget.get("limit").and_then(|v| v.as_f64())?;
    if limit <= 0.0 {
        return None;
    }
    Some(serde_json::json!({ "limit": limit }))
}

fn validate_purchase(parsed: &serde_json::Value) -> Option<serde_json::Value> {
    let purchase = parsed.get("purchase")?;
    let name = purchase.get("name")?.as_str()?;
    if name.trim().is_empty() {
        return None;
    }
    let price = purchase.get("price").and_then(|v| v.as_f64())?;
    if price <= 0.0 {
        return None;
    }
    let verdict = purchase.get("verdict").and_then(|v| v.as_str()).unwrap_or("good");
    const KINDS: [&str; 3] = ["good", "warning", "bad"];
    if !KINDS.contains(&verdict) {
        return None;
    }
    let mut out = serde_json::Map::new();
    out.insert("name".into(), serde_json::Value::String(name.trim().to_string()));
    out.insert("price".into(), serde_json::Value::from(price));
    out.insert("verdict".into(), serde_json::Value::String(verdict.to_string()));
    if let Some(explanation) = purchase.get("explanation").and_then(|v| v.as_str()) {
        if !explanation.trim().is_empty() {
            out.insert("explanation".into(), serde_json::Value::String(explanation.trim().to_string()));
        }
    }
    Some(serde_json::Value::Object(out))
}

fn validate_income(parsed: &serde_json::Value) -> Option<serde_json::Value> {
    let income = parsed.get("income")?;
    let amount = income.get("amount").and_then(|v| v.as_f64())?;
    if amount <= 0.0 {
        return None;
    }
    let category = income.get("category").and_then(|v| v.as_str()).unwrap_or("Other");
    const CATS: [&str; 4] = ["Product sales", "Online orders", "Wholesale", "Other"];
    let category = if CATS.contains(&category) { category } else { "Other" };
    let mut out = serde_json::Map::new();
    out.insert("entry_type".into(), serde_json::Value::String("revenue".to_string()));
    out.insert("amount".into(), serde_json::Value::from(amount));
    out.insert("category".into(), serde_json::Value::String(category.to_string()));
    if let Some(desc) = income.get("description").and_then(|v| v.as_str()) {
        if !desc.trim().is_empty() {
            out.insert("description".into(), serde_json::Value::String(desc.trim().to_string()));
        }
    }
    Some(serde_json::Value::Object(out))
}

fn validate_expense(parsed: &serde_json::Value) -> Option<serde_json::Value> {
    let expense = parsed.get("expense")?;
    let amount = expense.get("amount").and_then(|v| v.as_f64())?;
    if amount <= 0.0 {
        return None;
    }
    let entry_type = expense.get("entry_type").and_then(|v| v.as_str()).unwrap_or("expense");
    const KINDS: [&str; 5] = ["expense", "cogs", "salary", "rent", "other"];
    if !KINDS.contains(&entry_type) {
        return None;
    }
    let category = expense.get("category").and_then(|v| v.as_str()).unwrap_or("Other");
    const CATS: [&str; 6] = ["Materials", "Payroll", "Rent", "Logistics", "Utilities", "Other"];
    let category = if CATS.contains(&category) { category } else { "Other" };
    let mut out = serde_json::Map::new();
    out.insert("entry_type".into(), serde_json::Value::String(entry_type.to_string()));
    out.insert("amount".into(), serde_json::Value::from(amount));
    out.insert("category".into(), serde_json::Value::String(category.to_string()));
    if let Some(desc) = expense.get("description").and_then(|v| v.as_str()) {
        if !desc.trim().is_empty() {
            out.insert("description".into(), serde_json::Value::String(desc.trim().to_string()));
        }
    }
    Some(serde_json::Value::Object(out))
}

fn validate_inventory(parsed: &serde_json::Value) -> Option<serde_json::Value> {
    let inventory = parsed.get("inventory")?;
    let name = inventory.get("name")?.as_str()?;
    if name.trim().is_empty() {
        return None;
    }
    let stock = inventory.get("stock").and_then(|v| v.as_f64())?;
    if stock <= 0.0 {
        return None;
    }
    let mut out = serde_json::Map::new();
    out.insert("name".into(), serde_json::Value::String(name.trim().to_string()));
    out.insert("stock".into(), serde_json::Value::from(stock.floor()));
    if let Some(cost) = inventory.get("unit_cost").and_then(|v| v.as_f64()) {
        if cost > 0.0 {
            out.insert("unit_cost".into(), serde_json::Value::from(cost));
        }
    }
    Some(serde_json::Value::Object(out))
}

fn pack_captures(
    goal: Option<serde_json::Value>,
    holding: Option<serde_json::Value>,
    profile: Option<serde_json::Value>,
    budget: Option<serde_json::Value>,
    purchase: Option<serde_json::Value>,
    income: Option<serde_json::Value>,
    expense: Option<serde_json::Value>,
    inventory: Option<serde_json::Value>,
) -> Option<serde_json::Value> {
    let mut out = serde_json::Map::new();
    if let Some(g) = goal {
        out.insert("goal".into(), g);
    }
    if let Some(h) = holding {
        out.insert("holding".into(), h);
    }
    if let Some(p) = profile {
        out.insert("profile".into(), p);
    }
    if let Some(b) = budget {
        out.insert("budget".into(), b);
    }
    if let Some(p) = purchase {
        // Seller exchanges (income/expense/inventory) win over the consumer-purchase
        // reading — e.g. "sold 3 dresses for 500 each" is income, not a purchase.
        if !out.contains_key("holding") && !out.contains_key("income") && !out.contains_key("expense") && !out.contains_key("inventory") {
            out.insert("purchase".into(), p);
        }
    }
    if let Some(i) = income {
        out.insert("income".into(), i);
    }
    if let Some(e) = expense {
        out.insert("expense".into(), e);
    }
    if let Some(i) = inventory {
        out.insert("inventory".into(), i);
    }
    if out.is_empty() {
        None
    } else {
        Some(serde_json::Value::Object(out))
    }
}

async fn extract_json(
    groq: bool,
    system: &str,
    user_message: &str,
    reply: &str,
) -> Option<serde_json::Value> {
    let (url, key) = if groq {
        (
            "https://api.groq.com/openai/v1/chat/completions".to_string(),
            groq_key()?,
        )
    } else {
        let account = env::var("CF_ACCOUNT_ID").ok()?;
        (
            format!(
                "https://api.cloudflare.com/client/v4/accounts/{account}/ai/run/@cf/meta/llama-3.1-8b-instruct-fp8"
            ),
            crate::insights::ai_token().await.ok()?,
        )
    };
    let mut payload = serde_json::json!({
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": format!("USER: {user_message}\n\nASSISTANT: {reply}")},
        ],
        "max_tokens": 200,
    });
    if groq {
        payload["model"] = serde_json::json!(GROQ_EXTRACT_MODEL);
    }
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .ok()?;
    let res = client.post(&url).bearer_auth(key).json(&payload).send().await.ok()?;
    if !res.status().is_success() {
        return None;
    }
    let body: serde_json::Value = res.json().await.ok()?;
    let text = body
        .pointer("/choices/0/message/content")
        .or_else(|| body.pointer("/result/response"))
        .and_then(|r| r.as_str())?;
    let text = text
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();
    serde_json::from_str(text).ok()
}

async fn extract_captures(
    groq: bool,
    user_message: &str,
    reply: &str,
) -> Option<serde_json::Value> {
    let (goal, holding, profile, budget, purchase, seller) = tokio::join!(
        async { extract_json(groq, GOAL_PROMPT, user_message, reply).await.and_then(|v| validate_goal(&v)) },
        async { extract_json(groq, HOLDING_PROMPT, user_message, reply).await.and_then(|v| validate_holding(&v)) },
        async { extract_json(groq, PROFILE_PROMPT, user_message, reply).await.and_then(|v| validate_profile(&v)) },
        async { extract_json(groq, BUDGET_PROMPT, user_message, reply).await.and_then(|v| validate_budget(&v)) },
        async { extract_json(groq, PURCHASE_PROMPT, user_message, reply).await.and_then(|v| validate_purchase(&v)) },
        async { extract_json(groq, SELLER_PROMPT, user_message, reply).await },
    );
    let income = seller.as_ref().and_then(|v| validate_income(v));
    let expense = seller.as_ref().and_then(|v| validate_expense(v));
    let inventory = seller.as_ref().and_then(|v| validate_inventory(v));
    pack_captures(goal, holding, profile, budget, purchase, income, expense, inventory)
}

async fn persist_turn(
    state: &Arc<AppState>,
    _uid: &str,
    session_id: &str,
    user_message: &str,
    assistant: &str,
    _mode: &str,
) {
    let conn = match state.pg.get().await {
        Ok(c) => c,
        Err(e) => {
            eprintln!("chat persist db error: {e}");
            return;
        }
    };
    let sid = session_id.replace('\'', "''");
    let user_esc = user_message.replace('\'', "''");
    let mut sql = format!(
        "BEGIN; INSERT INTO chat_messages (session_id, role, content) VALUES ('{sid}'::uuid, 'user', '{user_esc}'); UPDATE chat_sessions SET updated_at = now() WHERE session_id::text = '{sid}';"
    );
    if !assistant.trim().is_empty() {
        let a = assistant.replace('\'', "''");
        sql += &format!(
            " INSERT INTO chat_messages (session_id, role, content) VALUES ('{sid}'::uuid, 'assistant', '{a}');"
        );
    }
    sql += " COMMIT;";
    if let Err(e) = (&*conn).batch_execute(&sql).await {
        eprintln!("chat persist error: {e}");
    }
    drop(conn);
    state
        .redis
        .del(&[
            &format!("cartis:{session_id}:chat_messages"),
            &format!("cartis:{_uid}:chat_sessions"),
        ])
        .await;
    // Long-term memory embedding is owned by the Python embed-chats cron on
    // the server — nothing to do here.
}

fn system_prompt(seller: bool, context: &str) -> String {
    if seller {
        format!(
            "You are the Cartis AI business twin — a friendly, blunt small-business finance coach for India (₹).\nHere is the user's live business data:\n{context}\nGive concise, actionable advice (2-4 sentences). Use ₹ amounts. Focus on revenue, expenses, margins, inventory and GST. If data is missing, say so and suggest how to add it. Never invent numbers."
        )
    } else {
        format!(
            "You are the Cartis AI financial twin — a friendly, blunt personal finance coach for India (₹).\nHere is the user's live financial data:\n{context}\nGive concise, actionable advice (2-4 sentences). Use ₹ amounts. If data is missing, say so and suggest how to add it. Never invent numbers."
        )
    }
}

async fn fetch_model(state: &Arc<AppState>, uid: &str) -> Result<Option<String>, Box<dyn std::error::Error>> {
    let row = state
        .pg
        .get()
        .await?
        .query_opt(
            "SELECT ai_model FROM users WHERE user_id::text = $1",
            &[&uid],
        )
        .await?;
    Ok(row.map(|r| r.get::<_, Option<String>>(0)).flatten().map(normalize_model))
}

const DEFAULT_MODEL: &str = "@cf/meta/llama-4-scout-17b-16e-instruct";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ContextTier {
    Full,
    Compact,
}

// Context window per allowed model. Future models get appended here; any
// window below 96k resolves to the Compact context tier.
fn context_window(model: &str) -> usize {
    match model {
        DEFAULT_MODEL => 131_000,
        _ => 131_000,
    }
}

fn context_tier(model: &str) -> ContextTier {
    if context_window(model) >= 96_000 {
        ContextTier::Full
    } else {
        ContextTier::Compact
    }
}

// Compact contexts cap per-section lengths so small-window models never overflow.
fn apply_cap(parts: Vec<String>, tier: ContextTier, n: usize) -> Vec<String> {
    if tier == ContextTier::Compact {
        parts.into_iter().take(n).collect()
    } else {
        parts
    }
}

fn normalize_model(m: String) -> String {
    if m == DEFAULT_MODEL {
        m
    } else {
        DEFAULT_MODEL.to_string()
    }
}

async fn build_context(
    state: &Arc<AppState>,
    uid: &str,
    seller: bool,
    tier: ContextTier,
) -> Result<String, Box<dyn std::error::Error>> {
    let conn = state.pg.get().await?;
    let lines: Vec<String> = if seller {
        let d = conn
            .query_opt(
                "SELECT
                    COALESCE(SUM(amount) FILTER (WHERE entry_type = 'revenue' AND transaction_date >= date_trunc('month', now())), 0)::float8 AS revenue,
                    COALESCE(SUM(amount) FILTER (WHERE entry_type IN ('expense','cogs','salary','rent','other') AND transaction_date >= date_trunc('month', now())), 0)::float8 AS expenses,
                    COALESCE(SUM(amount) FILTER (WHERE entry_type = 'revenue' AND transaction_date >= date_trunc('month', now())), 0)::float8 -
                    COALESCE(SUM(amount) FILTER (WHERE entry_type IN ('expense','cogs','salary','rent','other') AND transaction_date >= date_trunc('month', now())), 0)::float8 AS cash,
                    COALESCE(SUM(amount) FILTER (WHERE entry_type = 'revenue' AND transaction_date >= date_trunc('month', now()) - interval '1 month' AND transaction_date < date_trunc('month', now())), 0)::float8 AS last_revenue,
                    COALESCE(SUM(amount) FILTER (WHERE entry_type IN ('expense','cogs','salary','rent','other') AND transaction_date >= date_trunc('month', now()) - interval '1 month' AND transaction_date < date_trunc('month', now())), 0)::float8 AS last_expenses
                 FROM seller_finances WHERE user_id::text = $1",
                &[&uid],
            )
            .await?;
        let mut l = vec![];
        if tier == ContextTier::Full {
            if let Some(r) = conn
                .query_opt(
                    "SELECT COALESCE(business_name, ''), COALESCE(business_type, ''), plan
                     FROM users WHERE user_id::text = $1",
                    &[&uid],
                )
                .await?
            {
                let name: String = r.get(0);
                let btype: String = r.get(1);
                let plan: String = r.get(2);
                if !name.is_empty() {
                    l.push(format!("Business: {name} ({btype}), plan {plan}."));
                }
            }
            let streams = conn
                .query(
                    "SELECT COALESCE(source, 'Other'), COALESCE(amount, 0)::float8, COALESCE(frequency, ''), COALESCE(currency, 'INR')
                     FROM income_streams WHERE user_id::text = $1 ORDER BY from_date DESC",
                    &[&uid],
                )
                .await?;
            if !streams.is_empty() {
                let parts: Vec<String> = streams
                    .iter()
                    .map(|r| {
                        format!(
                            "{} ₹{:.0}/{} ({})",
                            r.get::<_, String>(0),
                            r.get::<_, f64>(1),
                            r.get::<_, String>(2),
                            r.get::<_, String>(3)
                        )
                    })
                    .collect();
                l.push(format!("Income streams: {}", parts.join(", ")));
            }
        }
        if let Some(r) = d {
            let revenue: f64 = r.get(0);
            let expenses: f64 = r.get(1);
            let cash: f64 = r.get(2);
            let last_revenue: f64 = r.get(3);
            let margin = if revenue > 0.0 { (revenue - expenses) / revenue * 100.0 } else { 0.0 };
            l.push(format!(
                "Business (current month): revenue ₹{revenue:.0}, expenses ₹{expenses:.0}, profit margin {margin:.1}%, cash on hand ₹{cash:.0}."
            ));
            if last_revenue > 0.0 {
                let g = ((revenue - last_revenue) / last_revenue) * 100.0;
                l.push(format!(
                    "Revenue vs last month: {}{g:.1}%",
                    if g >= 0.0 { "+" } else { "" }
                ));
            }
        }
        let cats = conn
            .query(
                "SELECT COALESCE(category, 'Other') AS name, COALESCE(SUM(amount), 0)::float8 AS spent
                 FROM seller_finances
                 WHERE user_id::text = $1 AND entry_type IN ('expense','cogs','salary','rent','other')
                   AND transaction_date >= date_trunc('month', now())
                 GROUP BY 1 ORDER BY spent DESC",
                &[&uid],
            )
            .await?;
        if !cats.is_empty() {
            let parts: Vec<String> = cats
                .iter()
                .map(|r| format!("{} ₹{:.0}", r.get::<_, String>(0), r.get::<_, Option<f64>>(1).unwrap_or(0.0)))
                .collect();
            l.push(format!("Top expense categories: {}", parts.join(", ")));
        }
        let fins = conn
            .query(
                "SELECT entry_type, amount::float8, category, description, transaction_date::text
                 FROM seller_finances WHERE user_id::text = $1
                 ORDER BY transaction_date DESC, created_at DESC LIMIT 5",
                &[&uid],
            )
            .await?;
        if !fins.is_empty() {
            let parts: Vec<String> = fins
                .iter()
                .map(|r| {
                    let desc = r
                        .get::<_, Option<String>>(3)
                        .unwrap_or_default();
                    let cat = r.get::<_, Option<String>>(2).unwrap_or_default();
                    format!(
                        "{} ₹{:.0} {} ({})",
                        r.get::<_, String>(0),
                        r.get::<_, Option<f64>>(1).unwrap_or(0.0),
                        if desc.is_empty() { cat } else { desc },
                        r.get::<_, String>(4),
                    )
                })
                .collect();
            l.push(format!("Recent entries: {}", parts.join(" | ")));
        }
        let inv = conn
            .query(
                "SELECT name, stock, reorder_level FROM seller_inventory
                 WHERE user_id::text = $1 ORDER BY name",
                &[&uid],
            )
            .await?;
        let low: Vec<String> = inv
            .iter()
            .filter(|r| r.get::<_, i32>(1) <= r.get::<_, i32>(2))
            .map(|r| {
                format!(
                    "{} ({} left, reorder at {})",
                    r.get::<_, String>(0),
                    r.get::<_, i32>(1),
                    r.get::<_, i32>(2)
                )
            })
            .collect();
        if !low.is_empty() {
            l.push(format!("Low stock: {}", low.join(", ")));
        }
        if l.is_empty() {
            l.push("No business data recorded yet.".to_string());
        }
        l
    } else {
        let mut l = vec![];
        if let Some(r) = conn
            .query_opt(
                "SELECT COALESCE(b.name, ''), COALESCE(ba.balance, u.wallet_balance)::float8, u.monthly_tab_limit::float8
                 FROM users u
                 LEFT JOIN bank_accounts ba ON ba.user_id = u.user_id
                 LEFT JOIN banks b ON b.bank_id = ba.bank_id
                 WHERE u.user_id::text = $1
                 ORDER BY ba.is_primary DESC, ba.created_at DESC LIMIT 1",
                &[&uid],
            )
            .await?
        {
            let bank: String = r.get(0);
            let bal: f64 = r.get(1);
            let limit: f64 = r.get(2);
            if bank.is_empty() {
                l.push(format!("Wallet: balance ₹{bal:.0}, monthly tab limit ₹{limit:.0}."));
            } else {
                l.push(format!("Wallet: balance ₹{bal:.0} ({bank}), monthly tab limit ₹{limit:.0}."));
            }
        }
        if let Some(r) = conn
            .query_opt(
                "SELECT u.monthly_tab_limit::float8,
                        COALESCE(SUM(l.amount), 0)::float8 AS spent
                 FROM users u
                 LEFT JOIN ledger_entries l ON l.user_id = u.user_id
                    AND l.account_type = 'budget'
                    AND l.created_at >= date_trunc('month', now())
                 WHERE u.user_id::text = $1
                 GROUP BY u.user_id",
                &[&uid],
            )
            .await?
        {
            let limit: f64 = r.get(0);
            let spent: f64 = r.get(1);
            let pct = if limit > 0.0 { (spent / limit * 100.0).round() } else { 0.0 };
            l.push(format!(
                "Spent this month: ₹{spent:.0} of ₹{limit:.0} ({pct}%)."
            ));
        }
        let days = conn
            .query(
                "SELECT COALESCE(SUM(amount), 0)::float8 AS spend
                 FROM ledger_entries
                 WHERE user_id::text = $1 AND account_type = 'budget'
                   AND created_at >= now() - interval '30 days'",
                &[&uid],
            )
            .await?;
        if !days.is_empty() {
            let total: f64 = days[0].get(0);
            l.push(format!("Spent last 30 days: ₹{total:.0}."));
        }
        let accs = conn
            .query(
                "SELECT b.name, balance::float8, ba.account_type
                 FROM bank_accounts ba JOIN banks b ON b.bank_id = ba.bank_id
                 WHERE ba.user_id::text = $1 ORDER BY ba.created_at",
                &[&uid],
            )
            .await?;
        if !accs.is_empty() {
            let parts: Vec<String> = accs
                .iter()
                .map(|r| {
                    let bal: Option<f64> = r.get(1);
                    let atype: Option<String> = r.get(2);
                    let suffix = bal
                        .map(|b| format!("₹{b:.0}"))
                        .unwrap_or_else(|| "unknown".to_string());
                    let label = if tier == ContextTier::Full {
                        atype
                            .filter(|t| !t.is_empty())
                            .map(|t| format!("{} ({t})", r.get::<_, String>(0)))
                            .unwrap_or_else(|| r.get::<_, String>(0))
                    } else {
                        r.get::<_, String>(0)
                    };
                    format!("{label} balance {suffix}")
                })
                .collect();
            l.push(format!("Bank accounts: {}", parts.join("; ")));
        }
        if l.is_empty() {
            l.push("No financial data available yet.".to_string());
        }
        if let Some(r) = conn
            .query_opt(
                "SELECT
                    CASE WHEN u.monthly_income IS NULL THEN NULL ELSE u.monthly_income::float8 END,
                    CASE WHEN u.monthly_spend IS NULL THEN NULL ELSE u.monthly_spend::float8 END,
                    CASE WHEN u.investment_pct IS NULL THEN NULL ELSE u.investment_pct::float8 END,
                    CASE WHEN u.housing_cost IS NULL THEN NULL ELSE u.housing_cost::float8 END,
                    u.dependents,
                    CASE WHEN u.debt_emis IS NULL THEN NULL ELSE u.debt_emis::float8 END,
                    CASE WHEN u.monthly_tax IS NULL THEN NULL ELSE u.monthly_tax::float8 END,
                    CASE WHEN u.monthly_income IS NULL THEN NULL ELSE u.monthly_income::float8 END,
                    u.financial_health_score,
                    u.plan
                 FROM users u WHERE u.user_id::text = $1",
                &[&uid],
            )
            .await?
        {
            let income: Option<f64> = r.get(0);
            let spend: Option<f64> = r.get(1);
            let inv_pct: Option<f64> = r.get(2);
            let housing: Option<f64> = r.get(3);
            let dependents: Option<i32> = r.get(4);
            let emis: Option<f64> = r.get(5);
            let tax: Option<f64> = r.get(6);
            let annual_income: Option<f64> = r.get(7);
            let mut prof = vec![];
            if let Some(v) = income {
                prof.push(format!("income ₹{v:.0}/mo"));
            }
            if let Some(v) = spend {
                prof.push(format!("spend ₹{v:.0}/mo"));
            }
            if let Some(v) = inv_pct {
                prof.push(format!("invests {v:.0}%"));
            }
            if let Some(v) = housing {
                prof.push(format!("housing ₹{v:.0}/mo"));
            }
            if let Some(v) = dependents {
                prof.push(format!("dependents {v}"));
            }
            if let Some(v) = emis {
                prof.push(format!("EMIs ₹{v:.0}/mo"));
            }
            let computed_tax = annual_income.map(|a| crate::insights::new_regime_tax(a) / 12.0);
            let stated_tax = tax.or(computed_tax);
            if let Some(v) = stated_tax {
                prof.push(format!("tax ₹{v:.0}/mo"));
            }
            if tier == ContextTier::Full {
                let score: i32 = r.get(8);
                let plan: String = r.get(9);
                prof.push(format!("health score {score}, plan {plan}"));
            }
            if !prof.is_empty() {
                l.push(format!("Profile: {}", prof.join(", ")));
            }
            if tier == ContextTier::Full {
                let mut missing = vec![];
                if income.is_none() {
                    missing.push("monthly income");
                }
                if spend.is_none() {
                    missing.push("monthly spend");
                }
                if inv_pct.is_none() {
                    missing.push("investment %");
                }
                if housing.is_none() {
                    missing.push("housing cost");
                }
                if emis.is_none() {
                    missing.push("EMI/debt payments");
                }
                if stated_tax.is_none() {
                    missing.push("monthly tax");
                }
                if !missing.is_empty() {
                    l.push(format!(
                        "Missing profile info: {}. Ask about these when relevant.",
                        missing.join(", ")
                    ));
                }
            }
        }
        let goals = conn
            .query(
                "SELECT goal_type, name, target_amount::float8, current_amount::float8, target_date::text
                 FROM financial_goals WHERE user_id::text = $1
                 ORDER BY created_at DESC",
                &[&uid],
            )
            .await?;
        if !goals.is_empty() {
            let goal_parts: Vec<String> = goals
                .iter()
                .map(|r| {
                    let gtype: String = r.get(0);
                    let name: String = r.get(1);
                    let target: f64 = r.get(2);
                    let current: f64 = r.get(3);
                    let date: Option<String> = r.get(4);
                    let mut s = format!(
                        "{name} ({gtype}) ₹{target:.0} target, ₹{current:.0} saved"
                    );
                    if tier == ContextTier::Full {
                        let pct = if target > 0.0 { (current / target * 100.0).round() } else { 0.0 };
                        let due = date.map(|d| format!(", due {d}")).unwrap_or_default();
                        s = format!("{s} ({pct:.0}%{due})");
                    }
                    s
                })
                .collect();
            let goal_parts = apply_cap(goal_parts, tier, 3);
            l.push(format!("Goals: {}", goal_parts.join("; ")));
        }
        let holdings = conn
            .query(
                "SELECT name, asset_type, quantity::float8, COALESCE(avg_price, 0)::float8, COALESCE(current_price, 0)::float8
                 FROM holdings WHERE user_id::text = $1 ORDER BY created_at DESC",
                &[&uid],
            )
            .await?;
        if !holdings.is_empty() {
            let mut total = 0.0f64;
            let mut classes: std::collections::BTreeMap<String, f64> = Default::default();
            let holding_parts: Vec<String> = holdings
                .iter()
                .map(|r| {
                    let name: String = r.get(0);
                    let atype: String = r.get(1);
                    let qty: f64 = r.get(2);
                    let avg: f64 = r.get(3);
                    let cur: f64 = r.get(4);
                    let value = qty * if cur > 0.0 { cur } else { avg };
                    total += value;
                    *classes.entry(atype.clone()).or_insert(0.0) += value;
                    format!("{name} ({atype}) {qty} units @ ₹{avg:.0}, value ₹{value:.0}")
                })
                .collect();
            let holding_parts = apply_cap(holding_parts, tier, 5);
            if tier == ContextTier::Full {
                let classes_s: Vec<String> = classes
                    .into_iter()
                    .map(|(k, v)| format!("{k} ₹{v:.0}"))
                    .collect();
                l.push(format!(
                    "Portfolio: total ₹{total:.0} ({}).",
                    classes_s.join(", ")
                ));
            }
            l.push(format!("Holdings: {}", holding_parts.join("; ")));
        }
        let purchases = conn
            .query(
                "SELECT p.name, p.price::float8, a.verdict, to_char(a.created_at, 'YYYY-MM-DD')
                 FROM analysis_log a JOIN products p ON p.product_id = a.product_id
                 WHERE a.user_id::text = $1 AND p.site_name = 'Twin Chat'
                 ORDER BY a.created_at DESC LIMIT 5",
                &[&uid],
            )
            .await?;
        if !purchases.is_empty() {
            let parts: Vec<String> = purchases
                .iter()
                .map(|r| {
                    let name: String = r.get(0);
                    let price: f64 = r.get(1);
                    let verdict: String = r.get(2);
                    let date: String = r.get(3);
                    format!("{name} ₹{price:.0} ({verdict}, {date})")
                })
                .collect();
            l.push(format!("Recent purchases: {}", parts.join("; ")));
        }
        let entries = conn
            .query(
                "SELECT amount::float8, COALESCE(description, payee), to_char(COALESCE(transaction_date, created_at), 'YYYY-MM-DD')
                 FROM ledger_entries
                 WHERE user_id::text = $1 AND account_type = 'budget'
                 ORDER BY created_at DESC LIMIT 5",
                &[&uid],
            )
            .await?;
        if !entries.is_empty() {
            let parts: Vec<String> = entries
                .iter()
                .map(|r| {
                    let amount: f64 = r.get(0);
                    let label: String = r.get(1);
                    let date: String = r.get(2);
                    format!("₹{amount:.0} {label} ({date})")
                })
                .collect();
            l.push(format!("Recent entries: {}", parts.join(" | ")));
        }
        l
    };
    Ok(lines.join("\n"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn image_content_only_on_last_user_message() {
        let m = Msg { role: "user".to_string(), content: "hi".to_string() };
        let parts = llm_content(&m, Some("data:image/png;base64,abc"));
        let json = serde_json::to_string(&parts).unwrap();
        assert!(json.contains("image_url") && json.contains("data:image/png;base64,abc"));
        assert!(!serde_json::to_string(&llm_content(&m, None)).unwrap().contains("image_url"));
        let a = Msg { role: "assistant".to_string(), content: "yo".to_string() };
        assert!(!serde_json::to_string(&llm_content(&a, Some("data:image/png;base64,abc"))).unwrap().contains("image_url"));
    }

    #[test]
    fn tier_maps_by_window() {
        assert_eq!(context_tier(DEFAULT_MODEL), ContextTier::Full);
        assert_eq!(context_tier("unknown-model"), ContextTier::Full);
        assert_eq!(context_window(DEFAULT_MODEL), 131_000);
    }

    #[test]
    fn compact_caps_keep_today_s_shape() {
        let parts: Vec<String> = (1..=6).map(|i| format!("item {i}")).collect();
        let capped = apply_cap(parts.clone(), ContextTier::Compact, 3);
        assert_eq!(capped.len(), 3);
        assert_eq!(apply_cap(parts, ContextTier::Full, 3).len(), 6);
    }

    #[test]
    fn non_default_models_normalize_to_scout() {
        assert_eq!(normalize_model(DEFAULT_MODEL.to_string()), DEFAULT_MODEL);
        assert_eq!(normalize_model("groq/llama-3.3-70b-versatile".to_string()), DEFAULT_MODEL);
        assert_eq!(normalize_model("@cf/meta/llama-3.3-70b-instruct".to_string()), DEFAULT_MODEL);
    }
}
