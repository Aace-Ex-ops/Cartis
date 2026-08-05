use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use std::env;

use axum::extract::Path;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use serde::{Deserialize, Serialize};
use tokio_postgres::Row;

use crate::AppState;

fn base_url() -> String {
    env::var("SETU_AA_BASE_URL").unwrap_or_else(|_| "https://fiu-sandbox.setu.co".into())
}

fn client_id() -> String { env::var("SETU_CLIENT_ID").unwrap_or_default() }
fn client_secret() -> String { env::var("SETU_CLIENT_SECRET").unwrap_or_default() }
fn product_instance_id() -> String { env::var("SETU_PRODUCT_INSTANCE_ID").unwrap_or_default() }

fn epoch_to_iso(secs: u64) -> String {
    let days = secs / 86400;
    let (y, rem) = ((days + 719468) / 146097, (days + 719468) % 146097);
    let (c, d) = (rem / 1460, rem % 1460);
    let (d2, m) = (d / 30, d % 30);
    let mo = if m < 12 { m + 3 } else { m - 9 };
    let yr = y * 100 + c + if mo <= 2 { 1 } else { 0 };
    format!("{yr:04}-{mo:02}-{d2:02}T00:00:00.000Z")
}

// ── Token cache ─────────────────────────────────────────────────────

struct TokenCache {
    token: String,
    expires_at: Instant,
}

static mut TOKEN_CACHE: Option<TokenCache> = None;

async fn get_access_token() -> Result<String, String> {
    unsafe {
        if let Some(ref c) = TOKEN_CACHE {
            if c.expires_at > Instant::now() {
                return Ok(c.token.clone());
            }
        }
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .post(format!("{}/v2/token", base_url()))
        .json(&serde_json::json!({
            "clientId": client_id(),
            "clientSecret": client_secret(),
        }))
        .send()
        .await
        .map_err(|e| format!("token request failed: {e}"))?;

    let body: serde_json::Value = resp.json().await.map_err(|e| format!("token parse: {e}"))?;
    let token = body.get("accessToken")
        .and_then(|v| v.as_str())
        .ok_or("no accessToken in response")?
        .to_string();
    let expires_in = body.get("expiresIn")
        .and_then(|v| v.as_u64())
        .unwrap_or(3600);

    unsafe {
        TOKEN_CACHE = Some(TokenCache {
            token: token.clone(),
            expires_at: Instant::now() + Duration::from_secs(expires_in.saturating_sub(300)),
        });
    }

    Ok(token)
}

// ── Axum handlers ──────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct ConsentRequest {
    pub mobile: String,
    pub fip_id: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct ConsentResponse {
    pub id: String,
    pub url: String,
    pub status: String,
}

#[derive(Serialize, Deserialize)]
pub struct ConsentStatusResponse {
    pub id: String,
    pub status: String,
}

pub async fn create_consent_handler(
    State(_state): State<Arc<AppState>>,
    Json(body): Json<ConsentRequest>,
) -> impl IntoResponse {
    match create_consent(&body.mobile, body.fip_id.as_deref()).await {
        Ok(r) => (StatusCode::OK, Json(serde_json::to_value(r).unwrap())),
        Err(e) => (StatusCode::BAD_GATEWAY, Json(serde_json::json!({"error": e}))),
    }
}

pub async fn consent_status_handler(
    Path(id): Path<String>,
) -> impl IntoResponse {
    match consent_status(&id).await {
        Ok(r) => (StatusCode::OK, Json(serde_json::to_value(r).unwrap())),
        Err(e) => (StatusCode::BAD_GATEWAY, Json(serde_json::json!({"error": e}))),
    }
}

// ── Consent API ─────────────────────────────────────────────────────

pub async fn create_consent(mobile: &str, fip_id: Option<&str>) -> Result<ConsentResponse, String> {
    let token = get_access_token().await?;
    let vua = format!("{mobile}@onemoney");

    let now_secs = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
    let from_date = epoch_to_iso(now_secs.saturating_sub(365 * 86400));
    let to_date = epoch_to_iso(now_secs);

    let mut context = serde_json::json!({});
    if let Some(fip) = fip_id {
        context["fipId"] = serde_json::Value::String(fip.to_string());
    }

    let body = serde_json::json!({
        "consentTypes": ["PROFILE", "SUMMARY", "TRANSACTIONS"],
        "fiTypes": ["ACCOUNT"],
        "fetchType": "ONETIME",
        "consentMode": "STORE",
        "purpose": {
            "code": "103",
            "refUri": "https://api.rebit.org.in/aa/purpose/103.xml",
            "text": "Personal finance and budgeting"
        },
        "vua": vua,
        "dataRange": { "from": from_date, "to": to_date },
        "redirectUrl": format!("{}/dashboard", env::var("APP_URL").unwrap_or_else(|_| "https://cartis-gateway.rz8m4crnwt.workers.dev".into())),
        "context": context,
    });

    let client = reqwest::Client::builder().timeout(Duration::from_secs(30)).build().map_err(|e| e.to_string())?;
    let resp = client
        .post(format!("{}/v2/consents", base_url()))
        .header("Authorization", format!("Bearer {token}"))
        .header("x-product-instance-id", product_instance_id())
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("consent create: {e}"))?;

    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    if !status.is_success() { return Err(format!("setu consent {status}: {text}")); }

    serde_json::from_str(&text).map_err(|e| format!("consent parse: {e} -- {text}"))
}

