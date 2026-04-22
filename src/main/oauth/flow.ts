import { shell } from 'electron';
import { google } from 'googleapis';
import { startLoopbackServer } from './loopback-server';
import * as keychain from '../keychain';
import type { Tokens } from '../../shared/types';

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

export interface AuthorizeResult {
  email: string;
  tokens: Tokens;
}

export class NoCredentialsError extends Error {
  code = 'NO_CREDENTIALS' as const;
  constructor() {
    super('尚未配置 Google Cloud 凭据');
  }
}

export class OAuthCancelledError extends Error {
  code = 'OAUTH_CANCELLED' as const;
  constructor(reason: string) {
    super(reason);
  }
}

/**
 * 完整 OAuth 授权流程。
 * 1. 从 Keychain 拿 Client ID / Secret
 * 2. 启动 loopback server
 * 3. 系统浏览器打开授权 URL
 * 4. 等浏览器重定向回来带 code
 * 5. 用 code 换 refresh_token + access_token
 * 6. 调 gmail.users.getProfile 拿真实 email 地址
 */
export async function authorize(): Promise<AuthorizeResult> {
  const creds = await keychain.getCredentials();
  if (!creds) throw new NoCredentialsError();

  const loopback = await startLoopbackServer();

  try {
    const oauth2 = new google.auth.OAuth2({
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
      redirectUri: loopback.redirectUri,
    });

    const authUrl = oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent', // 强制每次返回 refresh_token
      scope: SCOPES,
    });

    await shell.openExternal(authUrl);

    const query = await loopback.waitForCode();

    if (query.error) {
      throw new OAuthCancelledError(query.error_description || query.error);
    }
    if (!query.code) {
      throw new OAuthCancelledError('未收到授权码');
    }

    const { tokens: raw } = await oauth2.getToken(query.code);
    if (!raw.refresh_token || !raw.access_token) {
      throw new OAuthCancelledError('Google 未返回必需的 token');
    }

    const tokens: Tokens = {
      refreshToken: raw.refresh_token,
      accessToken: raw.access_token,
      expiryDate: raw.expiry_date ?? Date.now() + 3500 * 1000,
    };

    oauth2.setCredentials(raw);
    const gmail = google.gmail({ version: 'v1', auth: oauth2 });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const email = profile.data.emailAddress;
    if (!email) throw new Error('Google 未返回 email 地址');

    return { email, tokens };
  } finally {
    loopback.close();
  }
}
