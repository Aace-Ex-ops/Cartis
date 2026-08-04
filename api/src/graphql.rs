use std::sync::Arc;

use argon2::password_hash::{PasswordHash, PasswordHasher, SaltString, rand_core::OsRng};
use argon2::{Argon2, PasswordVerifier};
use async_graphql::{Context, Object, Result};

use crate::chat::purge_supermemory;
use crate::AppState;

fn user_id(ctx: &Context<'_>) -> Option<String> {
    ctx.data_opt::<String>().cloned()
}

fn pg<'a>(ctx: &'a Context<'_>) -> &'a deadpool_postgres::Pool {
    &ctx.data_unchecked::<Arc<AppState>>().pg
}

#[derive(Default)]
pub struct QueryRoot;

#[derive(Default)]
pub struct MutationRoot;

const USER_CHILD_TABLES: [&str; 12] = [
    "sessions",
    "bank_accounts",
    "analysis_log",
    "ledger_entries",
    "transactions",
    "budget_alerts",
    "seller_finances",
    "seller_inventory",
    "financial_health_scores",
    "budget_suggestions",
    "coach_insights",
    "chat_sessions",
];

#[Object]
impl QueryRoot {
    async fn google_user_by_email(&self, ctx: &Context<'_>, email: String) -> Result<Option<String>> {
        let row = pg(ctx).get().await?
            .query_opt(
                "SELECT user_id::text FROM users WHERE email = $1",
                &[&email],
            )
            .await?;
        Ok(row.map(|r| r.get(0)))
    }

    async fn me(&self, ctx: &Context<'_>) -> Result<Option<User>> {
        let Some(uid) = user_id(ctx) else { return Ok(None) };
        let row = pg(ctx).get().await?
            .query_opt(
                "SELECT user_id::text, email, full_name, avatar_url, user_type,
                        wallet_balance::float8, monthly_tab_limit::float8,
                        annual_deferred_limit::float8, financial_health_score,
                        coach_adherence_score::float8,
                        monthly_income::float8, monthly_spend::float8,
                        investment_pct::float8, housing_cost::float8,
                        dependents, debt_emis::float8,
                        monthly_tax::float8,
                        ai_model, business_name
                 FROM users WHERE user_id::text = $1",
                &[&uid],
            )
            .await?;
        Ok(row.map(User::from_row))
    }

    async fn wallet(&self, ctx: &Context<'_>) -> Result<Option<Wallet>> {
        let Some(uid) = user_id(ctx) else { return Ok(None) };
        let row = pg(ctx).get().await?
            .query_opt(
                "SELECT wallet_balance::float8, monthly_tab_limit::float8, annual_deferred_limit::float8
                 FROM users WHERE user_id::text = $1",
                &[&uid],
            )
            .await?;
        Ok(row.map(Wallet::from_row))
    }

    async fn monthly_tab(&self, ctx: &Context<'_>) -> Result<Option<MonthlyTab>> {
        let Some(uid) = user_id(ctx) else { return Ok(None) };
        let row = pg(ctx).get().await?
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
            .await?;
        Ok(row.map(|r| MonthlyTab {
            limit: r.get(0),
            spent: r.get(1),
        }))
    }

    #[graphql(name = "spending30d")]
    async fn spending_30d(&self, ctx: &Context<'_>) -> Result<Vec<SpendingDay>> {
        let Some(uid) = user_id(ctx) else { return Ok(vec![]) };
        let rows = pg(ctx).get().await?
            .query(
                "SELECT to_char(created_at, 'DD') AS day, COALESCE(SUM(amount), 0)::float8 AS spend
                 FROM ledger_entries
                 WHERE user_id::text = $1 AND account_type = 'budget'
                   AND created_at >= now() - interval '30 days'
                 GROUP BY 1 ORDER BY 1",
                &[&uid],
            )
            .await?;
        Ok(rows.iter().map(|r| SpendingDay { day: r.get(0), spend: r.get(1) }).collect())
    }

    async fn bank_accounts(&self, ctx: &Context<'_>) -> Result<Vec<BankAccount>> {
        let Some(uid) = user_id(ctx) else { return Ok(vec![]) };
        let rows = pg(ctx).get().await?
            .query(
                "SELECT account_id::text, b.name, mobile_number, account_type,
                        balance::float8, last_sync_at::text, is_primary
                 FROM bank_accounts ba JOIN banks b ON b.bank_id = ba.bank_id
                 WHERE ba.user_id::text = $1 ORDER BY ba.is_primary DESC, ba.created_at",
                &[&uid],
            )
            .await?;
        Ok(rows.iter().map(BankAccount::from_row).collect())
    }

    async fn banks(&self, ctx: &Context<'_>) -> Result<Vec<Bank>> {
        let rows = pg(ctx).get().await?
            .query("SELECT name, whatsapp_number FROM banks ORDER BY name", &[])
            .await?;
        Ok(rows.iter().map(Bank::from_row).collect())
    }

    async fn coach_insights(&self, ctx: &Context<'_>, role: String) -> Result<Option<crate::insights::CoachInsights>> {
        let Some(uid) = user_id(ctx) else { return Ok(None) };
        let state = ctx.data_unchecked::<Arc<AppState>>();
        crate::insights::query(state, &uid, &role).await
    }

    async fn analysis_history(&self, ctx: &Context<'_>, limit: Option<i32>, offset: Option<i32>) -> Result<Vec<AnalysisLog>> {
        let Some(uid) = user_id(ctx) else { return Ok(vec![]) };
        let rows = pg(ctx).get().await?
            .query(
                "SELECT al.analysis_id::text, p.name, p.site_name,
                        p.price::float8, al.verdict, al.explanation,
                        al.user_action, al.created_at::text
                 FROM analysis_log al JOIN products p ON p.product_id = al.product_id
                 WHERE al.user_id::text = $1
                 ORDER BY al.created_at DESC
                 LIMIT $2 OFFSET $3",
                &[&uid, &(limit.unwrap_or(50) as i64), &(offset.unwrap_or(0) as i64)],
            )
            .await?;
        Ok(rows.iter().map(AnalysisLog::from_row).collect())
    }

    async fn seller_dashboard(&self, ctx: &Context<'_>) -> Result<Option<SellerDashboard>> {
        let Some(uid) = user_id(ctx) else { return Ok(None) };
        let row = pg(ctx).get().await?
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
        Ok(row.map(SellerDashboard::from_row))
    }

