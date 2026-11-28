"""Transactional email via Resend, plus the branded templates the API sends."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from html import escape

import httpx

from ..core.config import settings

log = logging.getLogger("guardai.email")

RESEND_URL = "https://api.resend.com/emails"


class EmailError(RuntimeError):
    pass


@dataclass
class Email:
    subject: str
    html: str
    text: str


async def send_email(to: str, email: Email, *, sender: str | None = None, reply_to: str | None = None) -> None:
    if not settings.resend_api_key:
        raise EmailError("RESEND_API_KEY is not configured")
    payload = {
        "from": sender or settings.email_from,
        "to": [to],
        "subject": email.subject,
        "html": email.html,
        "text": email.text,
    }
    if reply_to:
        payload["reply_to"] = reply_to
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.post(RESEND_URL, headers={"Authorization": f"Bearer {settings.resend_api_key}"}, json=payload)
    except httpx.HTTPError as exc:
        raise EmailError(f"Resend unreachable: {exc}") from exc
    if not res.is_success:
        log.error("Resend error %s: %s", res.status_code, res.text[:300])
        raise EmailError(f"Resend rejected the email ({res.status_code})")


# --------------------------------------------------------------------------------- templates
INK = "#171311"
MUTED = "#6f6862"
LINE = "#e7e2dc"
PAGE = "#f2efeb"
SOFT = "#f7f5f2"
FONT = "'Inter Tight','Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
MONO = "'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"


def _detail_rows(rows: list[tuple[str, str]]) -> str:
    out = []
    for i, (label, value) in enumerate(rows):
        border = f"border-top:1px solid {LINE};" if i else ""
        out.append(
            f'<tr><td style="{border}padding:12px 0;font:500 11px/16px {MONO};letter-spacing:.06em;'
            f'text-transform:uppercase;color:{MUTED};width:120px;vertical-align:top">{escape(label)}</td>'
            f'<td style="{border}padding:12px 0;font:500 14px/20px {FONT};color:{INK}">{escape(value)}</td></tr>'
        )
    return "".join(out)


def _steps(steps: list[tuple[str, str]]) -> str:
    out = []
    for i, (title, text) in enumerate(steps, 1):
        out.append(
            '<tr><td style="padding:0 0 18px 0;vertical-align:top;width:40px">'
            f'<div style="width:28px;height:28px;border-radius:14px;background:{INK};color:#fff;'
            f'font:600 12px/28px {MONO};text-align:center">{i:02d}</div></td>'
            f'<td style="padding:2px 0 18px 0;vertical-align:top"><div style="font:600 15px/22px {FONT};color:{INK}">'
            f'{escape(title)}</div><div style="font:400 14px/21px {FONT};color:{MUTED}">{escape(text)}</div></td></tr>'
        )
    return "".join(out)


def _layout(*, preheader: str, eyebrow: str, headline: str, body: str, footer: str) -> str:
    year = datetime.now().year
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>{escape(headline)}</title></head>
<body style="margin:0;padding:0;background:{PAGE};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:{PAGE}">{escape(preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{PAGE}">
<tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
  <tr><td style="padding:0 8px 20px 8px">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="width:30px;height:30px;border-radius:9px;background:{INK};color:#fff;font:700 15px/30px {FONT};text-align:center">G</td>
      <td style="padding-left:10px;font:600 16px/30px {FONT};color:{INK};letter-spacing:-.01em">Guard AI</td>
    </tr></table>
  </td></tr>
  <tr><td style="background:#ffffff;border:1px solid {LINE};border-radius:24px;padding:40px 36px">
    <div style="font:500 11px/16px {MONO};letter-spacing:.08em;text-transform:uppercase;color:{MUTED}">[ {escape(eyebrow)} ]</div>
    <h1 style="margin:14px 0 0 0;font:600 28px/34px {FONT};letter-spacing:-.02em;color:{INK}">{escape(headline)}</h1>
    {body}
  </td></tr>
  <tr><td style="padding:24px 8px 0 8px;font:400 12px/19px {FONT};color:{MUTED}">
    {footer}
    <div style="margin-top:14px;font:500 11px/16px {MONO};letter-spacing:.04em;color:#9a938c">&copy; {year} GUARD AI &middot; AI-PROCTORED EXAMS</div>
  </td></tr>
</table>
</td></tr></table>
</body></html>"""


