"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function TermsPanel() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Terms & Policies</h1>
        <p className="mt-1 text-sm text-muted-foreground">Last updated: August 2, 2026</p>
      </div>

      <Card>
        <CardHeader><CardTitle>1. Acceptance of Terms</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground leading-relaxed">
          By accessing or using Cartis, you agree to be bound by these Terms and Policies. If you do not agree, do not use the service.
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>2. Use of Service</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground leading-relaxed">
          Cartis provides AI-powered financial coaching, budget suggestions, and purchase analysis for Indian consumers. The service reads bank transaction data via Account Aggregator to track your finances. You must be at least 18 years old to use Cartis.
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>3. Data & Privacy</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground leading-relaxed">
          We collect transaction data from your bank via Account Aggregator, financial profile information you provide, and usage data to power our AI models. We never store bank passwords or UPI PINs. Your data is encrypted in transit and at rest. We do not sell your personal data to third parties.
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>3.1 Browser Extension</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground leading-relaxed">
          The Cartis browser extension reads the currently open product page on supported shopping sites (such as Amazon, Flipkart, and Best Buy) and sends the product name, price, seller, ratings, and a sample of visible reviews to our servers to generate a purchase verdict. This data is transmitted over HTTPS, cached briefly to serve repeat analyses, and is not sold or shared with third parties. The extension does not read other page content, browsing history, or personal data outside product pages. Sign-in is optional; verdicts can be generated without an account.
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>4. AI & Financial Advice</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground leading-relaxed">
          Cartis uses AI models to generate budget suggestions, spending insights, and purchase verdicts. This is not certified financial advice. All financial decisions are your own responsibility. AI outputs may occasionally be inaccurate.
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>5. Liability</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground leading-relaxed">
          Cartis is provided as-is. We are not liable for any financial losses incurred based on AI suggestions or budget recommendations. Our liability is limited to the amount you paid for the service in the last 12 months.
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>6. Contact</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground leading-relaxed">
          Questions about these terms? Reach out at support@cartis.app.
        </CardContent>
      </Card>
    </div>
  );
}
