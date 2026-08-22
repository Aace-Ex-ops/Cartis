// Thin Redis cache (read-through). Any failure degrades to "miss" — the
// caller falls back to Postgres. TTLs keep staleness bounded without
// wildcard invalidation.
use redis::aio::MultiplexedConnection;

#[derive(Clone)]
pub struct Cache(Option<MultiplexedConnection>);

impl Cache {
    pub async fn connect(url: &str) -> Cache {
        match redis::Client::open(url) {
            Ok(client) => match client.get_multiplexed_async_connection().await {
                Ok(conn) => Cache(Some(conn)),
                Err(e) => {
                    eprintln!("redis connect failed: {e}");
                    Cache(None)
                }
            },
            Err(e) => {
                eprintln!("redis open failed: {e}");
                Cache(None)
            }
        }
    }

    pub async fn get(&self, key: &str) -> Option<String> {
        let conn = self.0.as_ref()?;
        let mut conn = conn.clone();
        redis::cmd("GET").arg(key).query_async(&mut conn).await.ok().flatten()
    }

    pub async fn set(&self, key: &str, value: &str, ttl_secs: u64) {
        let Some(conn) = self.0.as_ref() else { return };
        let mut conn = conn.clone();
        let _ = redis::cmd("SETEX")
            .arg(key)
            .arg(ttl_secs)
            .arg(value)
            .query_async::<()>(&mut conn)
            .await;
    }

    pub async fn del(&self, keys: &[&str]) {
        let Some(conn) = self.0.as_ref() else { return };
        let mut conn = conn.clone();
        let _ = redis::cmd("DEL").arg(keys).query_async::<()>(&mut conn).await;
    }
}