    async fn seller_finances(&self, ctx: &Context<'_>, limit: Option<i32>) -> Result<Vec<FinanceEntry>> {
        let Some(uid) = user_id(ctx) else { return Ok(vec![]) };
        let rows = pg(ctx).get().await?
            .query(
                "SELECT entry_id::text, entry_type, amount::float8, category, description, transaction_date::text, created_at::text
                 FROM seller_finances WHERE user_id::text = $1
                 ORDER BY transaction_date DESC, created_at DESC LIMIT $2",
                &[&uid, &(limit.unwrap_or(50) as i64)],
            )
            .await?;
        Ok(rows.iter().map(FinanceEntry::from_row).collect())
    }

    async fn seller_series(&self, ctx: &Context<'_>, months: Option<i32>) -> Result<Vec<SellerSeriesPoint>> {
        let Some(uid) = user_id(ctx) else { return Ok(vec![]) };
        let n = months.unwrap_or(6);
        let rows = pg(ctx).get().await?
            .query(
                "SELECT to_char(d, 'Mon') AS month,
                        COALESCE(SUM(sf.amount) FILTER (WHERE sf.entry_type = 'revenue'), 0)::float8 AS income,
                        COALESCE(SUM(sf.amount) FILTER (WHERE sf.entry_type IN ('expense','cogs','salary','rent','other')), 0)::float8 AS expenses
                 FROM generate_series(date_trunc('month', now()) - ($1::int - 1) * interval '1 month', date_trunc('month', now()), interval '1 month') AS d
                 LEFT JOIN seller_finances sf
                    ON sf.user_id::text = $2 AND date_trunc('month', sf.transaction_date) = d
                 GROUP BY d ORDER BY d",
                &[&n, &uid],
            )
            .await?;
        Ok(rows.iter().map(SellerSeriesPoint::from_row).collect())
    }

    async fn seller_categories(&self, ctx: &Context<'_>, entry_type: String) -> Result<Vec<SellerCategory>> {
        let Some(uid) = user_id(ctx) else { return Ok(vec![]) };
        let rows = pg(ctx).get().await?
            .query(
                "SELECT COALESCE(category, 'Other') AS name, COALESCE(SUM(amount), 0)::float8 AS spent
                 FROM seller_finances
                 WHERE user_id::text = $1
                   AND ($2 = 'revenue' AND entry_type = 'revenue' OR $2 <> 'revenue' AND entry_type IN ('expense','cogs','salary','rent','other'))
                   AND transaction_date >= date_trunc('month', now())
                 GROUP BY 1 ORDER BY spent DESC",
                &[&uid, &entry_type],
            )
            .await?;
        Ok(rows.iter().map(|r| SellerCategory { name: r.get(0), spent: r.get(1) }).collect())
    }

    async fn seller_inventory(&self, ctx: &Context<'_>) -> Result<Vec<SellerInventoryItem>> {
        let Some(uid) = user_id(ctx) else { return Ok(vec![]) };
        let rows = pg(ctx).get().await?
            .query(
                "SELECT item_id::text, sku, name, stock, reorder_level, unit_cost::float8
                 FROM seller_inventory WHERE user_id::text = $1 ORDER BY name",
                &[&uid],
            )
            .await?;
        Ok(rows.iter().map(SellerInventoryItem::from_row).collect())
    }

    async fn budget_alerts(&self, ctx: &Context<'_>, unread_only: Option<bool>) -> Result<Vec<BudgetAlert>> {
        let Some(uid) = user_id(ctx) else { return Ok(vec![]) };
        generate_alerts(&uid, pg(ctx)).await?;
        let rows = pg(ctx).get().await?
            .query(
                "SELECT alert_id::text, alert_type, message, channel, is_read, created_at::text
                 FROM budget_alerts WHERE user_id::text = $1
                    AND ($2::bool IS NOT TRUE OR is_read = FALSE)
                 ORDER BY created_at DESC LIMIT 50",
                &[&uid, &unread_only.unwrap_or(false)],
            )
            .await?;
        Ok(rows.iter().map(BudgetAlert::from_row).collect())
    }

    async fn financial_health_score(&self, ctx: &Context<'_>) -> Result<Option<FinancialHealthScore>> {
        let Some(uid) = user_id(ctx) else { return Ok(None) };
        let row = pg(ctx).get().await?
            .query_opt(
                "SELECT u.monthly_tab_limit::float8,
                        (SELECT COALESCE(ba.balance, u.wallet_balance) FROM bank_accounts ba
                         WHERE ba.user_id = u.user_id
                         ORDER BY ba.is_primary DESC, ba.created_at DESC LIMIT 1)::float8 AS wallet,
                        u.coach_adherence_score::float8,
                        COALESCE(SUM(l.amount), 0)::float8 AS spent,
                        (SELECT EXTRACT(EPOCH FROM MAX(ba.last_sync_at)) FROM bank_accounts ba WHERE ba.user_id = u.user_id)::float8 AS last_sync
                 FROM users u
                 LEFT JOIN ledger_entries l ON l.user_id = u.user_id
                    AND l.account_type = 'budget'
                    AND l.created_at >= date_trunc('month', now())
                 WHERE u.user_id::text = $1
                 GROUP BY u.user_id",
                &[&uid],
            )
            .await?;
        let Some(row) = row else { return Ok(None) };
        let limit: f64 = row.get(0);
        let wallet: f64 = row.get(1);
        let adherence: f64 = row.get(2);
        let spent: f64 = row.get(3);
        let last_sync: Option<f64> = row.get(4);

        let mut factors: Vec<HealthFactor> = vec![];
        let mut score: i32 = 750;

        let ratio = if limit > 0.0 { spent / limit } else { 0.0 };
        if ratio < 0.5 {
            score += 40;
            factors.push(HealthFactor { key: "tab_utilization".into(), impact: "positive".into(), detail: format!("Using {:.0}% of monthly tab — healthy headroom", ratio * 100.0) });
        } else if ratio >= 0.95 {
            score -= 120;
            factors.push(HealthFactor { key: "tab_utilization".into(), impact: "negative".into(), detail: format!("{:.0}% of monthly tab consumed", ratio * 100.0) });
        } else if ratio >= 0.8 {
            score -= 60;
            factors.push(HealthFactor { key: "tab_utilization".into(), impact: "negative".into(), detail: format!("{:.0}% of monthly tab consumed", ratio * 100.0) });
        } else {
            factors.push(HealthFactor { key: "tab_utilization".into(), impact: "neutral".into(), detail: format!("{:.0}% of monthly tab consumed", ratio * 100.0) });
        }

        if wallet >= 2.0 * limit {
            score += 30;
            factors.push(HealthFactor { key: "wallet_buffer".into(), impact: "positive".into(), detail: "Wallet covers 2 months of tab limit".into() });
        } else if wallet < 0.5 * limit {
            score -= 40;
            factors.push(HealthFactor { key: "wallet_buffer".into(), impact: "negative".into(), detail: "Wallet below half of monthly tab limit".into() });
        } else {
            factors.push(HealthFactor { key: "wallet_buffer".into(), impact: "neutral".into(), detail: "Wallet buffer is adequate".into() });
        }

        if adherence >= 80.0 {
            score += 30;
            factors.push(HealthFactor { key: "coach_adherence".into(), impact: "positive".into(), detail: "High adherence to coach recommendations".into() });
        } else if adherence >= 50.0 {
            factors.push(HealthFactor { key: "coach_adherence".into(), impact: "neutral".into(), detail: "Moderate adherence to coach recommendations".into() });
        } else {
            score -= 30;
            factors.push(HealthFactor { key: "coach_adherence".into(), impact: "negative".into(), detail: "Low adherence to coach recommendations".into() });
        }

        let stale = last_sync.map(|ts| ts > 0.0 && chrono_since_days(ts) > 30.0).unwrap_or(false);
        if stale {
            score -= 20;
            factors.push(HealthFactor { key: "bank_data_freshness".into(), impact: "negative".into(), detail: "Bank data older than 30 days — re-sync".into() });
        }

        let score = score.clamp(300, 850);
        let factors_json = serde_json::json!(factors.iter().map(|f| {
            serde_json::json!({"key": f.key, "impact": f.impact, "detail": f.detail})
        }).collect::<Vec<_>>());
        let out = pg(ctx).get().await?
            .query_one(
                "INSERT INTO financial_health_scores (user_id, score, factors)
                 VALUES ($1::text::uuid, $2, $3::text::jsonb)
                 RETURNING calculated_at::text",
                &[&uid, &score, &factors_json.to_string()],
            )
            .await?;
        Ok(Some(FinancialHealthScore {
            score,
            factors,
            calculated_at: out.get(0),
        }))
    }

