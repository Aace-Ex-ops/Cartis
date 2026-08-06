use std::env;
use std::sync::Arc;
use std::time::Duration;

use async_graphql::{Error, Object, Result};
use serde::{Deserialize, Serialize};

use crate::AppState;

fn new_regime_tax(annual: f64) -> f64 {
    let taxable = annual.max(0.0) - 75_000.0;
    if taxable <= 1_200_000.0 {
        return 0.0;
    }
    let mut tax = 0.0;
    let mut income = taxable;
    let bands: &[(f64, f64)] = &[
        (400_000.0, 0.0),
        (400_000.0, 0.05),
        (400_000.0, 0.10),
        (400_000.0, 0.15),
        (400_000.0, 0.20),
        (400_000.0, 0.25),
        (f64::INFINITY, 0.30),
    ];
    for &(width, rate) in bands {
        let take = income.min(width);
        tax += take * rate;
        income -= take;
        if income <= 0.0 {
            break;
        }
    }
    tax * 1.04
}

pub async fn ai_token() -> Result<String, String> {
    match env::var("CF_AI_TOKEN") {
        Ok(t) if !t.is_empty() => Ok(t),
        _ => Err("CF_AI_TOKEN not set".to_string()),
    }
}

#[derive(Deserialize)]
struct RawInsight {
    title: Option<String>,
    detail: Option<String>,
    tone: Option<String>,
}

#[derive(Deserialize)]
struct RawPayload {
    insights: Option<Vec<RawInsight>>,
}

#[derive(Serialize)]
pub struct Insight {
    pub title: String,
    pub detail: String,
    pub tone: String,
}

#[Object]
impl Insight {
    async fn title(&self) -> &str {
        &self.title
    }
    async fn detail(&self) -> &str {
        &self.detail
    }
    async fn tone(&self) -> &str {
        &self.tone
    }
}

pub struct CoachInsights {
    pub insights: Vec<Insight>,
    pub generated_at: String,
}

#[Object]
impl CoachInsights {
    async fn insights(&self) -> &[Insight] {
        &self.insights
    }
    async fn generated_at(&self) -> &str {
        &self.generated_at
    }
}

const DEFAULT_MODEL: &str = "@cf/meta/llama-4-scout-17b-16e-instruct";

pub async fn query(state: &Arc<AppState>, uid: &str, role: &str) -> Result<Option<CoachInsights>> {
    let conn = state.pg.get().await?;
    let row = conn
        .query_opt(
            "SELECT ci.insights::text, ci.generated_at::text,
                    (SELECT GREATEST(
                        (SELECT MAX(ba.last_sync_at) FROM bank_accounts ba WHERE ba.user_id::text = $1),
                        (SELECT MAX(l.created_at) FROM ledger_entries l WHERE l.user_id::text = $1),
                        (SELECT MAX(sf.created_at) FROM seller_finances sf WHERE sf.user_id::text = $1),
                        (SELECT MAX(bs.created_at) FROM budget_suggestions bs WHERE bs.user_id::text = $1),
                        (SELECT u.updated_at FROM users u WHERE u.user_id::text = $1)
                    )) > ci.generated_at AS stale
             FROM coach_insights ci
             WHERE ci.user_id::text = $1 AND ci.role = $2",
            &[&uid, &role],
        )
        .await?;
    let Some(row) = row else {
        eprintln!("insights query: no cached insights for uid={uid} role={role}");
        return Ok(None);
    };
    let stale: bool = row.try_get(2).unwrap_or(false);
    if stale {
        eprintln!("insights query: stale for uid={uid} role={role}, will refresh");
        return Ok(None);
    }
    let raw: String = row.get(0);
    let insights: Vec<RawInsight> = serde_json::from_str(&raw).unwrap_or_default();
    Ok(Some(CoachInsights {
        insights: insights.into_iter().map(sanitize).collect(),
        generated_at: row.get(1),
    }))
}

pub async fn refresh(state: &Arc<AppState>, uid: &str, role: &str) -> Result<Vec<Insight>> {
    eprintln!("insights refresh: generating for uid={uid} role={role}");
    let insights = generate(state, uid, role).await.map_err(|e| {
        eprintln!("insights generate FAILED for uid={uid} role={role}: {e}");
        Error::new(format!("generate: {e}"))
    })?;
    eprintln!("insights refresh: got {} insights for uid={uid}", insights.len());
    save(state, uid, role, &insights).await?;
    Ok(insights)
}

