use std::sync::Arc;

use crate::AppState;

pub struct Tier {
    pub chat: i64,
    pub capture: i64,
    pub insights: i64,
    pub sm_push: i64,
}

// Daily per-user AI/SuperMemory limits, tiered by effective plan.
pub fn tier(plan: &str) -> Tier {
    match plan {
        "max" | "team_premium" => Tier { chat: 500, capture: 500, insights: 20, sm_push: 200 },
        "pro" | "team_standard" => Tier { chat: 200, capture: 200, insights: 10, sm_push: 100 },
        "enterprise" => Tier { chat: 1500, capture: 1500, insights: 60, sm_push: 500 },
        // free / trial
        _ => Tier { chat: 20, capture: 20, insights: 2, sm_push: 20 },
    }
}

fn allowed(plan: &str, metric: &str) -> Result<i64, String> {
    let t = tier(plan);
    Ok(match metric {
        "ai_chat" => t.chat,
        "ai_capture" => t.capture,
        "ai_insights" => t.insights,
        "sm_push" => t.sm_push,
        _ => return Err(format!("unknown usage metric: {metric}")),
    })
}

// Atomically check-and-increment a daily usage counter for a user.
// Returns Ok(true) if within limit (count incremented), Ok(false) if over.
pub async fn bump(state: &Arc<AppState>, uid: &str, metric: &str) -> Result<bool, String> {
    let mut conn = state.pg.get().await.map_err(|e| format!("usage pool: {e}"))?;
    let tx = conn
        .transaction()
        .await
        .map_err(|e| format!("usage tx: {e}"))?;

    let plan: String = tx
        .query_opt(
            "SELECT COALESCE(CASE WHEN trial_ends_at > now() THEN 'trial' END, plan)
             FROM users WHERE user_id::text = $1",
            &[&uid],
        )
        .await
        .map_err(|e| format!("usage plan lookup: {e}"))?
        .map(|r| r.get::<_, Option<String>>(0).unwrap_or_else(|| "free".into()))
        .unwrap_or_else(|| "free".into());

    let cap = allowed(&plan, metric)?;

    let count: i64 = tx
        .query_opt(
            "SELECT count::bigint FROM usage_daily WHERE user_id::text = $1 AND metric = $2 AND day = CURRENT_DATE",
            &[&uid, &metric],
        )
        .await
        .map_err(|e| format!("usage read: {e}"))?
        .map(|r| r.get(0))
        .unwrap_or(0);

    if count >= cap {
        tx.rollback().await.ok();
        return Ok(false);
    }

    tx.execute(
        "INSERT INTO usage_daily (user_id, metric, day, count)
         VALUES ($1::text::uuid, $2, CURRENT_DATE, 1)
         ON CONFLICT (user_id, metric, day) DO UPDATE SET count = usage_daily.count + 1",
        &[&uid, &metric],
    )
    .await
    .map_err(|e| format!("usage write: {e}"))?;
    tx.commit().await.map_err(|e| format!("usage commit: {e}"))?;
    Ok(true)
}

pub const DDL: &str = "
CREATE TABLE IF NOT EXISTS usage_daily (
    user_id uuid NOT NULL,
    metric varchar(32) NOT NULL,
    day date NOT NULL,
    count bigint NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, metric, day)
);";