    async fn affordability_check(&self, ctx: &Context<'_>, product_price: f64) -> Result<Option<AffordabilityCheck>> {
        let row = match user_id(ctx) {
            Some(uid) => pg(ctx).get().await?
                .query_opt(
                    "SELECT u.monthly_tab_limit::float8, u.annual_deferred_limit::float8,
                            COALESCE(SUM(l.amount), 0)::float8 AS spent
                     FROM users u
                     LEFT JOIN ledger_entries l ON l.user_id = u.user_id
                        AND l.account_type = 'budget'
                        AND l.created_at >= date_trunc('month', now())
                     WHERE u.user_id::text = $1
                     GROUP BY u.user_id",
                    &[&uid],
                )
                .await?,
            // Anonymous coach check: default limits, zero spending.
            None => {
                let tab = 600.0;
                let deferred = 2500.0;
                let total = tab + deferred;
                let (verdict, reason) = if product_price <= tab {
                    ("buy".to_string(), format!("Price fits within your monthly tab remaining of ₹{tab:.0}"))
                } else if product_price <= total {
                    ("watch".to_string(), format!("Exceeds monthly tab (₹{tab:.0} left) but within deferred credit of ₹{deferred:.0} — consider delaying a month"))
                } else {
                    ("wait".to_string(), format!("Above your total available credit of ₹{total:.0} — defer this purchase"))
                };
                return Ok(Some(AffordabilityCheck {
                    verdict,
                    reason,
                    tab_remaining: tab,
                    deferred_remaining: deferred,
                }));
            }
        };
        let Some(row) = row else { return Ok(None) };
        let tab_remaining = (row.get::<_, f64>(0) - row.get::<_, f64>(2)).max(0.0);
        let deferred_remaining: f64 = row.get(1);
        let total_remaining = tab_remaining + deferred_remaining;
        let (verdict, reason) = if product_price <= tab_remaining {
            ("buy".to_string(), format!("Price fits within your monthly tab remaining of ₹{tab_remaining:.0}"))
        } else if product_price <= total_remaining {
            ("watch".to_string(), format!("Exceeds monthly tab (₹{tab_remaining:.0} left) but within deferred credit of ₹{deferred_remaining:.0} — consider delaying a month"))
        } else {
            ("wait".to_string(), format!("Above your total available credit of ₹{total_remaining:.0} — defer this purchase"))
        };
        Ok(Some(AffordabilityCheck {
            verdict,
            reason,
            tab_remaining,
            deferred_remaining,
        }))
    }

    #[graphql(name = "budgetSuggestions")]
    async fn budget_suggestions(&self, ctx: &Context<'_>, limit: Option<i32>) -> Result<Vec<BudgetSuggestion>> {
        let Some(uid) = user_id(ctx) else { return Ok(vec![]) };
        let rows = pg(ctx).get().await?
            .query(
                "SELECT suggested_limit::float8, reasoning, spent::float8, wallet_balance::float8, created_at::text
                 FROM budget_suggestions
                 WHERE user_id::text = $1
                 ORDER BY created_at DESC
                 LIMIT $2",
                &[&uid, &(limit.unwrap_or(10) as i64)],
            )
            .await?;
        Ok(rows.iter().map(BudgetSuggestion::from_row).collect())
    }
}

fn chrono_since_days(unix_seconds: f64) -> f64 {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs_f64())
        .unwrap_or(0.0);
    ((now - unix_seconds) / 86400.0).max(0.0)
}

