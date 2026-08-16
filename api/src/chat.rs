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
    message: String,
}

const TOOLS: [&str; 4] = ["tax", "retirement", "budget", "stock"];

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

#[derive(Serialize)]
struct SessionOut {
    session_id: String,
    mode: String,
    title: String,
    updated_at: String,
}

#[derive(Serialize)]
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
    if message.is_empty() {
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
    let (context, memories, history) = tokio::join!(
        async {
            match build_context(&state, &uid, seller).await {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("chat context error: {e}");
                    "No data available.".to_string()
                }
            }
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
    let model = match fetch_model(&state, &uid).await {
        Ok(Some(m)) if !m.is_empty() && !m.starts_with("groq/") => m,
        _ => "@cf/meta/llama-4-scout-17b-16e-instruct".to_string(),
    };
    let mut system = system_prompt(seller, &context);
    if !memories.is_empty() {
        system = format!("{system}\n\n{memories}");
    }
    if let Some(t) = tool_system(&tool) {
        system = format!("{t}\n\n{system}");
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
        Err(_) => return String::new(),
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
        Err(_) => return String::new(),
    };
    if !res.status().is_success() {
        return String::new();
    }
    let Ok(json) = res.json::<serde_json::Value>().await else {
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
             WHERE user_id::text = $1
             ORDER BY embedding <=> $2::vector
             LIMIT 4",
            &[&uid, &format!("[{vec_sql}]")],
        )
        .await
    {
        Ok(r) => r,
        Err(_) => return String::new(),
    };
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
        Ok(r) => Json(SessionOut {
            session_id: r.get(0),
            mode: r.get(1),
            title: r.get(2),
            updated_at: r.get(3),
        })
        .into_response(),
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
        Ok(_) => Json(serde_json::json!({ "ok": true })).into_response(),
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
        Ok(Some(r)) => Json(SessionOut {
            session_id: r.get(0),
            mode: r.get(1),
            title: r.get(2),
            updated_at: r.get(3),
        })
        .into_response(),
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
        Ok(rows) => Json(
            rows.iter()
                .map(|r| SessionOut {
                    session_id: r.get(0),
                    mode: r.get(1),
                    title: r.get(2),
                    updated_at: r.get(3),
                })
                .collect::<Vec<_>>(),
        )
        .into_response(),
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
        Ok(rs) => Json(
            rs.iter()
                .map(|r| MessageOut {
                    role: r.get(0),
                    content: r.get(1),
                    created_at: r.get(2),
                })
                .collect::<Vec<_>>(),
        )
        .into_response(),
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
    mode: String,
) {
    let send = |data: String| async {
        let _ = tx.send(data).await;
    };

    send(sse(&serde_json::json!({ "sessionId": session_id }).to_string())).await;

    if env::var("CHAT_PROVIDER").as_deref() == Ok("groq") {
        return groq_stream(
            system,
            messages,
            tx,
            state,
            session_id,
            uid,
            user_message,
            mode,
        )
        .await;
    }

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
    let url = format!(
        "https://api.cloudflare.com/client/v4/accounts/{account}/ai/run/{model}"
    );

    let llm_messages: Vec<serde_json::Value> = std::iter::once(serde_json::json!({
        "role": "system",
        "content": system,
    }))
    .chain(messages.iter().map(|m| {
        serde_json::json!({ "role": m.role, "content": m.content })
    }))
    .collect();

    let payload = serde_json::json!({
        "messages": llm_messages,
        "stream": true,
        "max_tokens": 1024,
    });

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
        .bearer_auth(&token)
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
                if let Some(capture) = extract_captures(&account, &token, &user_message, &full).await {
                    send(sse(&serde_json::json!({ "capture": capture }).to_string())).await;
                }
                persist_turn(&state, &uid, &session_id, &user_message, &full, &mode).await;
                send(sse("[DONE]")).await;
                return;
            }
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(data) {
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
    if let Some(capture) = extract_captures(&account, &token, &user_message, &full).await {
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

fn groq_client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(90))
        .build()
        .unwrap_or_default()
}

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
    account: &str,
    token: &str,
    system: &str,
    user_message: &str,
    reply: &str,
) -> Option<serde_json::Value> {
    let url = format!(
        "https://api.cloudflare.com/client/v4/accounts/{account}/ai/run/@cf/meta/llama-3.1-8b-instruct-fp8"
    );
    let payload = serde_json::json!({
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": format!("USER: {user_message}\n\nASSISTANT: {reply}")},
        ],
        "max_tokens": 200,
    });
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .ok()?;
    let res = client.post(&url).bearer_auth(token).json(&payload).send().await.ok()?;
    if !res.status().is_success() {
        return None;
    }
    let body: serde_json::Value = res.json().await.ok()?;
    let text = body.pointer("/result/response").and_then(|r| r.as_str())?;
    let text = text
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();
    serde_json::from_str(text).ok()
}

