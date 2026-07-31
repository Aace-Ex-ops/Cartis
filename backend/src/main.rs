use std::env;
use std::sync::Arc;

use async_graphql::{EmptySubscription, Schema};
use async_graphql::http::graphiql_source;
use async_graphql_axum::GraphQLRequest;
use async_graphql_axum::GraphQLResponse;
use axum::extract::State;
use axum::extract::Extension;
use axum::http::HeaderMap;
use axum::routing::get;
use axum::Router;
use tokio_postgres::Client;

mod graphql;

pub struct AppState {
    pub pg: Client,
    pub redis: Option<redis::Client>,
}

#[tokio::main]
async fn main() {
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL required");
    let redis_url = env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".into());
    let port = env::var("PORT").unwrap_or_else(|_| "8000".into());

    let (pg, connection) = tokio_postgres::connect(&database_url, tokio_postgres::NoTls)
        .await
        .expect("postgres connection failed");
    tokio::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("postgres connection error: {e}");
        }
    });

    let redis = match redis::Client::open(redis_url) {
        Ok(c) => match c.get_async_connection().await {
            Ok(_) => Some(c),
            Err(e) => {
                eprintln!("redis unavailable, continuing without cache: {e}");
                None
            }
        },
        Err(e) => {
            eprintln!("redis misconfigured, continuing without cache: {e}");
            None
        }
    };

    let state = Arc::new(AppState { pg, redis });
    let schema = Schema::build(graphql::QueryRoot, graphql::MutationRoot, EmptySubscription)
        .data(state.clone())
        .finish();

    let app = Router::new()
        .route("/health", get(|| async { "ok" }))
        .route("/graphql", get(graphiql).post(graphql_handler))
        .with_state(state)
        .layer(axum::extract::Extension(schema));

    let addr = format!("0.0.0.0:{port}");
    println!("cartis-api listening on http://{addr}");
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn graphiql() -> axum::response::Html<String> {
    axum::response::Html(graphiql_source("/graphql", None))
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
