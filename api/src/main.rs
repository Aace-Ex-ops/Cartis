use std::collections::HashSet;
use std::env;
use std::sync::{Arc, Mutex};

use argon2::password_hash::PasswordHasher;

use async_graphql::{EmptySubscription, Schema};
use async_graphql::http::graphiql_source;
use async_graphql_axum::GraphQLRequest;
use async_graphql_axum::GraphQLResponse;
use axum::extract::State;
use axum::extract::Extension;
use axum::http::HeaderMap;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::{get, patch, post};
use axum::Router;
use serde::Deserialize;
mod admin;
mod chat;
mod email;
mod graphql;
mod insights;

pub struct AppState {
    pub pg: deadpool_postgres::Pool,
    pub admin_tokens: Mutex<HashSet<String>>,
}

#[tokio::main]
async fn main() {
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL required");
    let port = env::var("PORT").unwrap_or_else(|_| "8000".into());
    let backend_secret = env::var("BACKEND_SECRET").unwrap_or_default();

    let mut pg_cfg = deadpool_postgres::Config::new();
    pg_cfg.url = Some(database_url);
    let pg = pg_cfg
        .create_pool(Some(deadpool_postgres::Runtime::Tokio1), tokio_postgres::NoTls)
        .expect("postgres pool creation failed");

    let state = Arc::new(AppState {
        pg,
        admin_tokens: Mutex::new(HashSet::new()),
    });
    bootstrap_admin(&state).await;
    let schema = Schema::build(graphql::QueryRoot, graphql::MutationRoot, EmptySubscription)
        .data(state.clone())
        .finish();

    let app = Router::new()
        .route("/health", get(|| async { "ok" }))
        .route("/graphql", get(graphiql).post(graphql_handler))
        .route("/chat/stream", post(chat::chat_stream))
        .route(
            "/chat/sessions",
            get(chat::list_sessions).post(chat::create_session),
        )
        .route(
            "/chat/sessions/{session_id}/messages",
            get(chat::session_messages),
        )
        .route(
            "/chat/sessions/{session_id}",
            patch(chat::rename_session).delete(chat::delete_session),
        )
        .route("/api/admin/login", post(admin::login))
        .route("/api/admin/admins", post(admin::add_admin))
        .route("/api/admin/users", axum::routing::get(admin::users))
        .route("/api/admin/subscriptions", axum::routing::get(admin::subscriptions))
        .route("/api/admin/emails", axum::routing::get(admin::emails))
        .route("/api/admin/logins", axum::routing::get(admin::logins))
        .route("/api/internal/aa-users", axum::routing::get(admin::aa_users))
        .route("/setu-proxy", post(setu_proxy))
        .route("/plan/update", post(plan_update))
        .with_state(state.clone())
        .layer(axum::extract::Extension(schema))
        .layer(axum::middleware::from_fn_with_state(
            backend_secret.clone(),
            require_backend_secret,
        ));

    let addr = format!("0.0.0.0:{port}");
    println!("cartis-api listening on http://{addr}");
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    tokio::spawn(insights::scheduler(state.clone()));
    axum::serve(listener, app).await.unwrap();
}

async fn require_backend_secret(
    State(secret): State<String>,
    req: axum::http::Request<axum::body::Body>,
    next: axum::middleware::Next,
) -> axum::response::Response {
    if !secret.is_empty() && !req.uri().path().starts_with("/api/admin/") {
        let ok = req
            .headers()
            .get("x-cartis-backend-secret")
            .and_then(|v| v.to_str().ok())
            .map(|v| v == secret)
            .unwrap_or(false);
        if !ok {
            return axum::response::IntoResponse::into_response((
                axum::http::StatusCode::UNAUTHORIZED,
                "missing or invalid x-cartis-backend-secret",
            ));
        }
    }
    next.run(req).await
}

async fn graphiql() -> axum::response::Html<String> {
    axum::response::Html(graphiql_source("/graphql", None))
}

