use std::env;
use std::sync::Arc;

use axum::body::Body;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use futures_util::StreamExt;
use serde::Deserialize;
use tokio::sync::mpsc;
use tokio_stream::wrappers::ReceiverStream;

use crate::AppState;

#[derive(Deserialize)]
struct ChatRequest {
    messages: Vec<Msg>,
    #[serde(default)]
    mode: Option<String>,
}

#[derive(Deserialize)]
struct Msg {
    role: String,
    content: String,
}

pub async fn chat_stream(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: String,
) -> Response {
    let Some(uid) = headers
        .get("x-user-id")
        .and_then(|v| v.to_str().ok())
        .filter(|s| !s.is_empty())
    else {
        return (StatusCode::UNAUTHORIZED, "missing x-user-id").into_response();
    };

    let req: ChatRequest = match serde_json::from_str(&body) {
        Ok(r) => r,
        Err(_) => return (StatusCode::BAD_REQUEST, "invalid json").into_response(),
    };
    let messages: Vec<Msg> = req
        .messages
        .into_iter()
        .filter(|m| !m.content.trim().is_empty())
        .rev()
        .take(10)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect();
    if messages.is_empty() {
        return (StatusCode::BAD_REQUEST, "messages required").into_response();
    }

    let seller = req.mode.as_deref() == Some("seller");
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

    let (tx, rx) = mpsc::channel::<String>(64);
    tokio::spawn(stream_reply(system, messages, model, tx));

    let stream = ReceiverStream::new(rx).map(Ok::<String, std::io::Error>);
    Response::builder()
        .status(StatusCode::OK)
        .header("content-type", "text/event-stream")
        .header("cache-control", "no-cache")
        .body(Body::from_stream(stream))
        .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response())
}

fn sse(data: &str) -> String {
    format!("data: {data}\n\n")
}

async fn stream_reply(
    system: String,
    messages: Vec<Msg>,
    model: String,
    tx: mpsc::Sender<String>,
) {
    let send = |data: String| async {
        let _ = tx.send(data).await;
    };

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
        .timeout(std::time::Duration::from_secs(90))
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
        send(sse(&format!(r#"{{"error":"ai status {status}"}}"#))).await;
        return;
    }

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
                send(sse("[DONE]")).await;
                return;
            }
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(data) {
                if let Some(content) = v
                    .pointer("/choices/0/delta/content")
                    .and_then(|c| c.as_str())
                {
                    if !content.is_empty() {
                        let ev = serde_json::json!({ "token": content });
                        send(sse(&ev.to_string())).await;
                    }
                }
            }
        }
        buf.clear();
    }
    send(sse("[DONE]")).await;
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
                .map(|r| format!("{} ₹{:.0}", r.get::<_, String>(0), r.get::<_, f64>(1)))
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
                        r.get::<_, f64>(1),
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
                "SELECT wallet_balance::float8, monthly_tab_limit::float8 FROM users WHERE user_id::text = $1",
                &[&uid],
            )
            .await?
        {
            let bal: f64 = r.get(0);
            let limit: f64 = r.get(1);
            l.push(format!("Wallet: balance ₹{bal:.0}, monthly tab limit ₹{limit:.0}."));
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
