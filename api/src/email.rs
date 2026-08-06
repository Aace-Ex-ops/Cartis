use std::env;

pub async fn send_email(to: &str, subject: &str, html: &str) {
    let api_key = match env::var("RESEND_API_KEY") {
        Ok(k) if !k.is_empty() => k,
        _ => return,
    };
    let from = env::var("EMAIL_FROM").unwrap_or_else(|_| "onboarding@resend.dev".into());
    let body = serde_json::json!({
        "from": from,
        "to": [to],
        "subject": subject,
        "html": html,
    });
    tokio::spawn(async move {
        let client = reqwest::Client::new();
        let resp = client
            .post("https://api.resend.com/emails")
            .bearer_auth(&api_key)
            .json(&body)
            .send()
            .await;
        if let Err(e) = resp {
            eprintln!("resend email failed: {e}");
        }
    });
}