#[derive(Deserialize)]
struct SetuProxyReq {
    method: String,
    url: String,
    headers: std::collections::HashMap<String, String>,
    body: Option<serde_json::Value>,
}

// Generic HTTP passthrough for the gateway (EC2 egress only — Setu, stock quotes).
async fn setu_proxy(
    axum::extract::Json(req): axum::extract::Json<SetuProxyReq>,
) -> Result<axum::response::Response, (StatusCode, String)> {
    let client = reqwest::Client::new();
    let mut builder = client
        .request(req.method.parse().unwrap_or(reqwest::Method::GET), &req.url)
        .headers(
            req.headers
                .iter()
                .map(|(k, v)| {
                    (
                        reqwest::header::HeaderName::from_bytes(k.as_bytes()).unwrap(),
                        reqwest::header::HeaderValue::from_str(v).unwrap(),
                    )
                })
                .collect(),
        );
    if let Some(body) = &req.body {
        builder = builder.json(body);
    }
    let res = builder
        .send()
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, format!("setu proxy: {e}")))?;
    let status = res.status();
    let text = res
        .text()
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, format!("setu proxy body: {e}")))?;
    Ok((status, text).into_response())
}

#[derive(Deserialize)]
struct PlanUpdateReq {
    user_id: String,
    plan: String,
}

// Called by the gateway (Polar webhook) with a valid BACKEND_SECRET.
async fn plan_update(
    State(state): State<Arc<AppState>>,
    axum::extract::Json(req): axum::extract::Json<PlanUpdateReq>,
) -> Result<axum::response::Json<serde_json::Value>, (StatusCode, String)> {
    let valid = match req.plan.as_str() {
        "pro" | "max" | "team_standard" | "team_premium" | "enterprise" | "free" => true,
        _ => false,
    };
    if !valid {
        return Err((StatusCode::BAD_REQUEST, "invalid plan".into()));
    }
    let rows = state
        .pg
        .get()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .execute(
            "UPDATE users SET plan = $2, trial_ends_at = NULL WHERE user_id::text = $1",
            &[&req.user_id, &req.plan],
        )
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(axum::response::Json(serde_json::json!({ "ok": rows > 0 })))
}

// Seed the first admin from env (ADMIN_EMAIL/ADMIN_PASSWORD) if none exists.
async fn bootstrap_admin(state: &Arc<AppState>) {
    let (Ok(email), Ok(password)) = (env::var("ADMIN_EMAIL"), env::var("ADMIN_PASSWORD")) else {
        return;
    };
    if email.is_empty() || password.is_empty() {
        return;
    }
    let exists = match state.pg.get().await {
        Ok(c) => c
            .query_opt("SELECT 1 FROM admins LIMIT 1", &[])
            .await
            .ok()
            .flatten()
            .is_some(),
        Err(_) => true,
    };
    if exists {
        return;
    }
    let salt = argon2::password_hash::SaltString::generate(&mut argon2::password_hash::rand_core::OsRng);
    let hash = argon2::Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .unwrap_or_default();
    if let Ok(mut conn) = state.pg.get().await {
        let _ = conn
            .execute(
                "INSERT INTO admins (email, password_hash) VALUES ($1, $2)",
                &[&email, &hash],
            )
            .await;
    }
    println!("bootstrapped admin {email}");
}

async fn graphql_handler(
    State(_state): State<Arc<AppState>>,
    headers: HeaderMap,
    Extension(schema): Extension<Schema<graphql::QueryRoot, graphql::MutationRoot, EmptySubscription>>,
    req: GraphQLRequest,
) -> GraphQLResponse {
    let inner = match headers
        .get("x-user-id")
        .and_then(|v| v.to_str().ok())
        .filter(|s| !s.is_empty())
    {
        Some(uid) => req.into_inner().data(uid.to_string()),
        None => req.into_inner(),
    };
    schema.execute(inner).await.into()
}