async fn generate_alerts(uid: &str, pool: &deadpool_postgres::Pool) -> Result<()> {
    let client = pool.get().await?;
    let row = client
        .query_opt(
            "SELECT u.monthly_tab_limit::float8,
                    COALESCE(SUM(l.amount), 0)::float8 AS spent,
                    EXTRACT(DAY FROM now())::float8 AS day_of_month,
                    (SELECT EXTRACT(EPOCH FROM MAX(ba.last_sync_at)) FROM bank_accounts ba WHERE ba.user_id = u.user_id)::float8 AS last_sync
             FROM users u
             LEFT JOIN ledger_entries l ON l.user_id = u.user_id
                AND l.account_type = 'budget'
                AND l.created_at >= date_trunc('month', now())
             WHERE u.user_id::text = $1
             GROUP BY u.user_id",
            &[&uid],
        )
        .await?;
    let Some(row) = row else { return Ok(()) };
    let limit: f64 = row.get(0);
    let spent: f64 = row.get(1);
    let day_of_month: f64 = row.get(2);
    let last_sync: Option<f64> = row.get(3);

    let mut alerts: Vec<(String, String, &str)> = vec![];
    let ratio = if limit > 0.0 { spent / limit } else { 0.0 };
    if ratio >= 0.95 {
        alerts.push((
            "BUDGET_EXHAUSTION".into(),
            format!("You've used {:.0}% of your monthly tab limit. Only ₹{:.0} remaining.", ratio * 100.0, limit - spent),
            "dashboard",
        ));
    } else if ratio >= 0.80 {
        alerts.push((
            "BUDGET_EXHAUSTION".into(),
            format!("You've used {:.0}% of your monthly tab limit. ₹{:.0} remaining.", ratio * 100.0, limit - spent),
            "extension",
        ));
    }

    let days = day_of_month.max(1.0);
    let daily_avg = spent / days;
    let baseline = if limit > 0.0 { limit / 30.0 } else { 0.0 };
    if baseline > 0.0 && daily_avg > baseline * 1.25 {
        alerts.push((
            "OVERSPEND_RISK".into(),
            format!("Spending pace is {:.0}% above your norm — on track to exceed budget.", (daily_avg / baseline - 1.0) * 100.0),
            "dashboard",
        ));
    }

    let stale = last_sync.map(|ts| ts > 0.0 && chrono_since_days(ts) > 30.0).unwrap_or(false);
    if stale {
        alerts.push((
            "STALE_BANK_DATA".into(),
            "Last bank sync is older than 30 days — re-sync for accurate advice".into(),
            "dashboard",
        ));
    }

    for (alert_type, message, channel) in alerts {
        let existing = client
            .query_opt(
                "SELECT 1 FROM budget_alerts
                 WHERE user_id::text = $1 AND alert_type = $2 AND is_read = FALSE
                 LIMIT 1",
                &[&uid, &alert_type],
            )
            .await?;
        if existing.is_some() { continue; }
        client
            .execute(
                "INSERT INTO budget_alerts (user_id, alert_type, message, channel)
                 VALUES ($1::text::uuid, $2, $3, $4)",
                &[&uid, &alert_type, &message, &channel],
            )
            .await?;
    }
    Ok(())
}

#[Object]
impl MutationRoot {
    async fn upsert_google_user(&self, ctx: &Context<'_>, email: String, full_name: String, avatar_url: String) -> Result<Option<UpsertedUser>> {
        if !email.contains('@') {
            return Err("invalid email".into());
        }
        let row = pg(ctx).get().await?
            .query_opt(
                "INSERT INTO users (email, full_name, avatar_url, oauth_provider)
                 VALUES ($1, $2, $3, 'google')
                 ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, avatar_url = EXCLUDED.avatar_url
                 RETURNING user_id::text, (xmax = 0) AS created",
                &[&email, &full_name, &avatar_url],
            )
            .await?;
        Ok(row.map(|r| UpsertedUser { user_id: r.get(0), created: r.get(1) }))
    }

    async fn delete_user(&self, ctx: &Context<'_>) -> Result<bool> {
        let Some(uid) = user_id(ctx) else { return Err("not authenticated".into()) };
        let mut conn = pg(ctx).get().await?;
        let mut tx = conn.transaction().await?;
        for t in USER_CHILD_TABLES {
            tx.execute(
                &format!("DELETE FROM {t} WHERE user_id::text = $1"),
                &[&uid],
            )
            .await?;
        }
        tx.execute("DELETE FROM users WHERE user_id::text = $1", &[&uid])
            .await?;
        tx.commit().await?;
        tokio::spawn(purge_supermemory(uid));
        Ok(true)
    }

    async fn signup(&self, ctx: &Context<'_>, email: String, full_name: String, password: String) -> Result<Option<String>> {
        if !email.contains('@') || password.len() < 8 {
            return Err("invalid email or password (min 8 chars)".into());
        }
        let salt = SaltString::generate(&mut OsRng);
        let hash = Argon2::default()
            .hash_password(password.as_bytes(), &salt)
            .map_err(|e| e.to_string())?
            .to_string();
        let row = pg(ctx).get().await?
            .query_opt(
                "INSERT INTO users (email, full_name, oauth_provider, password_hash)
                 VALUES ($1, $2, 'password', $3)
                 ON CONFLICT (email) DO NOTHING RETURNING user_id::text",
                &[&email, &full_name, &hash],
            )
            .await?;
        Ok(row.map(|r| r.get(0)))
    }

    async fn login(&self, ctx: &Context<'_>, email: String, password: String) -> Result<Option<AuthUser>> {
        let row = pg(ctx).get().await?
            .query_opt(
                "SELECT user_id::text, password_hash, full_name, avatar_url
                 FROM users WHERE email = $1 AND oauth_provider = 'password' AND password_hash IS NOT NULL",
                &[&email],
            )
            .await?;
        let Some(row) = row else { return Ok(None) };
        let hash: String = row.get(1);
        let parsed = PasswordHash::new(&hash).map_err(|e| e.to_string())?;
        if Argon2::default().verify_password(password.as_bytes(), &parsed).is_err() {
            return Ok(None);
        }
        Ok(Some(AuthUser {
            user_id: row.get(0),
            full_name: row.get(2),
            avatar_url: row.get(3),
        }))
    }

    async fn set_monthly_tab_limit(&self, ctx: &Context<'_>, limit: f64) -> Result<MonthlyTab> {
        let Some(uid) = user_id(ctx) else { return Err("not authenticated".into()) };
        let row = pg(ctx).get().await?
            .query_one(
                "UPDATE users SET monthly_tab_limit = $2::text::numeric WHERE user_id::text = $1
                 RETURNING monthly_tab_limit::float8, annual_deferred_limit::float8",
                &[&uid, &limit.to_string()],
            )
            .await?;
        Ok(MonthlyTab {
            limit: row.get(0),
            spent: 0.0,
        })
    }