pub async fn consent_status(consent_id: &str) -> Result<ConsentStatusResponse, String> {
    let token = get_access_token().await?;
    let client = reqwest::Client::builder().timeout(Duration::from_secs(15)).build().map_err(|e| e.to_string())?;

    let resp = client
        .get(format!("{}/v2/consents/{consent_id}", base_url()))
        .header("Authorization", format!("Bearer {token}"))
        .header("x-product-instance-id", product_instance_id())
        .send()
        .await
        .map_err(|e| format!("consent status: {e}"))?;

    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    if !status.is_success() { return Err(format!("setu status {status}: {text}")); }

    serde_json::from_str(&text).map_err(|e| format!("status parse: {e}"))
}

// ── Webhook handler ─────────────────────────────────────────────────

#[derive(Deserialize, Debug)]
pub struct FiAccount {
    #[serde(rename = "fipID")]
    pub fip_id: String,
    pub data: Vec<FiAccountData>,
}

#[derive(Deserialize, Debug)]
pub struct FiAccountData {
    #[serde(rename = "maskedAccNumber")]
    pub masked_acc_number: String,
    #[serde(rename = "decryptedFI")]
    pub decrypted_fi: DecryptedFi,
}

#[derive(Deserialize, Debug)]
pub struct DecryptedFi {
    pub account: FiAccountInfo,
    #[serde(default)]
    pub transactions: Vec<FiTransaction>,
}

#[derive(Deserialize, Debug)]
pub struct FiAccountInfo {
    #[serde(rename = "maskedAccNumber")]
    pub masked_acc_number: String,
    #[serde(rename = "type")]
    pub account_type: String,
}

#[derive(Deserialize, Debug)]
pub struct FiTransaction {
    pub amount: String,
    #[serde(rename = "type")]
    pub txn_type: String,
    pub narration: Option<String>,
    #[serde(rename = "transactionTimestamp")]
    pub transaction_timestamp: String,
    #[serde(rename = "valueDate")]
    pub value_date: Option<String>,
    #[serde(rename = "txnId")]
    pub txn_id: Option<String>,
    pub reference: Option<String>,
    #[serde(rename = "currentBalance")]
    pub current_balance: Option<String>,
}

pub async fn webhook(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<serde_json::Value>,
) -> impl IntoResponse {
    let notif_type = payload.get("type").and_then(|v| v.as_str()).unwrap_or("");
    let consent_id = payload.get("consentId").and_then(|v| v.as_str()).unwrap_or("");

    eprintln!("setu webhook: type={notif_type} consentId={consent_id}");

    match notif_type {
        "CONSENT_STATUS_UPDATE" => {
            let status = payload.get("status").and_then(|v| v.as_str()).unwrap_or("");
            if let Err(e) = update_consent_status(&state, consent_id, status).await {
                eprintln!("setu consent update error: {e}");
                return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": e})));
            }
        }
        "FI_DATA_READY" => {
            if let Err(e) = process_fi_data(&state, &payload).await {
                eprintln!("setu fi data error: {e}");
                return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": e})));
            }
        }
        _ => {
            eprintln!("setu unknown webhook type: {notif_type}");
        }
    }

    (StatusCode::OK, Json(serde_json::json!({"ok": true})))
}

async fn update_consent_status(state: &Arc<AppState>, consent_id: &str, status: &str) -> Result<(), String> {
    let conn = state.pg.get().await.map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE setu_consents SET status = $1, updated_at = NOW() WHERE consent_id = $2",
        &[&status, &consent_id],
    ).await.map_err(|e| e.to_string())?;
    Ok(())
}