async fn extract_captures(
    account: &str,
    token: &str,
    user_message: &str,
    reply: &str,
) -> Option<serde_json::Value> {
    let (goal, holding, profile, budget, purchase, seller) = tokio::join!(
        async { extract_json(account, token, GOAL_PROMPT, user_message, reply).await.and_then(|v| validate_goal(&v)) },
        async { extract_json(account, token, HOLDING_PROMPT, user_message, reply).await.and_then(|v| validate_holding(&v)) },
        async { extract_json(account, token, PROFILE_PROMPT, user_message, reply).await.and_then(|v| validate_profile(&v)) },
        async { extract_json(account, token, BUDGET_PROMPT, user_message, reply).await.and_then(|v| validate_budget(&v)) },
        async { extract_json(account, token, PURCHASE_PROMPT, user_message, reply).await.and_then(|v| validate_purchase(&v)) },
        async { extract_json(account, token, SELLER_PROMPT, user_message, reply).await },
    );
    let income = seller.as_ref().and_then(|v| validate_income(v));
    let expense = seller.as_ref().and_then(|v| validate_expense(v));
    let inventory = seller.as_ref().and_then(|v| validate_inventory(v));
    pack_captures(goal, holding, profile, budget, purchase, income, expense, inventory)
}

async fn groq_json(
    client: &reqwest::Client,
    model: &str,
    system: &str,
    user_message: &str,
    reply: &str,
) -> Option<serde_json::Value> {
    let key = env::var("GROQ_API_KEY").ok()?;
    let body = serde_json::json!({
        "model": model,
        "max_tokens": 200,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": format!("USER: {user_message}\n\nASSISTANT: {reply}")},
        ],
    });
    let resp = client
        .post("https://api.groq.com/openai/v1/chat/completions")
        .bearer_auth(&key)
        .json(&body)
        .send()
        .await
        .ok()?;
    let parsed: serde_json::Value = resp.json().await.ok()?;
    let text = parsed.pointer("/choices/0/message/content").and_then(|t| t.as_str())?;
    let text = text
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();
    serde_json::from_str(text).ok()
}

async fn extract_captures_groq(
    client: &reqwest::Client,
    model: &str,
    user_message: &str,
    reply: &str,
) -> Option<serde_json::Value> {
    let (goal, holding, profile, budget, purchase, seller) = tokio::join!(
        async { groq_json(client, model, GOAL_PROMPT, user_message, reply).await.and_then(|v| validate_goal(&v)) },
        async { groq_json(client, model, HOLDING_PROMPT, user_message, reply).await.and_then(|v| validate_holding(&v)) },
        async { groq_json(client, model, PROFILE_PROMPT, user_message, reply).await.and_then(|v| validate_profile(&v)) },
        async { groq_json(client, model, BUDGET_PROMPT, user_message, reply).await.and_then(|v| validate_budget(&v)) },
        async { groq_json(client, model, PURCHASE_PROMPT, user_message, reply).await.and_then(|v| validate_purchase(&v)) },
        async { groq_json(client, model, SELLER_PROMPT, user_message, reply).await },
    );
    let income = seller.as_ref().and_then(|v| validate_income(v));
    let expense = seller.as_ref().and_then(|v| validate_expense(v));
    let inventory = seller.as_ref().and_then(|v| validate_inventory(v));
    pack_captures(goal, holding, profile, budget, purchase, income, expense, inventory)
}

