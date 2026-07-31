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
