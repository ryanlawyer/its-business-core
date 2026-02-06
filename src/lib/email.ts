import nodemailer from 'nodemailer';
import { getSettings } from './settings';

/**
 * Create a nodemailer transport from system settings
 */
function createTransport() {
  const settings = getSettings();
  const provider = settings.email.provider;

  if (provider === 'none') return null;

  if (provider === 'smtp') {
    const smtp = settings.email.smtp;
    if (!smtp.host) return null;
    return nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: {
        user: smtp.username,
        pass: smtp.password,
      },
    });
  }

  if (provider === 'gmail') {
    const gmail = settings.email.gmail;
    if (!gmail.clientId || !gmail.refreshToken) return null;
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        clientId: gmail.clientId,
        clientSecret: gmail.clientSecret,
        refreshToken: gmail.refreshToken,
      },
    });
  }

  if (provider === 'office365') {
    const o365 = settings.email.office365;
    if (!o365.clientId || !o365.refreshToken) return null;
    return nodemailer.createTransport({
      service: 'Outlook365',
      auth: {
        type: 'OAuth2',
        clientId: o365.clientId,
        clientSecret: o365.clientSecret,
        refreshToken: o365.refreshToken,
      },
    });
  }

  return null;
}

/**
 * Get the "from" address from settings
 */
function getFromAddress(): string {
  const settings = getSettings();
  if (settings.email.provider === 'smtp' && settings.email.smtp.fromAddress) {
    return settings.email.smtp.fromAddress;
  }
  return `noreply@${settings.organization.name.toLowerCase().replace(/\s+/g, '')}.local`;
}

/**
 * Send an email (fire-and-forget, catches errors silently)
 */
export async function sendEmail(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  try {
    const transport = createTransport();
    if (!transport) return;

    await transport.sendMail({
      from: getFromAddress(),
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
  } catch (error) {
    console.error('Failed to send email:', error);
  }
}

/**
 * Send rejection notification to employee
 */
export async function sendRejectionNotification(
  employeeEmail: string,
  employeeName: string,
  date: string,
  note: string,
  rejectedBy: string,
): Promise<void> {
  await sendEmail({
    to: employeeEmail,
    subject: `Time Entry Rejected - ${date}`,
    text: `Hi ${employeeName},\n\nYour time entry for ${date} has been rejected by ${rejectedBy}.\n\nReason: ${note}\n\nPlease contact your manager for correction.`,
    html: `<p>Hi ${employeeName},</p>
<p>Your time entry for <strong>${date}</strong> has been rejected by ${rejectedBy}.</p>
<p><strong>Reason:</strong> ${note}</p>
<p>Please contact your manager for correction.</p>`,
  });
}

/**
 * Send missed punch notification to employee
 */
export async function sendMissedPunchNotification(
  employeeEmail: string,
  employeeName: string,
  clockInTime: string,
): Promise<void> {
  await sendEmail({
    to: employeeEmail,
    subject: 'Missed Clock-Out Detected',
    text: `Hi ${employeeName},\n\nIt appears you may have missed clocking out. Your clock-in time was ${clockInTime}.\n\nPlease contact your manager to resolve this.`,
    html: `<p>Hi ${employeeName},</p>
<p>It appears you may have missed clocking out. Your clock-in time was <strong>${clockInTime}</strong>.</p>
<p>Please contact your manager to resolve this.</p>`,
  });
}

/**
 * Send pending entries reminder to manager
 */
export async function sendPendingEntriesReminder(
  managerEmail: string,
  managerName: string,
  pendingCount: number,
  periodLabel: string,
): Promise<void> {
  await sendEmail({
    to: managerEmail,
    subject: `${pendingCount} Pending Time Entries - ${periodLabel}`,
    text: `Hi ${managerName},\n\nYou have ${pendingCount} time entries awaiting approval for ${periodLabel}.\n\nPlease review them at your earliest convenience.`,
    html: `<p>Hi ${managerName},</p>
<p>You have <strong>${pendingCount}</strong> time entries awaiting approval for <strong>${periodLabel}</strong>.</p>
<p>Please review them at your earliest convenience.</p>`,
  });
}