pub async fn save(state: &Arc<AppState>, uid: &str, role: &str, insights: &[Insight]) -> Result<()> {
    let json = serde_json::to_value(insights).map_err(|e| e.to_string())?;
    let res = state
        .pg
        .get()
        .await?
        .query(
            "INSERT INTO coach_insights (user_id, role, insights, generated_at)
             VALUES ($1::text::uuid, $2, $3, now())
             ON CONFLICT (user_id, role) DO UPDATE
               SET insights = EXCLUDED.insights, generated_at = now()",
            &[&uid, &role, &json],
        )
        .await;
    if let Err(e) = res {
        eprintln!("insights save db error: {e:?} (uid={uid}, role={role})");
        return Err(e.into());
    }
    Ok(())
}

fn sanitize(raw: RawInsight) -> Insight {
    let tone = raw
        .tone
        .filter(|t| matches!(t.as_str(), "warn" | "good" | "info"))
        .unwrap_or_else(|| "info".to_string());
    Insight {
        title: raw.title.unwrap_or_default().trim().to_string(),
        detail: raw.detail.unwrap_or_default().trim().to_string(),
        tone,
    }
}

async fn generate(
    state: &Arc<AppState>,
    uid: &str,
    role: &str,
) -> std::result::Result<Vec<Insight>, String> {
    let seller = role == "seller";
    let context = if seller {
        seller_context(state, uid).await.map_err(|e| e.to_string())?
    } else {
        consumer_context(state, uid).await.map_err(|e| e.to_string())?
    };
    let prompt = if seller {
        format!(
            "You are the Cartis business coach for a small Indian business. Based ONLY on this live data:\n{context}\nGenerate exactly 3 insights. Return ONLY JSON:\n{{\"insights\":[{{\"title\":\"short headline\",\"detail\":\"2-3 plain-English sentences with ₹ amounts\",\"tone\":\"warn\"|\"good\"|\"info\"}}]}}\nwarn = problem to fix, good = opportunity to grow, info = neutral update. Never invent numbers."
        )
    } else {
        format!(
            "You are the Cartis personal finance coach for an Indian salaried user. Based ONLY on this live data:\n{context}\nGenerate exactly 3 insights. Return ONLY JSON:\n{{\"insights\":[{{\"title\":\"short headline\",\"detail\":\"2-3 plain-English sentences with ₹ amounts\",\"tone\":\"warn\"|\"good\"|\"info\"}}]}}\nwarn = problem to fix, good = opportunity to grow, info = neutral update.\nOne insight MUST cover income tax: use the computed tax liability provided in the context (already accounts for standard deduction, rebate u/s 87A, and cess). If computed tax is 0, note the user has no tax liability. Compare with TDS if available. Flag the ITR deadline of 31 July (or 31 Dec for business) with a filing reminder. Never invent numbers."
        )
    };

    let token = ai_token().await?;
    let account = env::var("CF_ACCOUNT_ID").map_err(|_| "CF_ACCOUNT_ID not set".to_string())?;
    let model = env::var("CF_AI_MODEL").unwrap_or_else(|_| DEFAULT_MODEL.to_string());
    eprintln!("insights generate: model={model}, account={account}, token_len={}", token.len());
    let url = format!(
        "https://api.cloudflare.com/client/v4/accounts/{account}/ai/run/{model}"
    );
    let body = serde_json::json!({
        "messages": [{ "role": "user", "content": prompt }],
        "max_tokens": 2048,
    });

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(90))
        .build()
        .map_err(|e| e.to_string())?;
    let res = client
        .post(&url)
        .bearer_auth(&token)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        let status = res.status().as_u16();
        let body = res.text().await.unwrap_or_default();
        return Err(format!(
            "ai status {status}: {}",
            body.chars().take(300).collect::<String>()
        ));
    }
    let value: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let content = value
        .pointer("/result/response")
        .and_then(|v| v.as_str())
        .or_else(|| value.pointer("/choices/0/message/content").and_then(|v| v.as_str()))
        .or_else(|| value.get("response").and_then(|v| v.as_str()))
        .unwrap_or("");
    eprintln!("insights ai response content (len={}): {}", content.len(), content.chars().take(500).collect::<String>());

    let start = content.find('{');
    let end = content.rfind('}');
    let Some((s, e)) = start.zip(end) else {
        eprintln!("insights ai response has no JSON braces. full value: {}", serde_json::to_string(&value).unwrap_or_default().chars().take(500).collect::<String>());
        return Err("no insights".to_string());
    };
    let parsed: RawPayload = serde_json::from_str(&content[s..=e]).map_err(|_| "bad json".to_string())?;
    let insights: Vec<Insight> = parsed
        .insights
        .unwrap_or_default()
        .into_iter()
        .take(3)
        .map(sanitize)
        .filter(|i| !i.title.is_empty() && !i.detail.is_empty())
        .collect();
    if insights.is_empty() {
        return Err("no insights".to_string());
    }
    Ok(insights)
}

