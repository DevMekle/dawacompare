// SMS sending for login codes and refill reminders. Chosen by environment variables:
//   SMS_PROVIDER=msg91   MSG91_AUTHKEY, MSG91_OTP_TEMPLATE_ID, MSG91_REMINDER_TEMPLATE_ID (DLT-approved templates)
//   SMS_PROVIDER=twilio  TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM
// With no provider configured, smsFromEnv() returns null and login runs in test mode
// (the code is shown on screen). Keys are never logged or returned.

export interface SmsSender {
  name: string;
  sendOtp(phone: string, code: string): Promise<boolean>;
  sendText(phone: string, text: string): Promise<boolean>;
}

const digits = (phone: string) => phone.replace(/\D/g, ""); // "+919876543210" → "919876543210"

export function smsFromEnv(env: Record<string, string | undefined> = process.env): SmsSender | null {
  const provider = (env.SMS_PROVIDER || "").toLowerCase();
  if (provider === "msg91" && env.MSG91_AUTHKEY && env.MSG91_OTP_TEMPLATE_ID) {
    const key = env.MSG91_AUTHKEY;
    return {
      name: "msg91",
      async sendOtp(phone, code) {
        const q = new URLSearchParams({ template_id: env.MSG91_OTP_TEMPLATE_ID!, mobile: digits(phone), otp: code, otp_expiry: "10" });
        const r = await fetch(`https://control.msg91.com/api/v5/otp?${q}`, { method: "POST", headers: { authkey: key, "Content-Type": "application/json" }, body: "{}" });
        if (!r.ok) console.error(`SMS error: provider=msg91 kind=otp status=${r.status}`);
        return r.ok;
      },
      async sendText(phone, text) {
        if (!env.MSG91_REMINDER_TEMPLATE_ID) return false;
        const r = await fetch("https://control.msg91.com/api/v5/flow", {
          method: "POST",
          headers: { authkey: key, "Content-Type": "application/json" },
          body: JSON.stringify({ template_id: env.MSG91_REMINDER_TEMPLATE_ID, short_url: "0", recipients: [{ mobiles: digits(phone), var1: text.slice(0, 120) }] }),
        });
        if (!r.ok) console.error(`SMS error: provider=msg91 kind=text status=${r.status}`);
        return r.ok;
      },
    };
  }
  if (provider === "twilio" && env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM) {
    const send = async (phone: string, body: string, kind: string) => {
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
        method: "POST",
        headers: { Authorization: "Basic " + Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: phone, From: env.TWILIO_FROM!, Body: body }).toString(),
      });
      if (!r.ok) console.error(`SMS error: provider=twilio kind=${kind} status=${r.status}`);
      return r.ok;
    };
    return {
      name: "twilio",
      sendOtp: (phone, code) => send(phone, `${code} is your DawaCompare login code. It expires in 10 minutes. Do not share it.`, "otp"),
      sendText: (phone, text) => send(phone, text, "text"),
    };
  }
  return null;
}
