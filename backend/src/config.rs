use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    pub database_url: String,
    pub supabase_url: String,
    pub supabase_anon_key: String,
    pub legacy_jwt_secret: Option<String>,
    pub port: u16,
    pub gcp_project_id: Option<String>,
}

impl Config {
    pub fn from_env() -> Result<Self, String> {
        let database_url = env::var("DATABASE_URL")
            .map_err(|_| "DATABASE_URL environment variable must be set".to_string())?;

        // Support new Supabase Asymmetric Auth (SUPABASE_URL + SUPABASE_ANON_KEY)
        let supabase_url = env::var("SUPABASE_URL")
            .unwrap_or_else(|_| "https://ppjpvyuhegqjqoyjwljx.supabase.co".to_string());

        let supabase_anon_key = env::var("SUPABASE_ANON_KEY")
            .unwrap_or_else(|_| env::var("VITE_SUPABASE_ANON_KEY").unwrap_or_default());

        let legacy_jwt_secret = env::var("SUPABASE_JWT_SECRET").ok();

        let port = env::var("PORT")
            .unwrap_or_else(|_| "8080".to_string())
            .parse::<u16>()
            .map_err(|_| "PORT must be a valid port number".to_string())?;

        let gcp_project_id = env::var("GCP_PROJECT_ID").ok();

        Ok(Self {
            database_url,
            supabase_url,
            supabase_anon_key,
            legacy_jwt_secret,
            port,
            gcp_project_id,
        })
    }
}