def render_invitation(
    *,
    student_name: str | None,
    student_email: str,
    teacher_name: str,
    teacher_email: str | None,
    batch_names: list[str],
    accept_url: str,
    expires_in_days: int,
) -> Email:
    first = (student_name or "").split(" ")[0] or "there"
    expires = (datetime.now() + timedelta(days=expires_in_days)).strftime("%d %b %Y")
    subject = f"{teacher_name} invited you to Guard AI"
    rows = [("Account", student_email), ("Invited by", f"{teacher_name} ({teacher_email})" if teacher_email else teacher_name)]
    if batch_names:
        rows.append(("Class" if len(batch_names) == 1 else "Classes", ", ".join(batch_names)))
    rows.append(("Link expires", expires))
    steps = [
        ("Accept and set a password", f"Use this email address ({student_email}) to create your account."),
        ("See your exams", "Exams your teacher assigns appear on your dashboard, with the date and duration."),
        ("Quick check before each exam", "A camera, microphone and identity check takes under a minute."),
    ]
    url = escape(accept_url, quote=True)
    body = f"""
    <p style="margin:18px 0 0 0;font:400 15px/24px {FONT};color:#3d3833">Hi {escape(first)},</p>
    <p style="margin:10px 0 0 0;font:400 15px/24px {FONT};color:#3d3833"><strong style="color:{INK}">{escape(teacher_name)}</strong>
      has added you as a student on Guard AI, the platform they use to run online exams. Accept the invitation to set up your account.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 0 0"><tr>
      <td style="border-radius:999px;background:{INK}">
        <a href="{url}" target="_blank" style="display:inline-block;padding:14px 28px;font:600 15px/20px {FONT};color:#ffffff;text-decoration:none;border-radius:999px">Accept invitation &rarr;</a>
      </td></tr></table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:32px 0 0 0;background:{SOFT};border-radius:16px">
      <tr><td style="padding:6px 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">{_detail_rows(rows)}</table></td></tr>
    </table>
    <div style="margin:32px 0 16px 0;font:500 11px/16px {MONO};letter-spacing:.08em;text-transform:uppercase;color:{MUTED}">What happens next</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">{_steps(steps)}</table>
    <div style="border-top:1px solid {LINE};margin-top:6px;padding-top:20px;font:400 13px/20px {FONT};color:{MUTED}">
      Button not working? Paste this link into your browser:<br>
      <a href="{url}" style="color:{INK};word-break:break-all">{escape(accept_url)}</a>
    </div>"""
    footer = (
        f"You received this email because {escape(teacher_name)} invited {escape(student_email)} to Guard AI. "
        "If you weren&rsquo;t expecting it, you can ignore it &mdash; no account is created unless you accept."
    )
    html = _layout(
        preheader=f"{teacher_name} added you as a student. Accept to see your exams.",
        eyebrow="Student invitation",
        headline=f"Join {teacher_name}'s class on Guard AI",
        body=body,
        footer=footer,
    )
    text_rows = "\n".join(f"{label}: {value}" for label, value in rows)
    text_steps = "\n".join(f"{i}. {t} - {d}" for i, (t, d) in enumerate(steps, 1))
    text = (
        f"Hi {first},\n\n{teacher_name} has added you as a student on Guard AI, the platform they use to run online exams.\n\n"
        f"Accept the invitation:\n{accept_url}\n\n{text_rows}\n\nWhat happens next\n{text_steps}\n\n"
        f"You received this because {teacher_name} invited {student_email}. If you weren't expecting it, ignore this email; "
        "no account is created unless you accept.\n\nGuard AI"
    )
    return Email(subject=subject, html=html, text=text)
