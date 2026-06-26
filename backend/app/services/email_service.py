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
        self.use_sendgrid = bool(settings.SENDGRID_API_KEY)
        self.use_resend = bool(settings.RESEND_API_KEY)
        
        if self.use_sendgrid:
            logger.info("EmailService: Using SENDGRID provider")
        elif self.use_resend:
            logger.info("EmailService: Using RESEND provider")
        else:
            logger.info(f"EmailService: Using SMTP provider ({settings.SMTP_HOST})")

    # ─── Public API ────────────────────────────────────────────────────────────────

    async def send_magic_link_email(self, email: str, token: EmailVerificationToken, context: dict):
        """Sends a magic-link / invitation email."""
        frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
        base_url = (frontend_url or "http://localhost:5173").rstrip("/")
        if token.token_type == "password_reset":
            magic_link_url = f"{base_url}/reset-password/{token.token}"
        else:
            magic_link_url = f"{base_url}/magic-link/{token.token}"

        # Determine subject
        subject = "Your ESG Portal Magic Link"
        if token.token_type == "invitation":
            subject = f"You're invited to join {context.get('company_name', 'ESG Portal')}"
        elif token.token_type == "password_reset":
            subject = "Reset Your ESGravity Password"
        elif token.token_type == "login":
            subject = "Sign in to ESGravity"

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
        if not self.use_sendgrid and not self.use_resend and (not settings.SMTP_USER or not settings.SMTP_PASSWORD):
            print("[EMAIL] No credentials set — link logged above (copy from logs)", flush=True)
            return

        # Send via the appropriate provider
        if self.use_sendgrid:
            await self._send_via_sendgrid(email, subject, html)
        elif self.use_resend:
            await self._send_via_resend(email, subject, html)
        else:
            await self._send_via_smtp(email, subject, html)

    async def send_signup_notification_email(self, dev_email: str, new_user_email: str, new_user_name: str, login_token: str = None):
        """Sends a notification to developer admins when a new user signs up."""
        subject = f"🔔 New Signup: {new_user_name} is waiting for approval"

        logger.info("=" * 60)
        logger.info(f"SIGNUP_NOTIFICATION -> To: {dev_email} | New User: {new_user_email}")
        logger.info("=" * 60)
        print(f"[SIGNUP NOTIFY] Dev: {dev_email} | New user: {new_user_email}", flush=True)

        frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
        base_url = (frontend_url or 'http://localhost:5173').rstrip('/')
        if login_token:
            admin_url = f"{base_url}/magic-link/{login_token}"
        else:
            admin_url = f"{base_url}/developer-admin"


        html = f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8">
        <style>
            .body-wrap {{ background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 48px 20px; }}
            .container {{ background-color: #ffffff; max-width: 520px; margin: 0 auto; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }}
            .header {{ background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); padding: 28px 36px; display: flex; align-items: center; gap: 12px; }}
            .header-badge {{ background: rgba(245,158,11,0.2); border: 1px solid rgba(245,158,11,0.4); border-radius: 8px; padding: 6px 12px; display: inline-block; }}
            .header-badge span {{ color: #fbbf24; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }}
            .logo-text {{ color: #ffffff; font-size: 18px; font-weight: 800; margin: 0; }}
            .content {{ padding: 36px; }}
            .alert-box {{ background: rgba(245,158,11,0.06); border: 1px solid rgba(245,158,11,0.25); border-radius: 12px; padding: 18px 20px; margin-bottom: 24px; }}
            .alert-icon {{ font-size: 22px; margin-bottom: 8px; }}
            .alert-title {{ font-size: 17px; font-weight: 800; color: #0f172a; margin: 0 0 4px; }}
            .alert-sub {{ font-size: 13px; color: #64748b; margin: 0; }}
            .user-card {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px 18px; margin-bottom: 24px; }}
            .user-label {{ font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #94a3b8; margin-bottom: 6px; }}
            .user-name {{ font-size: 15px; font-weight: 700; color: #0f172a; margin: 0 0 2px; }}
            .user-email {{ font-size: 13px; color: #6366f1; margin: 0; font-family: monospace; }}
            .btn {{ display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #ffffff !important; padding: 13px 28px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 14px; }}
            .footer {{ padding: 20px 36px; border-top: 1px solid #f1f5f9; background: #f8fafc; font-size: 12px; color: #94a3b8; }}
        </style>
        </head>
        <body>
            <div class="body-wrap">
                <div class="container">
                    <div class="header">
                        <div>
                            <div class="header-badge"><span>Action Required</span></div>
                            <p class="logo-text" style="margin-top: 8px;">ESGravity Admin</p>
                        </div>
                    </div>
                    <div class="content">
                        <div class="alert-box">
                            <div class="alert-icon">🔔</div>
                            <p class="alert-title">New signup is awaiting your approval</p>
                            <p class="alert-sub">A user has verified their email and is in the approval queue.</p>
                        </div>
                        <div class="user-card">
                            <div class="user-label">New User</div>
                            <p class="user-name">{new_user_name}</p>
                            <p class="user-email">{new_user_email}</p>
                        </div>
                        <div style="text-align: left;">
                            <a href="{admin_url}" class="btn">Review in Dev Console →</a>
                        </div>
                        <p style="font-size: 12px; color: #94a3b8; margin-top: 20px; line-height: 1.6;">
                            Go to the <strong>⏳ Pending</strong> tab to approve or deny this request.<br>
                            The user will not be able to log in until you take action.
                        </p>
                    </div>
                    <div class="footer">&copy; 2026 ESGravity Platform — Developer Console</div>
                </div>
            </div>
        </body>
        </html>
        """

        if not self.use_sendgrid and not self.use_resend and (not settings.SMTP_USER or not settings.SMTP_PASSWORD):
            print("[EMAIL] No credentials — signup notification logged above", flush=True)
            return

        if self.use_sendgrid:
            await self._send_via_sendgrid(dev_email, subject, html)
        elif self.use_resend:
            await self._send_via_resend(dev_email, subject, html)
        else:
            await self._send_via_smtp(dev_email, subject, html)

    async def send_approval_email(self, email: str, token: EmailVerificationToken, context: dict):
        """Sends an account approval email with a one-click login link."""
        frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
        base_url = (frontend_url or "http://localhost:5173").rstrip("/")
        magic_link_url = f"{base_url}/magic-link/{token.token}"
        subject = "Your ESGravity Account Has Been Approved!"

        logger.info("=" * 60)
        logger.info(f"APPROVAL_EMAIL -> To: {email}")
        logger.info(f"APPROVAL_EMAIL -> Link: {magic_link_url}")
        logger.info("=" * 60)
        print(f"[APPROVAL] To: {email} | Link: {magic_link_url}", flush=True)

        name = context.get("name", "User")
        html = f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8">
        <style>
            .body-wrap {{ background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 48px 20px; }}
            .container {{ background-color: #ffffff; max-width: 560px; margin: 0 auto; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }}
            .header {{ background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 32px 40px; text-align: left; }}
            .logo-text {{ color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: -0.025em; margin: 0; }}
            .content {{ padding: 40px; }}
            .title {{ font-size: 24px; font-weight: 700; color: #0f172a; margin: 0 0 16px; }}
            .text {{ font-size: 15px; color: #475569; line-height: 1.6; margin-bottom: 32px; }}
            .btn {{ display: inline-block; background-color: #10b981; color: #ffffff !important; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px; }}
            .footer {{ padding: 24px 40px; border-top: 1px solid #f1f5f9; background-color: #f8fafc; font-size: 13px; color: #64748b; }}
        </style>
        </head>
        <body>
            <div class="body-wrap">
                <div class="container">
                    <div class="header"><h1 class="logo-text">ESGravity</h1></div>
                    <div class="content">
                        <h2 class="title">Your Account Has Been Approved! 🎉</h2>
                        <p class="text">
                            Hello {name},<br><br>
                            Great news! Your ESGravity account has been reviewed and <strong>approved</strong>.
                            You can now sign in and start your sustainability journey.
                            Click the button below to access your account — this link is valid for 1 hour.
                        </p>
                        <div style="text-align: left;">
                            <a href="{magic_link_url}" class="btn">Access My Account →</a>
                        </div>
                    </div>
                    <div class="footer">&copy; 2026 ESGravity Platform. All rights reserved.</div>
                </div>
            </div>
        </body>
        </html>
        """

        if not self.use_sendgrid and not self.use_resend and (not settings.SMTP_USER or not settings.SMTP_PASSWORD):
            print("[EMAIL] No credentials set — approval link logged above (copy from logs)", flush=True)
            return

        if self.use_sendgrid:
            await self._send_via_sendgrid(email, subject, html)
        elif self.use_resend:
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

    # ─── SendGrid Provider ───────────────────────────────────────────────────────────

    async def _send_via_sendgrid(self, to: str, subject: str, html: str):
        """Send an email using the SendGrid HTTP API."""
        import httpx

        sender_email = settings.EMAILS_FROM_EMAIL or "noreply@esgportal.com"
        sender_name = settings.EMAILS_FROM_NAME or "ESGravity"

        payload = {
            "personalizations": [{
                "to": [{"email": to}],
                "subject": subject
            }],
            "from": {
                "email": sender_email,
                "name": sender_name
            },
            "content": [{
                "type": "text/html",
                "value": html
            }]
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.sendgrid.com/v3/mail/send",
                    headers={
                        "Authorization": f"Bearer {settings.SENDGRID_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    json=payload,
                    timeout=15.0,
                )

            if response.status_code in (200, 202):
                logger.info(f"SendGrid: Email sent to {to}")
                print(f"SENDGRID SUCCESS: Email sent to {to}")
            else:
                logger.error(f"SendGrid: Failed ({response.status_code}) → {response.text}")
                print(f"SENDGRID ERROR: {response.status_code} {response.text}")

        except Exception as e:
            logger.error(f"SendGrid: Exception sending to {to}: {e}")
            print(f"SENDGRID EXCEPTION: {e}")

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
        company_name = context.get("company_name", "ESGravity")
        inviter_name = context.get("inviter_name", "A team member")

        if is_invitation:
            heading = f"Join {company_name}"
            description = (
                f"Hello {user_name},<br><br>"
                f"<strong>{inviter_name}</strong> has invited you to join the "
                f"<strong>{company_name}</strong> workspace on ESGravity. "
                f"Collaborate with your team to track environmental, social, and governance disclosures."
            )
            cta_text = "Accept Invitation &amp; Join Team"
        elif token.token_type == "password_reset":
            heading = "Reset Your Password"
            description = (
                f"Hello {user_name},<br><br>"
                f"We received a request to reset your password for your ESGravity account. "
                f"Click the button below to set a new password. This link is valid for 1 hour."
            )
            cta_text = "Reset Password"
        elif token.token_type == "login":
            heading = "Sign in to ESGravity"
            description = (
                f"Hello {user_name},<br><br>"
                f"Click the button below to sign in to your ESGravity account. "
                f"This link is valid for 1 hour."
            )
            cta_text = "Sign In"
        else:
            heading = "Verify Your Account"
            description = (
                f"Hello {user_name},<br><br>"
                f"Welcome to ESGravity! We're excited to help you transform your "
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
                        <h1 class="logo-text">ESGravity</h1>
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
                        <p style="margin: 0; font-size: 13px; color: #64748b;">&copy; 2026 ESGravity Platform. All rights reserved.</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """


email_service = EmailService()