    async fn update_financial_profile(
        &self, ctx: &Context<'_>,
        monthly_income: Option<f64>,
        monthly_spend: Option<f64>,
        investment_pct: Option<f64>,
        housing_cost: Option<f64>,
        dependents: Option<i32>,
        debt_emis: Option<f64>,
        monthly_tax: Option<f64>,
    ) -> Result<User> {
        let Some(uid) = user_id(ctx) else { return Err("not authenticated".into()) };
        let row = pg(ctx).get().await?
            .query_one(
                "UPDATE users SET
                    monthly_income = COALESCE($2::text::numeric, monthly_income),
                    monthly_spend = COALESCE($3::text::numeric, monthly_spend),
                    investment_pct = COALESCE($4::text::numeric, investment_pct),
                    housing_cost = COALESCE($5::text::numeric, housing_cost),
                    dependents = COALESCE($6::int, dependents),
                    debt_emis = COALESCE($7::text::numeric, debt_emis),
                    monthly_tax = COALESCE($8::text::numeric, monthly_tax)
                 WHERE user_id::text = $1
                 RETURNING user_id::text, email, full_name, avatar_url, user_type,
                           wallet_balance::float8, monthly_tab_limit::float8,
                           annual_deferred_limit::float8, financial_health_score,
                           coach_adherence_score::float8,
                           monthly_income::float8, monthly_spend::float8,
                           investment_pct::float8, housing_cost::float8,
                           dependents, debt_emis::float8,
                           monthly_tax::float8, ai_model, business_name",
                &[
                    &uid,
                    &monthly_income.map(|v| v.to_string()),
                    &monthly_spend.map(|v| v.to_string()),
                    &investment_pct.map(|v| v.to_string()),
                    &housing_cost.map(|v| v.to_string()),
                    &dependents,
                    &debt_emis.map(|v| v.to_string()),
                    &monthly_tax.map(|v| v.to_string()),
                ],
            )
            .await?;
        Ok(User::from_row(row))
    }

    async fn set_ai_model(&self, ctx: &Context<'_>, model: String) -> Result<User> {
        let Some(uid) = user_id(ctx) else { return Err("not authenticated".into()) };
        let row = pg(ctx).get().await?
            .query_one(
                "UPDATE users SET ai_model = $2 WHERE user_id::text = $1
                 RETURNING user_id::text, email, full_name, avatar_url, user_type,
                           wallet_balance::float8, monthly_tab_limit::float8,
                           annual_deferred_limit::float8, financial_health_score,
                           coach_adherence_score::float8,
                           monthly_income::float8, monthly_spend::float8,
                           investment_pct::float8, housing_cost::float8,
                           dependents, debt_emis::float8,
                           monthly_tax::float8, ai_model, business_name",
                &[&uid, &model],
            )
            .await?;
        Ok(User::from_row(row))
    }

    async fn refresh_coach_insights(&self, ctx: &Context<'_>, role: String) -> Result<Vec<crate::insights::Insight>> {
        let Some(uid) = user_id(ctx) else { return Err("not authenticated".into()) };
        let state = ctx.data_unchecked::<Arc<AppState>>();
        crate::insights::refresh(state, &uid, &role).await
    }

    async fn update_user_type(
        &self, ctx: &Context<'_>,
        user_type: String,
        business_name: Option<String>,
    ) -> Result<User> {
        let Some(uid) = user_id(ctx) else { return Err("not authenticated".into()) };
        let row = pg(ctx).get().await?
            .query_one(
                "UPDATE users SET user_type = $2, business_name = COALESCE($3, business_name)
                 WHERE user_id::text = $1
                 RETURNING user_id::text, email, full_name, avatar_url, user_type,
                           wallet_balance::float8, monthly_tab_limit::float8,
                           annual_deferred_limit::float8, financial_health_score,
                           coach_adherence_score::float8,
                           monthly_income::float8, monthly_spend::float8,
                           investment_pct::float8, housing_cost::float8,
                           dependents, debt_emis::float8,
                           monthly_tax::float8, ai_model, business_name",
                &[&uid, &user_type, &business_name],
            )
            .await?;
        Ok(User::from_row(row))
    }

    async fn add_finance_entry(&self, ctx: &Context<'_>, input: FinanceEntryInput) -> Result<FinanceEntry> {
        let Some(uid) = user_id(ctx) else { return Err("not authenticated".into()) };
        let row = pg(ctx).get().await?
            .query_one(
                "INSERT INTO seller_finances (user_id, entry_type, amount, category, description, transaction_date)
                 VALUES ($1::text::uuid, $2, $3::text::numeric, $4, $5, $6::text::date)
                 RETURNING entry_id::text, entry_type, amount::float8, category, description, transaction_date::text, created_at::text",
                &[&uid, &input.entry_type, &input.amount.to_string(), &input.category, &input.description, &input.transaction_date],
            )
            .await?;
        Ok(FinanceEntry::from_row(&row))
    }

    async fn delete_finance_entry(&self, ctx: &Context<'_>, entry_id: String) -> Result<bool> {
        let Some(uid) = user_id(ctx) else { return Err("not authenticated".into()) };
        let rows = pg(ctx).get().await?
            .execute(
                "DELETE FROM seller_finances WHERE entry_id::text = $1 AND user_id::text = $2",
                &[&entry_id, &uid],
            )
            .await?;
        Ok(rows > 0)
    }

    async fn add_inventory_item(
        &self,
        ctx: &Context<'_>,
        sku: String,
        name: String,
        stock: i32,
        reorder_level: i32,
        unit_cost: f64,
    ) -> Result<SellerInventoryItem> {
        let Some(uid) = user_id(ctx) else { return Err("not authenticated".into()) };
        let row = pg(ctx).get().await?
            .query_one(
                "INSERT INTO seller_inventory (user_id, sku, name, stock, reorder_level, unit_cost)
                 VALUES ($1::text::uuid, $2, $3, $4, $5, $6::text::numeric)
                 RETURNING item_id::text, sku, name, stock, reorder_level, unit_cost::float8",
                &[&uid, &sku, &name, &stock, &reorder_level, &unit_cost.to_string()],
            )
            .await?;
        Ok(SellerInventoryItem::from_row(&row))
    }

    async fn update_inventory_item(
        &self,
        ctx: &Context<'_>,
        item_id: String,
        stock: Option<i32>,
        reorder_level: Option<i32>,
        unit_cost: Option<f64>,
        name: Option<String>,
        sku: Option<String>,
    ) -> Result<Option<SellerInventoryItem>> {
        let Some(uid) = user_id(ctx) else { return Err("not authenticated".into()) };
        let row = pg(ctx).get().await?
            .query_opt(
                "UPDATE seller_inventory SET
                    stock = COALESCE($3::int, stock),
                    reorder_level = COALESCE($4::int, reorder_level),
                    unit_cost = COALESCE($5::text::numeric, unit_cost),
                    name = COALESCE($6, name),
                    sku = COALESCE($7, sku)
                 WHERE item_id::text = $1 AND user_id::text = $2
                 RETURNING item_id::text, sku, name, stock, reorder_level, unit_cost::float8",
                &[
                    &item_id,
                    &uid,
                    &stock,
                    &reorder_level,
                    &unit_cost.map(|v| v.to_string()),
                    &name,
                    &sku,
                ],
            )
            .await?;
        Ok(row.map(|r| SellerInventoryItem::from_row(&r)))
    }

