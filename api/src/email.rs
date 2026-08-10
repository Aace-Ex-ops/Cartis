use std::env;

// Email goes through the gateway's POST /api/email (it holds the only valid
// RESEND_API_KEY; the instance key is dead/unreadable). Same pattern as
// revoke_gateway_sessions -> /auth/revoke-all. Swap for direct Resend REST
// when a verified domain + valid key land on the instance.
pub async fn send_email(to: &str, subject: &str, html: &str) {
    let gateway_url = match env::var("GATEWAY_URL") {
        Ok(u) if !u.is_empty() => u,
        _ => return,
    };
    let secret = match env::var("BACKEND_SECRET") {
        Ok(s) if !s.is_empty() => s,
        _ => return,
    };
    let body = serde_json::json!({ "to": to, "subject": subject, "html": html });
    tokio::spawn(async move {
        let client = reqwest::Client::new();
        let resp = client
            .post(format!("{gateway_url}/api/email"))
            .header("x-cartis-backend-secret", secret)
            .json(&body)
            .send()
            .await;
        match resp {
            Ok(r) if !r.status().is_success() => {
                let text = r.text().await.unwrap_or_default();
                eprintln!("email via gateway failed: {text}");
            }
            Ok(_) => {}
            Err(e) => eprintln!("email via gateway failed: {e}"),
        }
    });
}