async fn consumer_context(
    state: &Arc<AppState>,
    uid: &str,
) -> std::result::Result<String, Box<dyn std::error::Error>> {
    let conn = state.pg.get().await?;
    let mut lines: Vec<String> = vec![];
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
        let bal: f64 = r.get::<_, Option<f64>>(1).unwrap_or(0.0);
        let limit: f64 = r.get::<_, Option<f64>>(2).unwrap_or(600.0);
        if bank.is_empty() {
            lines.push(format!("Wallet: balance ₹{bal:.0}, monthly tab limit ₹{limit:.0}."));
        } else {
            lines.push(format!("Wallet: balance ₹{bal:.0} ({bank}), monthly tab limit ₹{limit:.0}."));
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
        let limit: f64 = r.get::<_, Option<f64>>(0).unwrap_or(600.0);
        let spent: f64 = r.get::<_, Option<f64>>(1).unwrap_or(0.0);
        let pct = if limit > 0.0 { (spent / limit * 100.0).round() } else { 0.0 };
        lines.push(format!("Spent this month: ₹{spent:.0} of ₹{limit:.0} ({pct}%)."));
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
        let total: f64 = days[0].get::<_, Option<f64>>(0).unwrap_or(0.0);
        lines.push(format!("Spent last 30 days: ₹{total:.0}."));
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
                let bal: f64 = r.get::<_, Option<f64>>(1).unwrap_or(0.0);
                format!("{} ₹{bal:.0}", r.get::<_, String>(0))
            })
            .collect();
        lines.push(format!("Accounts: {}", parts.join(", ")));
    }
    if let Some(r) = conn
        .query_opt(
            "SELECT monthly_income::float8, monthly_spend::float8, investment_pct::float8,
                    housing_cost::float8, dependents, debt_emis::float8
             FROM users WHERE user_id::text = $1",
            &[&uid],
        )
        .await?
    {
        let income: Option<f64> = r.get(0);
        if let Some(inc) = income {
            let annual = inc * 12.0;
            let computed_tax = new_regime_tax(annual);
            let monthly_tax = (computed_tax / 12.0).round();
            let invest: f64 = r.get::<_, Option<f64>>(2).unwrap_or(0.0);
            let invest_amt = (inc * invest / 100.0).round();
            let spend: Option<f64> = r.get(1);
            let housing: f64 = r.get::<_, Option<f64>>(3).unwrap_or(0.0);
            let dependents: Option<i32> = r.get(4);
            let emis: f64 = r.get::<_, Option<f64>>(5).unwrap_or(0.0);
            lines.push(format!(
                "Profile: income ₹{inc:.0}/mo, computed monthly tax ₹{monthly_tax:.0}/mo (annual ₹{computed_tax:.0}, new regime with rebate u/s 87A + 4% cess), spend ₹{}/mo, invests {invest:.0}% (₹{invest_amt:.0}/mo), housing ₹{housing:.0}/mo, dependents {}, EMIs ₹{emis:.0}/mo.",
                spend.map(|s| format!("{s:.0}")).unwrap_or_else(|| "?".to_string()),
                dependents.map(|d| d.to_string()).unwrap_or_else(|| "0".to_string()),
            ));
        }
    }
    if lines.is_empty() {
        lines.push("No financial data recorded yet. Complete onboarding for personalized help.".to_string());
    }
    Ok(lines.join("\n"))
}

