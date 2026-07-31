use std::sync::Arc;

use async_graphql::{Context, Object, Result};
use tokio_postgres::Client;

use crate::AppState;

fn user_id(ctx: &Context<'_>) -> Option<String> {
    ctx.data_opt::<String>().cloned()
}

fn pg<'a>(ctx: &'a Context<'_>) -> &'a Client {
    &ctx.data_unchecked::<Arc<AppState>>().pg
}

#[derive(Default)]
pub struct QueryRoot;

#[derive(Default)]
pub struct MutationRoot;

#[Object]
impl QueryRoot {
    async fn me(&self, ctx: &Context<'_>) -> Result<Option<User>> {
        let Some(uid) = user_id(ctx) else { return Ok(None) };
        let row = pg(ctx)
            .query_opt(
                "SELECT user_id::text, email, full_name, avatar_url, user_type,
                        wallet_balance::float8, monthly_tab_limit::float8,
                        annual_deferred_limit::float8, financial_health_score,
                        coach_adherence_score::float8
                 FROM users WHERE user_id::text = $1",
                &[&uid],
            )
            .await?;
        Ok(row.map(User::from_row))
    }

    async fn wallet(&self, ctx: &Context<'_>) -> Result<Option<Wallet>> {
        let Some(uid) = user_id(ctx) else { return Ok(None) };
        let row = pg(ctx)
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
        let row = pg(ctx)
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

    async fn bank_accounts(&self, ctx: &Context<'_>) -> Result<Vec<BankAccount>> {
        let Some(uid) = user_id(ctx) else { return Ok(vec![]) };
        let rows = pg(ctx)
            .query(
                "SELECT account_id::text, b.name, mobile_number, account_type,
                        balance::float8, last_sync_at::text
                 FROM bank_accounts ba JOIN banks b ON b.bank_id = ba.bank_id
                 WHERE ba.user_id::text = $1 ORDER BY ba.created_at",
                &[&uid],
            )
            .await?;
        Ok(rows.iter().map(BankAccount::from_row).collect())
    }

    async fn analysis_history(&self, ctx: &Context<'_>, limit: Option<i32>, offset: Option<i32>) -> Result<Vec<AnalysisLog>> {
        let Some(uid) = user_id(ctx) else { return Ok(vec![]) };
        let rows = pg(ctx)
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
        let row = pg(ctx)
            .query_opt(
                "SELECT
                    COALESCE(SUM(amount) FILTER (WHERE entry_type = 'revenue'), 0)::float8 AS revenue,
                    COALESCE(SUM(amount) FILTER (WHERE entry_type IN ('expense','cogs','salary','rent','other')), 0)::float8 AS expenses,
                    COALESCE(SUM(amount) FILTER (WHERE entry_type IN ('revenue')), 0)::float8 -
                    COALESCE(SUM(amount) FILTER (WHERE entry_type IN ('expense','cogs','salary','rent','other')), 0)::float8 AS cash
                 FROM seller_finances WHERE user_id::text = $1 AND transaction_date >= date_trunc('month', now())",
                &[&uid],
            )
            .await?;
        Ok(row.map(SellerDashboard::from_row))
    }

    async fn budget_alerts(&self, ctx: &Context<'_>, unread_only: Option<bool>) -> Result<Vec<BudgetAlert>> {
        let Some(uid) = user_id(ctx) else { return Ok(vec![]) };
        generate_alerts(&uid, pg(ctx)).await?;
        let rows = pg(ctx)
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
        let row = pg(ctx)
            .query_opt(
                "SELECT u.monthly_tab_limit::float8, u.wallet_balance::float8,
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
        let out = pg(ctx)
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
        let Some(uid) = user_id(ctx) else { return Ok(None) };
        let row = pg(ctx)
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
            .await?;
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
}

fn chrono_since_days(unix_seconds: f64) -> f64 {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs_f64())
        .unwrap_or(0.0);
    ((now - unix_seconds) / 86400.0).max(0.0)
}

async fn generate_alerts(uid: &str, client: &Client) -> Result<()> {
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
    async fn set_monthly_tab_limit(&self, ctx: &Context<'_>, limit: f64) -> Result<MonthlyTab> {
        let Some(uid) = user_id(ctx) else { return Err("not authenticated".into()) };
        let row = pg(ctx)
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

    async fn add_finance_entry(&self, ctx: &Context<'_>, input: FinanceEntryInput) -> Result<FinanceEntry> {
        let Some(uid) = user_id(ctx) else { return Err("not authenticated".into()) };
        let row = pg(ctx)
            .query_one(
                "INSERT INTO seller_finances (user_id, entry_type, amount, category, description, transaction_date)
                 VALUES ($1::text::uuid, $2, $3::text::numeric, $4, $5, $6::text::date)
                 RETURNING entry_id::text, entry_type, amount::float8, category, description, transaction_date::text, created_at::text",
                &[&uid, &input.entry_type, &input.amount.to_string(), &input.category, &input.description, &input.transaction_date],
            )
            .await?;
        Ok(FinanceEntry::from_row(&row))
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

struct BankAccount {
    account_id: String,
    bank_name: String,
    mobile_number: String,
    account_type: Option<String>,
    balance: Option<f64>,
    last_sync_at: Option<String>,
}

#[Object]
impl BankAccount {
    async fn account_id(&self) -> &str { &self.account_id }
    async fn bank_name(&self) -> &str { &self.bank_name }
    async fn mobile_number(&self) -> &str { &self.mobile_number }
    async fn account_type(&self) -> Option<&str> { self.account_type.as_deref() }
    async fn balance(&self) -> Option<f64> { self.balance }
    async fn last_sync_at(&self) -> Option<&str> { self.last_sync_at.as_deref() }
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

struct SellerDashboard {
    revenue: f64,
    expenses: f64,
    cash_on_hand: f64,
}

#[Object]
impl SellerDashboard {
    async fn revenue(&self) -> f64 { self.revenue }
    async fn expenses(&self) -> f64 { self.expenses }
    async fn profit_margin(&self) -> f64 {
        if self.revenue == 0.0 { 0.0 } else { ((self.revenue - self.expenses) / self.revenue) * 100.0 }
    }
    async fn cash_on_hand(&self) -> f64 { self.cash_on_hand }
}

impl SellerDashboard {
    fn from_row(r: tokio_postgres::Row) -> Self {
        Self { revenue: r.get(0), expenses: r.get(1), cash_on_hand: r.get(2) }
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