    async fn delete_inventory_item(&self, ctx: &Context<'_>, item_id: String) -> Result<bool> {
        let Some(uid) = user_id(ctx) else { return Err("not authenticated".into()) };
        let rows = pg(ctx).get().await?
            .execute(
                "DELETE FROM seller_inventory WHERE item_id::text = $1 AND user_id::text = $2",
                &[&item_id, &uid],
            )
            .await?;
        Ok(rows > 0)
    }

    async fn add_ledger_entries(
        &self,
        ctx: &Context<'_>,
        entries: Vec<LedgerEntryInput>,
        balance: Option<f64>,
        bank_name: Option<String>,
        mobile_number: Option<String>,
        primary: Option<bool>,
    ) -> Result<SyncResult> {
        let Some(uid) = user_id(ctx) else { return Err("not authenticated".into()) };
        let mut conn = pg(ctx).get().await?;
        let tx = conn.transaction().await?;
        let mut account_id: Option<String> = None;
        if let Some(name) = &bank_name {
            tx.execute(
                "INSERT INTO banks (name, whatsapp_number) VALUES ($1, '') ON CONFLICT (name) DO NOTHING",
                &[name],
            )
            .await?;
            let bank_id: String = tx
                .query_one("SELECT bank_id::text FROM banks WHERE name = $1", &[name])
                .await?
                .get(0);
            account_id = tx
                .query_opt(
                    "SELECT account_id::text FROM bank_accounts WHERE user_id::text = $1 AND bank_id::text = $2 ORDER BY is_primary DESC, created_at DESC LIMIT 1",
                    &[&uid, &bank_id],
                )
                .await?
                .map(|r| r.get(0));
            if account_id.is_none() {
                account_id = tx
                    .query_one(
                        "INSERT INTO bank_accounts (account_id, user_id, bank_id, mobile_number)
                         VALUES (gen_random_uuid(), $1::text::uuid, $2::text::uuid, $3) RETURNING account_id::text",
                        &[&uid, &bank_id, &mobile_number],
                    )
                    .await
                    .map(|r| r.get(0))
                    .ok();
            }
        }
        if primary == Some(true) {
            if let Some(acc) = &account_id {
                tx.execute(
                    "UPDATE bank_accounts SET is_primary = (account_id::text = $2) WHERE user_id::text = $1",
                    &[&uid, acc],
                )
                .await?;
            }
        }
        let mut inserted = 0u64;
        for e in &entries {
            let key = uuid::Uuid::new_v5(
                &uuid::Uuid::NAMESPACE_OID,
                format!("{uid}|{}|{}", e.transaction_type, e.amount).as_bytes(),
            )
            .to_string();
            let res = tx
                .execute(
                    "INSERT INTO ledger_entries (user_id, account_type, transaction_type, amount, idempotency_key)
                     VALUES ($1::text::uuid, 'budget', $2, $3::text::numeric, $4)
                     ON CONFLICT (idempotency_key) DO NOTHING",
                    &[&uid, &e.transaction_type, &e.amount.to_string(), &key],
                )
                .await?;
            inserted += res;
        }
        let synced_balance = if let Some(bal) = balance {
            tx.execute(
                "UPDATE bank_accounts SET balance = $2::text::numeric, last_sync_at = now()
                 WHERE account_id = (SELECT account_id FROM bank_accounts WHERE user_id::text = $1 ORDER BY is_primary DESC, created_at DESC LIMIT 1)",
                &[&uid, &bal.to_string()],
            )
            .await?;
            Some(bal)
        } else {
            None
        };
        tx.commit().await?;
        Ok(SyncResult {
            inserted: inserted as i32,
            balance: synced_balance,
            account_id,
        })
    }

    async fn save_budget_suggestion(
        &self,
        ctx: &Context<'_>,
        suggested_limit: f64,
        reasoning: String,
        spent: Option<f64>,
        wallet_balance: Option<f64>,
    ) -> Result<BudgetSuggestion> {
        let Some(uid) = user_id(ctx) else { return Err("not authenticated".into()) };
        let row = pg(ctx).get().await?
            .query_one(
                "INSERT INTO budget_suggestions (user_id, suggested_limit, reasoning, spent, wallet_balance)
                 VALUES ($1::text::uuid, $2::text::numeric, $3, $4::text::numeric, $5::text::numeric)
                 RETURNING suggested_limit::float8, reasoning, spent::float8, wallet_balance::float8, created_at::text",
                &[
                    &uid,
                    &suggested_limit.to_string(),
                    &reasoning,
                    &spent.map(|v| v.to_string()),
                    &wallet_balance.map(|v| v.to_string()),
                ],
            )
            .await?;
        Ok(BudgetSuggestion::from_row(&row))
    }
}

struct User {
    id: String,
    email: String,
    full_name: String,
    avatar_url: Option<String>,
    user_type: String,
    wallet_balance: f64,
    monthly_tab_limit: f64,
    annual_deferred_limit: f64,
    financial_health_score: i32,
    coach_adherence_score: f64,
    monthly_income: Option<f64>,
    monthly_spend: Option<f64>,
    investment_pct: Option<f64>,
    housing_cost: Option<f64>,
    dependents: Option<i32>,
    debt_emis: Option<f64>,
    monthly_tax: Option<f64>,
    ai_model: Option<String>,
    business_name: Option<String>,
}

#[Object]
impl User {
    async fn id(&self) -> &str { &self.id }
    async fn email(&self) -> &str { &self.email }
    async fn full_name(&self) -> &str { &self.full_name }
    async fn avatar_url(&self) -> Option<&str> { self.avatar_url.as_deref() }
    async fn user_type(&self) -> &str { &self.user_type }
    async fn wallet_balance(&self) -> f64 { self.wallet_balance }
    async fn monthly_tab_limit(&self) -> f64 { self.monthly_tab_limit }
    async fn annual_deferred_limit(&self) -> f64 { self.annual_deferred_limit }
    async fn financial_health_score(&self) -> i32 { self.financial_health_score }
    async fn coach_adherence_score(&self) -> f64 { self.coach_adherence_score }
    async fn monthly_income(&self) -> Option<f64> { self.monthly_income }
    async fn monthly_spend(&self) -> Option<f64> { self.monthly_spend }
    async fn investment_pct(&self) -> Option<f64> { self.investment_pct }
    async fn housing_cost(&self) -> Option<f64> { self.housing_cost }
    async fn dependents(&self) -> Option<i32> { self.dependents }
    async fn debt_emis(&self) -> Option<f64> { self.debt_emis }
    async fn monthly_tax(&self) -> Option<f64> { self.monthly_tax }
    async fn ai_model(&self) -> Option<&str> { self.ai_model.as_deref() }
    async fn business_name(&self) -> Option<&str> { self.business_name.as_deref() }
}

