use std::env;
use lettre::message::header::ContentType;
use lettre::transport::smtp::authentication::Credentials;
use lettre::{Message, SmtpTransport, Transport};

pub async fn send_email(to: &str, subject: &str, html: &str) {
    let api_key = match env::var("MAILJET_API_KEY") {
        Ok(k) if !k.is_empty() => k,
        _ => return,
    };
    let secret_key = match env::var("MAILJET_SECRET_KEY") {
        Ok(k) if !k.is_empty() => k,
        _ => return,
    };
    let sender_name = env::var("MAILJET_SENDER_NAME")
        .unwrap_or_else(|_| "Cartis".into());
    let sender_email = env::var("MAILJET_SENDER_EMAIL")
        .unwrap_or_else(|_| "kyahifarakpdtahein@gmail.com".into());

    let from = format!("{sender_name} <{sender_email}>");
    let to_addr = format!("<{to}>");

    let Ok(email) = Message::builder()
        .from(from.parse().unwrap_or_else(|_| "Cartis <noreply@cartis.in>".parse().unwrap()))
        .to(to_addr.parse().unwrap_or_else(|_| "noreply@cartis.in".parse().unwrap()))
        .subject(subject)
        .header(ContentType::TEXT_HTML)
        .body(html.to_string())
    else { return };

    tokio::task::spawn_blocking(move || {
        let creds = Credentials::new(api_key, secret_key);
        let mailer = SmtpTransport::starttls_relay("in-v3.mailjet.com")
            .unwrap()
            .credentials(creds)
            .build();
        match mailer.send(&email) {
            Ok(_) => {}
            Err(e) => eprintln!("smtp email failed: {e}"),
        }
    });
}
