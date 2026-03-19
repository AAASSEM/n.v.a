import logging
from typing import Optional
from app.core.config import settings
from app.models.token import EmailVerificationToken

logger = logging.getLogger(__name__)


class EmailService:
    """
    Dual-mode email service:
      • Production  → Resend (HTTP API, no SMTP needed)
      • Development → SMTP via fastapi-mail (Gmail, etc.)
    
    The mode is auto-detected from settings.RESEND_API_KEY.
    """

    def __init__(self):
        self.use_resend = bool(settings.RESEND_API_KEY)
        
        if self.use_resend:
            logger.info("EmailService: Using RESEND provider")
        else:
            logger.info(f"EmailService: Using SMTP provider ({settings.SMTP_HOST})")

    # ─── Public API ────────────────────────────────────────────────────────────────

    async def send_magic_link_email(self, email: str, token: EmailVerificationToken, context: dict):
        """Sends a magic-link / invitation email."""
        frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
        base_url = (frontend_url or "http://localhost:5173").rstrip("/")
        magic_link_url = f"{base_url}/#/magic-link/{token.token}"

        # Determine subject
        subject = "Your ESG Portal Magic Link"
        if token.token_type == "invitation":
            subject = f"You're invited to join {context.get('company_name', 'ESG Portal')}"

        # ALWAYS log the link — visible in Render logs as a backup
        logger.info("=" * 60)
        logger.info(f"EMAIL_MAGIC_LINK -> To: {email}")
        logger.info(f"EMAIL_MAGIC_LINK -> Subject: {subject}")
        logger.info(f"EMAIL_MAGIC_LINK -> Link: {magic_link_url}")
        logger.info(f"EMAIL_MAGIC_LINK -> Code: {token.verification_code}")
        logger.info("=" * 60)

        # Print for local/non-aggregated logs fallback
        print("-" * 30, flush=True)
        print(f"To: {email} | Link: {magic_link_url}", flush=True)
        print("-" * 30, flush=True)

        # Build the HTML body
        html = self._build_html(token, context, magic_link_url)

        # No credentials at all -> mock only (link already logged above)
        if not self.use_resend and (not settings.SMTP_USER or not settings.SMTP_PASSWORD):
            print("[EMAIL] No credentials set — link logged above (copy from logs)", flush=True)
            return

        # Send via the appropriate provider
        if self.use_resend:
            await self._send_via_resend(email, subject, html)
        else:
            await self._send_via_smtp(email, subject, html)

    # ─── Resend Provider ───────────────────────────────────────────────────────────

    async def _send_via_resend(self, to: str, subject: str, html: str):
        """Send an email using the Resend HTTP API."""
        import httpx

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.resend.com/emails",
                    headers={
                        "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "from": f"{settings.EMAILS_FROM_NAME} <{settings.EMAILS_FROM_EMAIL}>",
                        "to": [to],
                        "subject": subject,
                        "html": html,
                    },
                    timeout=15.0,
                )

            if response.status_code in (200, 201):
                logger.info(f"Resend: Email sent to {to} (id: {response.json().get('id')})")
            else:
                logger.error(f"Resend: Failed ({response.status_code}) → {response.text}")
                print(f"RESEND ERROR: {response.status_code} {response.text}")

        except Exception as e:
            logger.error(f"Resend: Exception sending to {to}: {e}")
            print(f"RESEND EXCEPTION: {e}")

    # ─── SMTP Provider ─────────────────────────────────────────────────────────────

    async def _send_via_smtp(self, to: str, subject: str, html: str):
        """Send an email via traditional SMTP (Gmail, etc.)."""
        from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType

        conf = ConnectionConfig(
            MAIL_USERNAME=settings.SMTP_USER or "",
            MAIL_PASSWORD=settings.SMTP_PASSWORD or "",
            MAIL_FROM=settings.EMAILS_FROM_EMAIL or "noreply@esgportal.com",
            MAIL_PORT=settings.SMTP_PORT,
            MAIL_SERVER=settings.SMTP_HOST,
            MAIL_FROM_NAME=settings.EMAILS_FROM_NAME,
            MAIL_STARTTLS=settings.SMTP_TLS,
            MAIL_SSL_TLS=settings.SMTP_SSL,
            USE_CREDENTIALS=True if settings.SMTP_USER else False,
            VALIDATE_CERTS=True,
        )

        message = MessageSchema(
            subject=subject,
            recipients=[to],
            body=html,
            subtype=MessageType.html,
        )

        fm = FastMail(conf)
        try:
            await fm.send_message(message)
            logger.info(f"SMTP: Email sent to {to}")
        except Exception as e:
            logger.error(f"SMTP: Failed to send to {to}: {e}")
            print(f"SMTP ERROR: {e}")

    # ─── HTML Template ─────────────────────────────────────────────────────────────

    def _build_html(self, token: EmailVerificationToken, context: dict, magic_link_url: str) -> str:
        is_invitation = token.token_type == "invitation"
        user_name = context.get("name", "User")
        company_name = context.get("company_name", "ESG Compass")
        inviter_name = context.get("inviter_name", "A team member")

        if is_invitation:
            heading = f"Join {company_name}"
            description = (
                f"Hello {user_name},<br><br>"
                f"<strong>{inviter_name}</strong> has invited you to join the "
                f"<strong>{company_name}</strong> workspace on ESG Compass. "
                f"Collaborate with your team to track environmental, social, and governance disclosures."
            )
            cta_text = "Accept Invitation &amp; Join Team"
        else:
            heading = "Verify Your Account"
            description = (
                f"Hello {user_name},<br><br>"
                f"Welcome to ESG Compass! We're excited to help you transform your "
                f"sustainability tracking. Click the button below to verify your email "
                f"and complete your account setup."
            )
            cta_text = "Verify Email &amp; Get Started"

        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                .body-wrap {{ background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 48px 20px; }}
                .container {{ background-color: #ffffff; max-width: 560px; margin: 0 auto; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }}
                .header {{ background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); padding: 32px 40px; text-align: left; }}
                .logo-text {{ color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: -0.025em; margin: 0; }}
                .content {{ padding: 40px; }}
                .title {{ font-size: 24px; font-weight: 700; color: #0f172a; margin: 0 0 16px; letter-spacing: -0.025em; }}
                .text {{ font-size: 15px; color: #475569; line-height: 1.6; margin-bottom: 32px; }}
                .btn {{ display: inline-block; background-color: #6366f1; color: #ffffff !important; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px; text-align: center; }}
                .footer {{ padding: 32px 40px; border-top: 1px solid #f1f5f9; background-color: #f8fafc; }}
                .backup-wrap {{ background-color: #ffffff; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 16px; margin-top: 24px; }}
                .backup-label {{ font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; font-weight: 700; margin-bottom: 4px; }}
                .backup-code {{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; color: #6366f1; word-break: break-all; margin: 0; }}
                .not-you {{ font-size: 12px; color: #94a3b8; margin-top: 24px; }}
            </style>
        </head>
        <body>
            <div class="body-wrap">
                <div class="container">
                    <div class="header">
                        <h1 class="logo-text">ESG Compass</h1>
                    </div>
                    <div class="content">
                        <h2 class="title">{heading}</h2>
                        <p class="text">{description}</p>
                        <div style="text-align: left;">
                            <a href="{magic_link_url}" class="btn">{cta_text}</a>
                        </div>
                        <div class="backup-wrap">
                            <div class="backup-label">Backup Access Code</div>
                            <p class="backup-code">{token.verification_code}</p>
                        </div>
                        <p class="not-you">If you didn't request this email, you can safely ignore it.</p>
                    </div>
                    <div class="footer">
                        <p style="margin: 0; font-size: 13px; color: #64748b;">&copy; 2026 ESG Compass Platform. All rights reserved.</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """


email_service = EmailService()
