use std::sync::Arc;

use argon2::password_hash::{rand_core::OsRng, SaltString};
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use axum::extract::State;
use axum::http::HeaderMap;
use axum::http::StatusCode;
use axum::Json;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::AppState;

fn authed(state: &AppState, headers: &HeaderMap) -> bool {
    headers
        .get("x-admin-token")
        .and_then(|v| v.to_str().ok())
        .map(|t| state.admin_tokens.lock().map(|s| s.contains(t)).unwrap_or(false))
        .unwrap_or(false)
}

fn db_err(e: impl std::fmt::Display) -> (StatusCode, String) {
    (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
}

#[derive(Deserialize)]
pub struct LoginReq {
    email: String,
    password: String,
}

#[derive(Serialize)]
pub struct LoginRes {
    token: String,
}

pub async fn login(
    State(state): State<Arc<AppState>>,
    Json(req): Json<LoginReq>,
) -> Result<Json<LoginRes>, (StatusCode, String)> {
    let row = state
        .pg
        .get()
        .await
        .map_err(db_err)?
        .query_opt("SELECT password_hash FROM admins WHERE email = $1", &[&req.email])
        .await
        .map_err(db_err)?;
    let Some(row) = row else {
        return Err((StatusCode::UNAUTHORIZED, "bad email or password".into()));
    };
    let hash: String = row.get(0);
    let parsed = PasswordHash::new(&hash).map_err(db_err)?;
    if Argon2::default()
        .verify_password(req.password.as_bytes(), &parsed)
        .is_err()
    {
        return Err((StatusCode::UNAUTHORIZED, "bad email or password".into()));
    }
    let token = Uuid::new_v4().to_string();
    state.admin_tokens.lock().unwrap().insert(token.clone());
    Ok(Json(LoginRes { token }))
}

#[derive(Deserialize)]
pub struct AddAdminReq {
    email: String,
    password: String,
}

pub async fn add_admin(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(req): Json<AddAdminReq>,
) -> Result<StatusCode, (StatusCode, String)> {
    if !authed(&state, &headers) {
        return Err((StatusCode::UNAUTHORIZED, "invalid or missing admin token".into()));
    }
    if !req.email.contains('@') || req.password.len() < 8 {
        return Err((StatusCode::BAD_REQUEST, "invalid email or password (min 8 chars)".into()));
    }
    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(req.password.as_bytes(), &salt)
        .map_err(db_err)?
        .to_string();
    state
        .pg
        .get()
        .await
        .map_err(db_err)?
        .execute(
            "INSERT INTO admins (email, password_hash) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING",
            &[&req.email, &hash],
        )
        .await
        .map_err(db_err)?;
    Ok(StatusCode::OK)
}

#[derive(Serialize)]
pub struct AdminUser {
    user_id: String,
    email: String,
    full_name: String,
    oauth_provider: String,
    user_type: String,
    business_type: String,
    created_at: Option<String>,
    last_login_at: Option<String>,
    wallet_balance: Option<f64>,
    monthly_tab_limit: Option<f64>,
    email_notifications: bool,
    ai_model: Option<String>,
}

pub async fn users(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<Vec<AdminUser>>, (StatusCode, String)> {
    if !authed(&state, &headers) {
        return Err((StatusCode::UNAUTHORIZED, "invalid or missing admin token".into()));
    }
    let rows = state
        .pg
        .get()
        .await
        .map_err(db_err)?
        .query(
            "SELECT user_id::text, email, full_name, oauth_provider, user_type, business_type,
                    to_char(created_at, 'YYYY-MM-DD HH24:MI'), to_char(last_login_at, 'YYYY-MM-DD HH24:MI'),
                    wallet_balance::float8, monthly_tab_limit::float8, email_notifications, ai_model
             FROM users ORDER BY created_at DESC",
            &[],
        )
        .await
        .map_err(db_err)?;
    Ok(Json(
        rows.iter()
            .map(|r| AdminUser {
                user_id: r.get(0),
                email: r.get(1),
                full_name: r.get(2),
                oauth_provider: r.get(3),
                user_type: r.get(4),
                business_type: r.get(5),
                created_at: r.get(6),
                last_login_at: r.get(7),
                wallet_balance: r.get(8),
                monthly_tab_limit: r.get(9),
                email_notifications: r.get(10),
                ai_model: r.get(11),
            })
            .collect(),
    ))
}

#[derive(Serialize)]
pub struct AdminSubscription {
    transaction_id: String,
    email: String,
    amount: Option<f64>,
    payment_method: String,
    status: String,
    created_at: Option<String>,
}

pub async fn subscriptions(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<Vec<AdminSubscription>>, (StatusCode, String)> {
    if !authed(&state, &headers) {
        return Err((StatusCode::UNAUTHORIZED, "invalid or missing admin token".into()));
    }
    let rows = state
        .pg
        .get()
        .await
        .map_err(db_err)?
        .query(
            "SELECT t.transaction_id::text, u.email, t.amount::float8, t.payment_method, t.status,
                    to_char(t.created_at, 'YYYY-MM-DD HH24:MI')
             FROM transactions t JOIN users u ON u.user_id = t.user_id
             WHERE t.polar_checkout_id IS NOT NULL
             ORDER BY t.created_at DESC LIMIT 200",
            &[],
        )
        .await
        .map_err(db_err)?;
    Ok(Json(
        rows.iter()
            .map(|r| AdminSubscription {
                transaction_id: r.get(0),
                email: r.get(1),
                amount: r.get(2),
                payment_method: r.get(3),
                status: r.get(4),
                created_at: r.get(5),
            })
            .collect(),
    ))
}

#[derive(Serialize)]
pub struct AdminEmail {
    id: i64,
    to_email: String,
    subject: String,
    status: String,
    created_at: Option<String>,
}

pub async fn emails(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<Vec<AdminEmail>>, (StatusCode, String)> {
    if !authed(&state, &headers) {
        return Err((StatusCode::UNAUTHORIZED, "invalid or missing admin token".into()));
    }
    let rows = state
        .pg
        .get()
        .await
        .map_err(db_err)?
        .query(
            "SELECT id, to_email, subject, status, to_char(created_at, 'YYYY-MM-DD HH24:MI')
             FROM email_log ORDER BY id DESC LIMIT 200",
            &[],
        )
        .await
        .map_err(db_err)?;
    Ok(Json(
        rows.iter()
            .map(|r| AdminEmail {
                id: r.get(0),
                to_email: r.get(1),
                subject: r.get(2),
                status: r.get(3),
                created_at: r.get(4),
            })
            .collect(),
    ))
}

#[derive(Serialize)]
pub struct LoginCount {
    day: String,
    logins: i64,
}

pub async fn logins(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<Vec<LoginCount>>, (StatusCode, String)> {
    if !authed(&state, &headers) {
        return Err((StatusCode::UNAUTHORIZED, "invalid or missing admin token".into()));
    }
    let rows = state
        .pg
        .get()
        .await
        .map_err(db_err)?
        .query(
            "SELECT to_char(date_trunc('day', last_login_at), 'YYYY-MM-DD'), count(*)
             FROM users WHERE last_login_at IS NOT NULL
             GROUP BY 1 ORDER BY 1 DESC LIMIT 14",
            &[],
        )
        .await
        .map_err(db_err)?;
    Ok(Json(
        rows.iter()
            .map(|r| LoginCount {
                day: r.get(0),
                logins: r.get(1),
            })
            .collect(),
    ))
}

// Internal (cron) route: user ids that have an AA connection — the daily
// Yodlee sync fan-out list. Gated by the backend secret middleware in main.rs.
pub async fn aa_users(State(state): State<Arc<AppState>>) -> Result<Json<Vec<String>>, (StatusCode, String)> {
    let rows = state
        .pg
        .get()
        .await
        .map_err(db_err)?
        .query(
            "SELECT user_id::text FROM aa_connections ORDER BY last_fetched_at DESC",
            &[],
        )
        .await
        .map_err(db_err)?;
    Ok(Json(rows.iter().map(|r| r.get(0)).collect()))
}