struct AuthUser {
    user_id: String,
    full_name: String,
    avatar_url: Option<String>,
}

#[Object]
impl AuthUser {
    async fn user_id(&self) -> &str { &self.user_id }
    async fn full_name(&self) -> &str { &self.full_name }
    async fn avatar_url(&self) -> Option<&str> { self.avatar_url.as_deref() }
}

struct UpsertedUser {
    user_id: String,
    created: bool,
}

#[Object]
impl UpsertedUser {
    async fn user_id(&self) -> &str { &self.user_id }
    async fn created(&self) -> bool { self.created }
}

impl User {
    fn from_row(r: tokio_postgres::Row) -> Self {
        Self {
            id: r.get(0),
            email: r.get(1),
            full_name: r.get(2),
            avatar_url: r.get(3),
            user_type: r.get(4),
            wallet_balance: r.get(5),
            monthly_tab_limit: r.get(6),
            annual_deferred_limit: r.get(7),
            financial_health_score: r.get(8),
            coach_adherence_score: r.get(9),
            monthly_income: r.get(10),
            monthly_spend: r.get(11),
            investment_pct: r.get(12),
            housing_cost: r.get(13),
            dependents: r.get(14),
            debt_emis: r.get(15),
            monthly_tax: r.get(16),
            ai_model: r.get(17),
            business_name: r.get(18),
        }
    }
}

struct Wallet {
    balance: f64,
    tab_limit: f64,
    deferred_limit: f64,
}

#[Object]
impl Wallet {
    async fn balance(&self) -> f64 { self.balance }
    async fn tab_limit(&self) -> f64 { self.tab_limit }
    async fn deferred_limit(&self) -> f64 { self.deferred_limit }
}

impl Wallet {
    fn from_row(r: tokio_postgres::Row) -> Self {
        Self { balance: r.get(0), tab_limit: r.get(1), deferred_limit: r.get(2) }
    }
}

struct MonthlyTab {
    limit: f64,
    spent: f64,
}

#[Object]
impl MonthlyTab {
    async fn limit(&self) -> f64 { self.limit }
    async fn spent(&self) -> f64 { self.spent }
}

struct SpendingDay {
    day: String,
    spend: f64,
}

#[Object]
impl SpendingDay {
    async fn day(&self) -> &str { &self.day }
    async fn spend(&self) -> f64 { self.spend }
}

struct BankAccount {
    account_id: String,
    bank_name: String,
    mobile_number: Option<String>,
    account_type: Option<String>,
    balance: Option<f64>,
    last_sync_at: Option<String>,
    is_primary: bool,
}

#[Object]
impl BankAccount {
    async fn account_id(&self) -> &str { &self.account_id }
    async fn bank_name(&self) -> &str { &self.bank_name }
    async fn mobile_number(&self) -> Option<&str> { self.mobile_number.as_deref() }
    async fn account_type(&self) -> Option<&str> { self.account_type.as_deref() }
    async fn balance(&self) -> Option<f64> { self.balance }
    async fn last_sync_at(&self) -> Option<&str> { self.last_sync_at.as_deref() }
    async fn is_primary(&self) -> bool { self.is_primary }
}

impl BankAccount {
    fn from_row(r: &tokio_postgres::Row) -> Self {
        Self {
            account_id: r.get(0),
            bank_name: r.get(1),
            mobile_number: r.get(2),
            account_type: r.get(3),
            balance: r.get(4),
            last_sync_at: r.get(5),
            is_primary: r.get(6),
        }
    }
}

struct Bank {
    name: String,
    whatsapp_number: String,
}

#[Object]
impl Bank {
    async fn name(&self) -> &str { &self.name }
    async fn whatsapp_number(&self) -> &str { &self.whatsapp_number }
}

impl Bank {
    fn from_row(r: &tokio_postgres::Row) -> Self {
        Self {
            name: r.get(0),
            whatsapp_number: r.get(1),
        }
    }
}

struct AnalysisLog {
    analysis_id: String,
    product_name: String,
    site_name: String,
    price: f64,
    verdict: String,
    explanation: Option<String>,
    user_action: Option<String>,
    created_at: String,
}

#[Object]
impl AnalysisLog {
    async fn analysis_id(&self) -> &str { &self.analysis_id }
    async fn product_name(&self) -> &str { &self.product_name }
    async fn site_name(&self) -> &str { &self.site_name }
    async fn price(&self) -> f64 { self.price }
    async fn verdict(&self) -> &str { &self.verdict }
    async fn explanation(&self) -> Option<&str> { self.explanation.as_deref() }
    async fn user_action(&self) -> Option<&str> { self.user_action.as_deref() }
    async fn created_at(&self) -> &str { &self.created_at }
}

impl AnalysisLog {
    fn from_row(r: &tokio_postgres::Row) -> Self {
        Self {
            analysis_id: r.get(0),
            product_name: r.get(1),
            site_name: r.get(2),
            price: r.get(3),
            verdict: r.get(4),
            explanation: r.get(5),
            user_action: r.get(6),
            created_at: r.get(7),
        }
    }
}

struct BudgetSuggestion {
    suggested_limit: f64,
    reasoning: String,
    spent: Option<f64>,
    wallet_balance: Option<f64>,
    created_at: String,
}

#[Object]
impl BudgetSuggestion {
    async fn suggested_limit(&self) -> f64 { self.suggested_limit }
    async fn reasoning(&self) -> &str { &self.reasoning }
    async fn spent(&self) -> Option<f64> { self.spent }
    async fn wallet_balance(&self) -> Option<f64> { self.wallet_balance }
    async fn created_at(&self) -> &str { &self.created_at }
}

impl BudgetSuggestion {
    fn from_row(r: &tokio_postgres::Row) -> Self {
        Self {
            suggested_limit: r.get(0),
            reasoning: r.get(1),
            spent: r.get(2),
            wallet_balance: r.get(3),
            created_at: r.get(4),
        }
    }
}