// Groq chat: single non-streaming reply, same SSE contract as CF path.
async fn groq_stream(
    system: String,
    messages: Vec<Msg>,
    tx: mpsc::Sender<String>,
    state: Arc<AppState>,
    session_id: String,
    uid: String,
    user_message: String,
    mode: String,
) {
    let send = |data: String| async {
        let _ = tx.send(data).await;
    };

    send(sse(&serde_json::json!({ "sessionId": session_id }).to_string())).await;

    let client = groq_client();
    let model = match fetch_model(&state, &uid).await {
        Ok(Some(m)) if m.starts_with("groq/") => m["groq/".len()..].to_string(),
        _ => env::var("GROQ_MODEL").unwrap_or_else(|_| "llama-3.3-70b-versatile".to_string()),
    };
    let key = match env::var("GROQ_API_KEY") {
        Ok(k) => k,
        Err(_) => {
            send(sse(r#"{"error":"GROQ_API_KEY not set"}"#)).await;
            return;
        }
    };

    let llm_messages: Vec<serde_json::Value> = std::iter::once(serde_json::json!({
        "role": "system",
        "content": system,
    }))
    .chain(messages.iter().map(|m| {
        serde_json::json!({ "role": m.role, "content": m.content })
    }))
    .collect();

    let body = serde_json::json!({
        "model": model,
        "max_tokens": 1024,
        "messages": llm_messages,
    });

    let resp = match client
        .post("https://api.groq.com/openai/v1/chat/completions")
        .bearer_auth(&key)
        .json(&body)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            send(sse(&format!(r#"{{"error":"groq: {e}"}}"#))).await;
            return;
        }
    };
    let parsed: serde_json::Value = match resp.json().await {
        Ok(v) => v,
        Err(e) => {
            send(sse(&format!(r#"{{"error":"groq parse: {e}"}}"#))).await;
            return;
        }
    };
    let full = parsed
        .pointer("/choices/0/message/content")
        .and_then(|t| t.as_str())
        .unwrap_or("")
        .to_string();
    if !full.trim().is_empty() {
        let ev = serde_json::json!({ "token": full });
        send(sse(&ev.to_string())).await;
    }

    if match crate::usage::bump(&state, &uid, "ai_capture").await {
        Ok(ok) => ok,
        Err(e) => {
            eprintln!("usage capture gate error: {e}");
            false
        }
    } {
        if let Some(capture) = extract_captures_groq(&client, &model, &user_message, &full).await {
            send(sse(&serde_json::json!({ "capture": capture }).to_string())).await;
        }
    }
    persist_turn(&state, &uid, &session_id, &user_message, &full, &mode).await;
    send(sse("[DONE]")).await;
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

fn normalize_model(m: String) -> String {
    match m.as_str() {
        "@cf/meta/llama-3.3-70b-instruct" => "@cf/meta/llama-3.3-70b-instruct-fp8-fast".to_string(),
        "@cf/meta/llama-3.1-8b-instruct" => "@cf/meta/llama-3.1-8b-instruct-fp8".to_string(),
        other => other.to_string(),
    }
}

async fn build_context(
    state: &Arc<AppState>,
    uid: &str,
    seller: bool,
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
                "SELECT b.name, balance::float8
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
                    format!(
                        "{} balance {}",
                        r.get::<_, String>(0),
                        bal.map(|b| format!("₹{b:.0}")).unwrap_or_else(|| "unknown".to_string())
                    )
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
                    CASE WHEN u.monthly_income IS NULL THEN NULL ELSE u.monthly_income::float8 END
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
            if !prof.is_empty() {
                l.push(format!("Profile: {}", prof.join(", ")));
            }
        }
        let goals = conn
            .query(
                "SELECT goal_type, name, target_amount::float8, current_amount::float8
                 FROM financial_goals WHERE user_id::text = $1
                 ORDER BY created_at DESC LIMIT 3",
                &[&uid],
            )
            .await?;
        if !goals.is_empty() {
            let parts: Vec<String> = goals
                .iter()
                .map(|r| {
                    let gtype: String = r.get(0);
                    let name: String = r.get(1);
                    let target: f64 = r.get(2);
                    let current: f64 = r.get(3);
                    format!(
                        "{name} ({gtype}) ₹{target:.0} target, ₹{current:.0} saved"
                    )
                })
                .collect();
            l.push(format!("Goals: {}", parts.join("; ")));
        }
        let holdings = conn
            .query(
                "SELECT name, asset_type, quantity::float8, COALESCE(avg_price, 0)::float8, COALESCE(current_price, 0)::float8
                 FROM holdings WHERE user_id::text = $1 ORDER BY created_at DESC LIMIT 5",
                &[&uid],
            )
            .await?;
        if !holdings.is_empty() {
            let parts: Vec<String> = holdings
                .iter()
                .map(|r| {
                    let name: String = r.get(0);
                    let atype: String = r.get(1);
                    let qty: f64 = r.get(2);
                    let avg: f64 = r.get(3);
                    let cur: f64 = r.get(4);
                    let value = qty * if cur > 0.0 { cur } else { avg };
                    format!("{name} ({atype}) {qty} units @ ₹{avg:.0}, value ₹{value:.0}")
                })
                .collect();
            l.push(format!("Holdings: {}", parts.join("; ")));
        }
        let purchases = conn
            .query(
                "SELECT p.name, p.price::float8, a.verdict, a.created_at::date
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
                "SELECT amount::float8, category, description, to_char(transaction_date, 'YYYY-MM-DD')
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
                    let category: Option<String> = r.get(1);
                    let description: Option<String> = r.get(2);
                    let date: String = r.get(3);
                    let desc = description.unwrap_or_default();
                    format!(
                        "₹{amount:.0} {} ({})",
                        if desc.is_empty() { category.unwrap_or_default() } else { desc },
                        date
                    )
                })
                .collect();
            l.push(format!("Recent entries: {}", parts.join(" | ")));
        }
        l
    };
    Ok(lines.join("\n"))
}