async fn process_fi_data(state: &Arc<AppState>, payload: &serde_json::Value) -> Result<(), String> {
    let consent_id = payload.get("consentId").and_then(|v| v.as_str()).unwrap_or("");
    let fi_data: Vec<FiAccount> = serde_json::from_value(
        payload.get("fiData").cloned().unwrap_or(serde_json::json!([])),
    ).map_err(|e| format!("fiData parse: {e}"))?;

    let mut conn = state.pg.get().await.map_err(|e| e.to_string())?;
    let row: Option<Row> = conn.query_opt(
        "SELECT user_id::text, fip_id FROM setu_consents WHERE consent_id = $1",
        &[&consent_id],
    ).await.map_err(|e| e.to_string())?;

    let (user_id, _): (String, Option<String>) = match row {
        Some(r) => (r.get(0), r.get(1)),
        None => return Err(format!("unknown consent: {consent_id}")),
    };

    let tx = conn.transaction().await.map_err(|e| e.to_string())?;

    for account in &fi_data {
        let fip_id = &account.fip_id;

        let bank_row: Option<Row> = tx.query_opt(
            "SELECT bank_id::text, name FROM banks WHERE fip_id = $1",
            &[&fip_id],
        ).await.map_err(|e| e.to_string())?;

        let bank_id = match bank_row {
            Some(r) => r.get::<_, String>(0),
            None => {
                let name = format!("Unknown ({fip_id})");
                tx.execute(
                    "INSERT INTO banks (name, fip_id) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET fip_id = $2",
                    &[&name, &fip_id],
                ).await.map_err(|e| e.to_string())?;
                let r: Row = tx.query_one("SELECT bank_id::text FROM banks WHERE name = $1", &[&name]).await.map_err(|e| e.to_string())?;
                r.get(0)
            }
        };

        for acct in &account.data {
            let masked = &acct.masked_acc_number;
            let aa_type = &acct.decrypted_fi.account.account_type;

            let existing: Option<Row> = tx.query_opt(
                "SELECT account_id::text FROM bank_accounts WHERE user_id::text = $1 AND bank_id::text = $2 AND masked_account_number = $3",
                &[&user_id, &bank_id, masked],
            ).await.map_err(|e| e.to_string())?;

            let account_id: String = match existing {
                Some(r) => r.get(0),
                None => {
                    let r: Row = tx.query_one(
                        "INSERT INTO bank_accounts (account_id, user_id, bank_id, fip_id, masked_account_number, account_type, is_primary)
                         VALUES (gen_random_uuid(), $1::text::uuid, $2::text::uuid, $3, $4, $5, true) RETURNING account_id::text",
                        &[&user_id, &bank_id, &fip_id, masked, &aa_type],
                    ).await.map_err(|e| e.to_string())?;
                    r.get(0)
                }
            };

            for txn in &acct.decrypted_fi.transactions {
                let txn_id = txn.txn_id.as_deref().unwrap_or("");
                if txn_id.is_empty() { continue; }

                let amount_val: f64 = txn.amount.parse().unwrap_or(0.0);
                let signed_amount = if txn.txn_type == "CREDIT" { -amount_val } else { amount_val };

                let idem_key = format!("setu:{txn_id}");
                let date_val: Option<&str> = txn.value_date.as_deref().and_then(|d| {
                    if d.len() >= 10 { Some(&d[..10]) } else { None }
                });

                let _ = tx.execute(
                    "INSERT INTO ledger_entries (user_id, account_type, transaction_type, amount, idempotency_key, transaction_date, payee, description, reference_id)
                     VALUES ($1::text::uuid, 'budget', $2, $3::text::numeric, $4, $5::date, $6, $7, $8)
                     ON CONFLICT (idempotency_key) DO NOTHING",
                    &[&user_id, &txn.txn_type, &signed_amount.to_string(), &idem_key, &date_val, &txn.narration, &txn.narration, &txn.reference],
                ).await.map_err(|e| e.to_string())?;
            }

            if let Some(last) = acct.decrypted_fi.transactions.last() {
                if let Some(bal_str) = &last.current_balance {
                    if let Ok(bal) = bal_str.parse::<f64>() {
                        let _ = tx.execute(
                            "UPDATE bank_accounts SET balance = $1, last_sync_at = NOW(), data_as_of = NOW() WHERE account_id = $2::text::uuid",
                            &[&bal.to_string(), &account_id],
                        ).await;
                    }
                }
            }
        }
    }

    tx.commit().await.map_err(|e| e.to_string())?;

    let _ = state.pg.get().await.map_err(|e| e.to_string())?
        .execute("UPDATE setu_consents SET status = 'DATA_RECEIVED', updated_at = NOW() WHERE consent_id = $1", &[&consent_id]).await;

    Ok(())
}
