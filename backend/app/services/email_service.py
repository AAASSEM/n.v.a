import logging
import os
from typing import Optional
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from app.core.config import settings
from app.models.token import EmailVerificationToken

logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self):
        self.conf = ConnectionConfig(
            MAIL_USERNAME=settings.SMTP_USER if settings.SMTP_USER else "",
            MAIL_PASSWORD=settings.SMTP_PASSWORD if settings.SMTP_PASSWORD else "",
            MAIL_FROM=settings.EMAILS_FROM_EMAIL if settings.EMAILS_FROM_EMAIL else "noreply@esgportal.com",
            MAIL_PORT=settings.SMTP_PORT,
            MAIL_SERVER=settings.SMTP_HOST,
            MAIL_FROM_NAME=settings.EMAILS_FROM_NAME,
            MAIL_STARTTLS=settings.SMTP_TLS,
            MAIL_SSL_TLS=settings.SMTP_SSL,
            USE_CREDENTIALS=True if settings.SMTP_USER else False,
            VALIDATE_CERTS=True
        )
        print(f"DEBUG: EmailService initialized. Host: {settings.SMTP_HOST}, User: {settings.SMTP_USER}, Password set: {bool(settings.SMTP_PASSWORD)}")

    async def send_magic_link_email(self, email: str, token: EmailVerificationToken, context: dict):
        print(f"DEBUG: Attempting to send email to {email}. SMTP_USER: {settings.SMTP_USER}")
        """
        Sends an email with a magic link to the user.
        """
        base_url = settings.FRONTEND_URL.rstrip("/")
        magic_link_url = f"{base_url}/magic-link/{token.token}"
        
        subject = "Your ESG Portal Magic Link"
        if token.token_type == "invitation":
            subject = f"You're invited to join {context.get('company_name', 'ESG Portal')}"
            
        # Fallback to mock if no SMTP_USER is set
        if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
            message = f"MOCK EMAIL (SMTP_USER not set) To: {email} Subject: {subject}\nLink: {magic_link_url}"
            logger.info(message)
            print(message)
            return

        is_invitation = token.token_type == "invitation"
        user_name = context.get('name', 'User')
        company_name = context.get('company_name', 'ESG Compass')
        inviter_name = context.get('inviter_name', 'A team member')

        if is_invitation:
            main_title = "Invitation to Join Team"
            heading = f"Join {company_name}"
            description = f"Hello {user_name},<br><br><strong>{inviter_name}</strong> has invited you to join the <strong>{company_name}</strong> workspace on ESG Compass. Collaborate with your team to track environmental, social, and governance disclosures."
            cta_text = "Accept Invitation & Join Team"
        else:
            main_title = "Welcome to ESG Compass"
            heading = "Verify Your Account"
            description = f"Hello {user_name},<br><br>Welcome to ESG Compass! We're excited to help you transform your sustainability tracking. Click the button below to verify your email and complete your account setup."
            cta_text = "Verify Email & Get Started"

        html = f"""
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
                .btn {{ display: inline-block; background-color: #6366f1; color: #ffffff !important; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px; text-align: center; transition: background-color 0.2s; }}
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

        message = MessageSchema(
            subject=subject,
            recipients=[email],
            body=html,
            subtype=MessageType.html
        )

        fm = FastMail(self.conf)
        try:
            await fm.send_message(message)
            logger.info(f"Email sent successfully to {email}")
        except Exception as e:
            logger.error(f"Failed to send email to {email}: {str(e)}")
            # Fallback to printing if sending fails
            print(f"FAILED TO SEND REAL EMAIL: {str(e)}")

email_service = EmailService()