async fn seller_context(
    state: &Arc<AppState>,
    uid: &str,
) -> std::result::Result<String, Box<dyn std::error::Error>> {
    let conn = state.pg.get().await?;
    let mut lines: Vec<String> = vec![];
    if let Some(r) = conn
        .query_opt(
            "SELECT
                COALESCE(SUM(amount) FILTER (WHERE entry_type = 'revenue' AND transaction_date >= date_trunc('month', now())), 0)::float8 AS revenue,
                COALESCE(SUM(amount) FILTER (WHERE entry_type IN ('expense','cogs','salary','rent','other') AND transaction_date >= date_trunc('month', now())), 0)::float8 AS expenses,
                COALESCE(SUM(amount) FILTER (WHERE entry_type = 'revenue' AND transaction_date >= date_trunc('month', now())), 0)::float8 -
                COALESCE(SUM(amount) FILTER (WHERE entry_type IN ('expense','cogs','salary','rent','other') AND transaction_date >= date_trunc('month', now())), 0)::float8 AS cash,
                COALESCE(SUM(amount) FILTER (WHERE entry_type = 'revenue' AND transaction_date >= date_trunc('month', now()) - interval '1 month' AND transaction_date < date_trunc('month', now())), 0)::float8 AS last_revenue
             FROM seller_finances WHERE user_id::text = $1",
            &[&uid],
        )
        .await?
    {
        let revenue: f64 = r.get(0);
        let expenses: f64 = r.get(1);
        let cash: f64 = r.get(2);
        let last_revenue: f64 = r.get(3);
        let margin = if revenue > 0.0 { (revenue - expenses) / revenue * 100.0 } else { 0.0 };
        lines.push(format!(
            "Business (current month): revenue ₹{revenue:.0}, expenses ₹{expenses:.0}, profit margin {margin:.1}%, cash on hand ₹{cash:.0}."
        ));
        if last_revenue > 0.0 {
            let g = ((revenue - last_revenue) / last_revenue) * 100.0;
            lines.push(format!("Revenue vs last month: {}{g:.1}%", if g >= 0.0 { "+" } else { "" }));
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
        lines.push(format!("Top expense categories: {}", parts.join(", ")));
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
                let desc = r.get::<_, Option<String>>(3).unwrap_or_default();
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
        lines.push(format!("Recent entries: {}", parts.join(" | ")));
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
        lines.push(format!("Low stock: {}", low.join(", ")));
    }
    if lines.is_empty() {
        lines.push("No business data recorded yet.".to_string());
    }
    Ok(lines.join("\n"))
}

pub async fn scheduler(state: Arc<AppState>) {
    tokio::time::sleep(Duration::from_secs(60)).await;
    loop {
        let conn = match state.pg.get().await {
            Ok(c) => c,
            Err(e) => {
                eprintln!("insights scheduler: pool error {e}");
                tokio::time::sleep(Duration::from_secs(3600)).await;
                continue;
            }
        };
        let rows = conn
            .query(
                "SELECT user_id::text, user_type, email, email_notifications,
                        EXTRACT(EPOCH FROM last_digest_email_at)::float8 AS last_digest
                 FROM users",
                &[],
            )
            .await;
        match rows {
            Ok(rows) => {
                for row in &rows {
                    let uid: String = row.get(0);
                    let ut: Option<String> = row.get(1);
                    let role = ut.unwrap_or_else(|| "personal".to_string());
                    if role != "personal" && role != "business" {
                        continue;
                    }
                    if let Err(e) = refresh(&state, &uid, &role).await {
                        eprintln!("insights scheduler: user {uid} ({role}): {e:?}");
                    }
                    let email_on: bool = row.get(3);
                    if !email_on {
                        continue;
                    }
                    let email: String = row.get(2);
                    let last_digest: Option<f64> = row.get(4);
                    let send = last_digest
                        .map(|ts| {
                            let now = std::time::SystemTime::now()
                                .duration_since(std::time::UNIX_EPOCH)
                                .unwrap_or_default()
                                .as_secs_f64();
                            ((now - ts) / 86400.0) >= 7.0
                        })
                        .unwrap_or(true);
                    if send {
                        if let Ok(Some(ci)) = query(&state, &uid, &role).await {
                            let body = ci.insights.iter()
                                .map(|i| format!("<li><b>{}</b>: {}</li>", i.title, i.detail))
                                .collect::<Vec<_>>()
                                .join("\n");
                            crate::email::send_email(
                                &email,
                                "Your Cartis Weekly Insights",
                                &format!("<p>Here are your latest insights:</p>\n<ul>\n{body}</ul>\n<p><a href='https://cartis-gateway.rz8m4crnwt.workers.dev/dashboard'>Open Dashboard</a></p>"),
                            ).await;
                            let _ = conn.execute(
                                "UPDATE users SET last_digest_email_at = NOW() WHERE user_id::text = $1",
                                &[&uid],
                            ).await;
                        }
                    }
                }
            }
            Err(e) => eprintln!("insights scheduler: query error {e}"),
        }
        tokio::time::sleep(Duration::from_secs(12 * 3600)).await;
    }
}
