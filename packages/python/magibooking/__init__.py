"""Server-side MagiBooking cloud API client; Python standard library only."""
import json
import re
from urllib.parse import urlencode, urlparse
from urllib.request import Request, build_opener, HTTPRedirectHandler
from urllib.error import HTTPError
import hmac
import hashlib
import time

class MagiBookingError(Exception):
    def __init__(self, code, status=None, request_id=None):
        super().__init__(code)
        self.code, self.status, self.request_id = code, status, request_id

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

def _id(value):
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9_-]+", value):
        raise ValueError("Invalid resource ID")
    return value

def verify_webhook(secret, timestamp, signature, raw_body, now=None):
    if not isinstance(secret, str) or not secret or not isinstance(timestamp, str) or not re.fullmatch(r"\d{10,12}", timestamp) or not isinstance(signature, str) or not re.fullmatch(r"v1=[a-f0-9]{64}", signature) or not isinstance(raw_body, bytes):
        return False
    if abs((time.time() if now is None else now) - int(timestamp)) > 300:
        return False
    expected = "v1=" + hmac.new(secret.encode(), timestamp.encode()+b"."+raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)

class MagiBooking:
    def __init__(self, token, merchant_id, base_url, timeout=15):
        parsed = urlparse(base_url)
        if (parsed.scheme != "https" and not (parsed.scheme == "http" and parsed.hostname in ("localhost", "127.0.0.1", "::1"))) or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ("", "/") or not parsed.hostname:
            raise ValueError("Use an HTTPS origin (HTTP loopback allowed for tests)")
        if not isinstance(token, str) or not token or any(c in token for c in "\r\n"):
            raise ValueError("Token required")
        if timeout <= 0:
            raise ValueError("Invalid timeout")
        self.token, self.merchant_id, self.base_url, self.timeout = token, _id(merchant_id), base_url.rstrip("/"), timeout

    def request(self, path, method="GET", body=None, idempotency_key=None, if_match=None, query=None):
        if not re.fullmatch(r"[A-Za-z0-9_/-]+", path) or ".." in path or path.startswith("/"):
            raise ValueError("Invalid resource path")
        if body is not None and not re.fullmatch(r"[A-Za-z0-9_-]{16,128}", idempotency_key or ""):
            raise ValueError("Stable idempotency key required")
        headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key
        if if_match:
            headers["If-Match"] = if_match
        url = f"{self.base_url}/api/developer/v1/merchants/{_id(self.merchant_id)}/{path}/"
        if query:
            url += "?"+urlencode({k:v for k,v in query.items() if v is not None})
        req = Request(url, data=None if body is None else json.dumps(body).encode(), headers=headers, method=method)
        try:
            with build_opener(NoRedirect).open(req, timeout=self.timeout) as response:
                try:
                    return json.load(response)
                except (ValueError, UnicodeError) as error:
                    raise MagiBookingError("INVALID_RESPONSE", response.status, response.headers.get("X-Request-Id")) from error
        except HTTPError as error:
            try:
                data = json.load(error)
            except (ValueError, UnicodeError):
                data = {}
            details = data.get("error", {})
            raise MagiBookingError(details.get("code", "API_ERROR"), error.code, details.get("request_id") or error.headers.get("X-Request-Id")) from None

    def services(self):
        return self.request("services")

    def staff(self):
        return self.request("staff")

    def availability(self, *, date, service_id, staff_id):
        return self.request("availability", query={"date":date, "service_id":service_id, "staff_id":staff_id})

    def create_appointment(self, body, idempotency_key):
        return self.request("appointments", "POST", body, idempotency_key)

    def appointment(self, appointment_id):
        return self.request(f"appointments/{_id(appointment_id)}")

    def reschedule_appointment(self, appointment_id, body, *, idempotency_key, if_match):
        return self.request(f"appointments/{_id(appointment_id)}/reschedule", "POST", body, idempotency_key, if_match)

    def cancel_appointment(self, appointment_id, body, *, idempotency_key, if_match):
        return self.request(f"appointments/{_id(appointment_id)}/cancel", "POST", body, idempotency_key, if_match)

    def payments(self, appointment_id):
        return self.request(f"appointments/{_id(appointment_id)}/payments")

    def checkout(self, appointment_id, idempotency_key):
        return self.request(f"appointments/{_id(appointment_id)}/checkout", "POST", {}, idempotency_key)

    def reminders(self, appointment_id):
        return self.request(f"appointments/{_id(appointment_id)}/reminders")

    def send_reminder(self, appointment_id, channel, idempotency_key):
        return self.request(f"appointments/{_id(appointment_id)}/reminders", "POST", {"channel":channel}, idempotency_key)

    def payment_setup(self):
        return self.request("payments/setup")

    def create_service(self, body, idempotency_key):
        return self.request("services", "POST", body, idempotency_key)

    def update_service(self, service_id, body, *, idempotency_key, if_match):
        return self.request(f"services/{_id(service_id)}", "PATCH", body, idempotency_key, if_match)

    def create_staff(self, body, idempotency_key):
        return self.request("staff", "POST", body, idempotency_key)

    def update_staff(self, staff_id, body, *, idempotency_key, if_match):
        return self.request(f"staff/{_id(staff_id)}", "PATCH", body, idempotency_key, if_match)
