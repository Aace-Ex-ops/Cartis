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
    message: String,
}

#[derive(Deserialize)]
pub struct CreateSessionRequest {
    mode: String,
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
    let (session_id, mode) = match sid {
        Some(sid) => {
            match conn
                .query_opt(
                    "SELECT mode FROM chat_sessions WHERE session_id::text = $1 AND user_id::text = $2",
                    &[&sid, &uid],
                )
                .await
            {
                Ok(Some(r)) => (sid, r.get::<_, String>(0)),
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
            let title: String = message
                .chars()
                .take(60)
                .collect::<String>()
                .trim()
                .to_string();
            match conn
                .query_one(
                    "INSERT INTO chat_sessions (user_id, mode, title) VALUES ($1::text::uuid, $2, $3) RETURNING session_id::text",
                    &[&uid, &mode, &title],
                )
                .await
            {
                Ok(r) => (r.get::<_, String>(0), mode.to_string()),
                Err(e) => {
                    eprintln!("chat session create error: {e}");
                    return json_err(StatusCode::INTERNAL_SERVER_ERROR, "db error");
                }
            }
        }
    };
    drop(conn);

    let seller = mode == "seller";
    let context = match build_context(&state, &uid, seller).await {
        Ok(c) => c,
        Err(e) => {
            eprintln!("chat context error: {e}");
            "No data available.".to_string()
        }
    };
    let model = match fetch_model(&state, &uid).await {
        Ok(Some(m)) if !m.is_empty() => m,
        _ => "@cf/meta/llama-4-scout-17b-16e-instruct".to_string(),
    };
    let system = system_prompt(seller, &context);

    let history = match load_history(&state, &session_id).await {
        Ok(h) => h,
        Err(e) => {
            eprintln!("chat history error: {e}");
            vec![]
        }
    };
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
    persist_turn(&state, &uid, &session_id, &user_message, &full, &mode).await;
    send(sse("[DONE]")).await;
}

async fn persist_turn(
    state: &Arc<AppState>,
    uid: &str,
    session_id: &str,
    user_message: &str,
    assistant: &str,
    mode: &str,
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
    if !assistant.trim().is_empty() {
        tokio::spawn(push_supermemory(
            state.clone(),
            uid.to_string(),
            session_id.to_string(),
            user_message.to_string(),
            assistant.to_string(),
            mode.to_string(),
        ));
    }
}

async fn push_supermemory(
    state: Arc<AppState>,
    uid: String,
    session_id: String,
    user: String,
    assistant: String,
    mode: String,
) {
    let key = match env::var("SM_API_KEY") {
        Ok(k) if !k.is_empty() => k,
        _ => return,
    };
    let entity_context = match state.pg.get().await {
        Ok(conn) => {
            let name: Option<String> = conn
                .query_opt(
                    "SELECT full_name FROM users WHERE user_id::text = $1",
                    &[&uid],
                )
                .await
                .ok()
                .flatten()
                .and_then(|r| r.try_get(0).ok());
            match name {
                Some(n) if !n.trim().is_empty() => {
                    let bank: Option<String> = conn
                        .query_opt(
                            "SELECT b.name FROM bank_accounts ba JOIN banks b ON b.bank_id = ba.bank_id WHERE ba.user_id::text = $1 AND ba.is_primary ORDER BY ba.created_at DESC LIMIT 1",
                            &[&uid],
                        )
                        .await
                        .ok()
                        .flatten()
                        .and_then(|r| r.try_get(0).ok());
                    match bank {
                        Some(b) if !b.trim().is_empty() => format!(
                            "User {n} is a Cartis user who banks with {b}. Focus on this user's financial goals, spending patterns, balances, and money decisions."
                        ),
                        _ => format!(
                            "User {n} is a Cartis user. Focus on this user's financial goals, spending patterns, balances, and money decisions."
                        ),
                    }
                }
                _ => "A Cartis user's AI financial twin. Focus on this user's financial goals, spending patterns, balances, and money decisions."
                    .to_string(),
            }
        }
        Err(e) => {
            eprintln!("entity context db error: {e}");
            "A Cartis user's AI financial twin. Focus on this user's financial goals, spending patterns, balances, and money decisions."
                .to_string()
        }
    };
    let body = serde_json::json!({
        "content": format!("user: {user}\nassistant: {assistant}"),
        "containerTag": format!("user_{uid}"),
        "customId": format!("cartis_{session_id}"),
        "metadata": { "type": "chat", "mode": mode, "source": "cartis" },
        "entityContext": entity_context,
    });
    let client = reqwest::Client::new();
    for attempt in 0..3 {
        match client
            .post("https://api.supermemory.ai/v3/documents")
            .bearer_auth(&key)
            .timeout(Duration::from_secs(30))
            .json(&body)
            .send()
            .await
        {
            Ok(r) if r.status().as_u16() == 429 => {
                eprintln!("supermemory push rate limited (attempt {})", attempt + 1);
                if attempt < 2 {
                    tokio::time::sleep(Duration::from_secs(2)).await;
                    continue;
                }
            }
            Ok(r) if !r.status().is_success() => {
                eprintln!("supermemory push status {}", r.status().as_u16());
            }
            Ok(_) => {}
            Err(e) => eprintln!("supermemory push error: {e}"),
        }
        break;
    }
}

pub async fn purge_supermemory(uid: String) {
    let key = match env::var("SM_API_KEY") {
        Ok(k) if !k.is_empty() => k,
        _ => return,
    };
    match reqwest::Client::new()
        .delete("https://api.supermemory.ai/v3/documents/bulk")
        .bearer_auth(&key)
        .timeout(Duration::from_secs(30))
        .json(&serde_json::json!({ "containerTags": [format!("user_{uid}")] }))
        .send()
        .await
    {
        Ok(r) if r.status().is_success() => {
            let v: serde_json::Value = r.json().await.unwrap_or_default();
            eprintln!(
                "supermemory purge user_{uid}: deleted {} docs",
                v["deletedCount"].as_u64().unwrap_or(0)
            );
        }
        Ok(r) => eprintln!("supermemory purge status {}", r.status().as_u16()),
        Err(e) => eprintln!("supermemory purge error: {e}"),
    }
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
    Ok(row.map(|r| r.get(0)))
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
        l
    };
    Ok(lines.join("\n"))
}
