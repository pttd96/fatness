use std::net::SocketAddr;

use axum::{
    routing::{delete, get, patch, post, put},
    Router,
};
use sqlx::postgres::PgPoolOptions;
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod config;
mod errors;
mod handlers;
mod middleware;
mod models;
mod services;

use config::Config;
use middleware::auth::{new_token_cache, TokenCache};

#[derive(Clone)]
pub struct AppState {
    pub db: sqlx::PgPool,
    pub supabase_url: String,
    pub supabase_anon_key: String,
    pub legacy_jwt_secret: Option<String>,
    pub gcp_project_id: Option<String>,
    pub http_client: reqwest::Client,
    pub token_cache: TokenCache,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "fatness_backend=debug,tower_http=debug,axum=trace".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = Config::from_env().map_err(|e| {
        tracing::error!("Configuration error: {}", e);
        e
    })?;

    tracing::info!("Connecting to PostgreSQL database...");
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&config.database_url)
        .await
        .map_err(|e| {
            tracing::error!("Failed to connect to database: {}", e);
            e
        })?;
    tracing::info!("Database connection established");

    let state = AppState {
        db: pool,
        supabase_url: config.supabase_url,
        supabase_anon_key: config.supabase_anon_key,
        legacy_jwt_secret: config.legacy_jwt_secret,
        gcp_project_id: config.gcp_project_id,
        http_client: reqwest::Client::new(),
        token_cache: new_token_cache(),
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        // Health check
        .route("/health", get(|| async { "OK" }))
        // Profile routes
        .route(
            "/profile",
            get(handlers::profile::get_profile)
                .post(handlers::profile::create_profile)
                .put(handlers::profile::update_profile),
        )
        // Exercise catalog routes
        .route(
            "/exercises",
            get(handlers::exercises::list_exercises).post(handlers::exercises::create_exercise),
        )
        .route(
            "/exercises/{id}",
            get(handlers::exercises::get_exercise)
                .put(handlers::exercises::update_exercise)
                .delete(handlers::exercises::delete_exercise),
        )
        // Weekly plan routes
        .route(
            "/plans",
            get(handlers::plans::list_plans).post(handlers::plans::create_plan),
        )
        .route("/plans/current", get(handlers::plans::get_current_plan))
        .route(
            "/plans/{id}",
            get(handlers::plans::get_plan).delete(handlers::plans::delete_plan),
        )
        .route(
            "/plans/{id}/exercises",
            post(handlers::plans::add_planned_exercise),
        )
        .route(
            "/plans/{id}/reorder",
            put(handlers::plans::reorder_planned_exercises),
        )
        .route("/plans/generate", post(handlers::plans::generate_plan))
        // Planned exercise routes
        .route(
            "/planned-exercises/{id}",
            delete(handlers::logs::delete_planned_exercise),
        )
        .route(
            "/planned-exercises/{id}/log",
            patch(handlers::logs::log_exercise),
        )
        // Coach routes (Require COACH role)
        .route(
            "/coach/clients/lookup",
            get(handlers::coach::lookup_client),
        )
        .route(
            "/coach/clients/{client_id}/plan",
            post(handlers::coach::create_or_update_client_plan),
        )
        .route(
            "/coach/clients/{client_id}/plan/exercises",
            post(handlers::coach::add_client_planned_exercise),
        )
        .route(
            "/coach/clients/{client_id}/planned-exercises/{planned_id}",
            patch(handlers::coach::update_client_planned_exercise)
                .delete(handlers::coach::delete_client_planned_exercise),
        )
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    tracing::info!("Backend server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
