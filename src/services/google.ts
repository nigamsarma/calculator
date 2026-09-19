/**
 * Google Identity Services & Google Drive appDataFolder API Client
 */

declare const google: any;

export interface GoogleDriveBackup {
  fileId?: string;
  name: string;
}

export class GoogleAuthService {
  private static clientId: string = '';

  public static setClientId(id: string) {
    this.clientId = id;
  }

  /**
   * Prompts user with Google Identity Services (GIS) One Tap / Button sign-in.
   */
  public static async signIn(): Promise<{ idToken: string }> {
    return new Promise((resolve, reject) => {
      if (typeof google === 'undefined' || !google.accounts) {
        reject(new Error('Google Identity Services SDK not loaded'));
        return;
      }

      google.accounts.id.initialize({
        client_id: this.clientId,
        callback: (response: any) => {
          if (response.credential) {
            resolve({ idToken: response.credential });
          } else {
            reject(new Error('Google Sign-In failed'));
          }
        }
      });

      google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // Fallback to explicit prompt
          google.accounts.id.renderButton(document.body, {});
        }
      });
    });
  }

  /**
   * Requests OAuth 2.0 access token with Drive appDataFolder scope.
   */
  public static async getDriveAccessToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (typeof google === 'undefined' || !google.accounts) {
        reject(new Error('Google Identity Services SDK not loaded'));
        return;
      }

      const client = google.accounts.oauth2.initTokenClient({
        client_id: this.clientId,
        scope: 'https://www.googleapis.com/auth/drive.appdata openid email',
        callback: (response: any) => {
          if (response.access_token) {
            resolve(response.access_token);
          } else {
            reject(new Error('Drive access authorization failed'));
          }
        }
      });

      client.requestAccessToken();
    });
  }

  /**
   * Saves encrypted backup blob to Google Drive appDataFolder.
   */
  public static async uploadBackupToDrive(accessToken: string, encryptedBlobJson: string): Promise<string> {
    const fileName = 'calculator_backup.enc';

    // First check if backup file already exists in appDataFolder
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${fileName}'`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    const searchData = await searchRes.json();
    const existingFile = searchData.files && searchData.files[0];

    const metadata = {
      name: fileName,
      parents: ['appDataFolder']
    };

    const boundary = 'foo_bar_baz';
    const body =
      `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      `\r\n--${boundary}\r\n` +
      'Content-Type: application/json\r\n\r\n' +
      encryptedBlobJson +
      `\r\n--${boundary}--`;

    let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    let method = 'POST';

    if (existingFile) {
      url = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`;
      method = 'PATCH';
    }

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body
    });

    if (!res.ok) {
      throw new Error(`Drive backup upload failed with status ${res.status}`);
    }

    const data = await res.json();
    return data.id;
  }

  /**
   * Downloads encrypted backup file from Google Drive appDataFolder.
   */
  public static async downloadBackupFromDrive(accessToken: string): Promise<string> {
    const fileName = 'calculator_backup.enc';

    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${fileName}'`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    const searchData = await searchRes.json();
    if (!searchData.files || searchData.files.length === 0) {
      throw new Error('No backup file found in Google Drive appDataFolder');
    }

    const fileId = searchData.files[0].id;

    const downloadRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    if (!downloadRes.ok) {
      throw new Error('Failed to download backup file from Drive');
    }

    return await downloadRes.text();
  }
}
