import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const ses = new SESClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function sendVerificationEmail(email: string, token: string) {
  const link = `${process.env.FRONTEND_URL}/verify?email=${encodeURIComponent(email)}&token=${token}`;
  const params = {
    Source: process.env.SES_FROM_EMAIL!,
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: 'Verify your email' },
      Body: {
        Html: { Data: `<p>Click <a href='${link}'>here</a> to verify your email.</p>` },
      },
    },
  };
  const command = new SendEmailCommand(params);
  await ses.send(command);
}