struct SellerDashboard {
    revenue: f64,
    expenses: f64,
    cash_on_hand: f64,
    last_month_revenue: f64,
    last_month_expenses: f64,
}

#[Object]
impl SellerDashboard {
    async fn revenue(&self) -> f64 { self.revenue }
    async fn expenses(&self) -> f64 { self.expenses }
    async fn profit_margin(&self) -> f64 {
        if self.revenue == 0.0 { 0.0 } else { ((self.revenue - self.expenses) / self.revenue) * 100.0 }
    }
    async fn cash_on_hand(&self) -> f64 { self.cash_on_hand }
    async fn last_month_revenue(&self) -> f64 { self.last_month_revenue }
    async fn last_month_expenses(&self) -> f64 { self.last_month_expenses }
}

impl SellerDashboard {
    fn from_row(r: tokio_postgres::Row) -> Self {
        Self {
            revenue: r.get(0),
            expenses: r.get(1),
            cash_on_hand: r.get(2),
            last_month_revenue: r.get(3),
            last_month_expenses: r.get(4),
        }
    }
}

struct BudgetAlert {
    alert_id: String,
    alert_type: String,
    message: String,
    channel: String,
    is_read: bool,
    created_at: String,
}

#[Object]
impl BudgetAlert {
    async fn alert_id(&self) -> &str { &self.alert_id }
    async fn alert_type(&self) -> &str { &self.alert_type }
    async fn message(&self) -> &str { &self.message }
    async fn channel(&self) -> &str { &self.channel }
    async fn is_read(&self) -> bool { self.is_read }
    async fn created_at(&self) -> &str { &self.created_at }
}

impl BudgetAlert {
    fn from_row(r: &tokio_postgres::Row) -> Self {
        Self {
            alert_id: r.get(0),
            alert_type: r.get(1),
            message: r.get(2),
            channel: r.get(3),
            is_read: r.get(4),
            created_at: r.get(5),
        }
    }
}

struct FinancialHealthScore {
    score: i32,
    factors: Vec<HealthFactor>,
    calculated_at: String,
}

#[Object]
impl FinancialHealthScore {
    async fn score(&self) -> i32 { self.score }
    async fn factors(&self) -> &[HealthFactor] { &self.factors }
    async fn calculated_at(&self) -> &str { &self.calculated_at }
}

struct HealthFactor {
    key: String,
    impact: String,
    detail: String,
}

#[Object]
impl HealthFactor {
    async fn key(&self) -> &str { &self.key }
    async fn impact(&self) -> &str { &self.impact }
    async fn detail(&self) -> &str { &self.detail }
}

struct AffordabilityCheck {
    verdict: String,
    reason: String,
    tab_remaining: f64,
    deferred_remaining: f64,
}

#[Object]
impl AffordabilityCheck {
    async fn verdict(&self) -> &str { &self.verdict }
    async fn reason(&self) -> &str { &self.reason }
    async fn tab_remaining(&self) -> f64 { self.tab_remaining }
    async fn deferred_remaining(&self) -> f64 { self.deferred_remaining }
}

#[derive(async_graphql::InputObject)]
struct FinanceEntryInput {
    entry_type: String,
    amount: f64,
    category: Option<String>,
    description: Option<String>,
    transaction_date: String,
}

#[derive(async_graphql::InputObject)]
struct LedgerEntryInput {
    transaction_type: String,
    amount: f64,
}

struct SyncResult {
    inserted: i32,
    balance: Option<f64>,
    account_id: Option<String>,
}

#[Object]
impl SyncResult {
    async fn inserted(&self) -> i32 { self.inserted }
    async fn balance(&self) -> Option<f64> { self.balance }
    async fn account_id(&self) -> Option<&str> { self.account_id.as_deref() }
}

struct FinanceEntry {
    entry_id: String,
    entry_type: String,
    amount: f64,
    category: Option<String>,
    description: Option<String>,
    transaction_date: String,
    created_at: String,
}

#[Object]
impl FinanceEntry {
    async fn entry_id(&self) -> &str { &self.entry_id }
    async fn entry_type(&self) -> &str { &self.entry_type }
    async fn amount(&self) -> f64 { self.amount }
    async fn category(&self) -> Option<&str> { self.category.as_deref() }
    async fn description(&self) -> Option<&str> { self.description.as_deref() }
    async fn transaction_date(&self) -> &str { &self.transaction_date }
    async fn created_at(&self) -> &str { &self.created_at }
}

impl FinanceEntry {
    fn from_row(r: &tokio_postgres::Row) -> Self {
        Self {
            entry_id: r.get(0),
            entry_type: r.get(1),
            amount: r.get(2),
            category: r.get(3),
            description: r.get(4),
            transaction_date: r.get(5),
            created_at: r.get(6),
        }
    }
}

struct SellerSeriesPoint {
    month: String,
    income: f64,
    expenses: f64,
}

#[Object]
impl SellerSeriesPoint {
    async fn month(&self) -> &str { &self.month }
    async fn income(&self) -> f64 { self.income }
    async fn expenses(&self) -> f64 { self.expenses }
}

impl SellerSeriesPoint {
    fn from_row(r: &tokio_postgres::Row) -> Self {
        Self { month: r.get(0), income: r.get(1), expenses: r.get(2) }
    }
}

struct SellerCategory {
    name: String,
    spent: f64,
}

#[Object]
impl SellerCategory {
    async fn name(&self) -> &str { &self.name }
    async fn spent(&self) -> f64 { self.spent }
}

struct SellerInventoryItem {
    item_id: String,
    sku: String,
    name: String,
    stock: i32,
    reorder_level: i32,
    unit_cost: f64,
}

#[Object]
impl SellerInventoryItem {
    async fn item_id(&self) -> &str { &self.item_id }
    async fn sku(&self) -> &str { &self.sku }
    async fn name(&self) -> &str { &self.name }
    async fn stock(&self) -> i32 { self.stock }
    async fn reorder_level(&self) -> i32 { self.reorder_level }
    async fn unit_cost(&self) -> f64 { self.unit_cost }
}

impl SellerInventoryItem {
    fn from_row(r: &tokio_postgres::Row) -> Self {
        Self {
            item_id: r.get(0),
            sku: r.get(1),
            name: r.get(2),
            stock: r.get(3),
            reorder_level: r.get(4),
            unit_cost: r.get(5),
        }
    }
}
